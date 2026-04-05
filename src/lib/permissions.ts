// src/lib/permissions.ts
// =============================================================================
// MehmanGhar Financial OS — Role Permission Checks (SERVER ONLY)
//
// ⚠  This file imports from db.ts (which uses pg / Node.js modules).
//    Import this file ONLY from:
//      - API routes (src/app/api/**)
//      - Server Components (page.tsx, layout.tsx)
//      - Other server-side lib files
//
//    For types and constants in Client Components, import from:
//      @/lib/permissions.types
//
// The permission data is stored in the `roles` table as JSON columns:
//   tab_permissions  — { [tabKey]: boolean }
//   crud_permissions — { [tabKey]: { create, read, update, delete } }
//
// SuperAdmin bypass:
//   SuperAdmin always passes every check — canAccessTab, canPerformAction,
//   assertPermission, getCrudFlags all return true/full-access without a DB
//   lookup. This is the single source of truth for the SuperAdmin rule.
// =============================================================================

import { prisma } from "./db";
import type {
  TabKey,
  CrudAction,
  SystemRole,
  TabPermissions,
  CrudPermissions,
} from "./permissions.types";
import { SUPER_ADMIN } from "./permissions.types";

// Re-export everything from types so existing server imports still work
// with a single import path.
export type { TabKey, CrudAction, SystemRole, TabPermissions, CrudPermissions } from "./permissions.types";
export { SUPER_ADMIN } from "./permissions.types";

// ---------------------------------------------------------------------------
// getRolePermissions — fetch role from DB by name
// ---------------------------------------------------------------------------

interface RolePermissions {
  tabPermissions:  TabPermissions;
  crudPermissions: CrudPermissions;
}

export async function getRolePermissions(
  roleName: string
): Promise<RolePermissions | null> {
  const role = await prisma.role.findUnique({
    where:  { name: roleName },
    select: { tab_permissions: true, crud_permissions: true },
  });
  if (!role) return null;
  return {
    tabPermissions:  role.tab_permissions as TabPermissions,
    crudPermissions: role.crud_permissions as CrudPermissions,
  };
}

// ---------------------------------------------------------------------------
// canAccessTab — SuperAdmin always true, others checked from DB
// ---------------------------------------------------------------------------

export async function canAccessTab(
  roleName: string,
  tab: TabKey
): Promise<boolean> {
  if (roleName === SUPER_ADMIN) return true;
  const permissions = await getRolePermissions(roleName);
  if (!permissions) return false;
  return permissions.tabPermissions[tab] === true;
}

// ---------------------------------------------------------------------------
// canPerformAction — SuperAdmin always true, others checked from DB
// ---------------------------------------------------------------------------

export async function canPerformAction(
  roleName: string,
  tab:      TabKey,
  action:   CrudAction
): Promise<boolean> {
  if (roleName === SUPER_ADMIN) return true;
  const permissions = await getRolePermissions(roleName);
  if (!permissions) return false;
  return permissions.crudPermissions[tab]?.[action] === true;
}

// ---------------------------------------------------------------------------
// getCrudFlags — page-level helper for CRUD button visibility
// ---------------------------------------------------------------------------

export interface CrudFlags {
  canCreate: boolean;
  canRead:   boolean;
  canEdit:   boolean;
  canDelete: boolean;
}

const FULL_CRUD: CrudFlags = { canCreate: true, canRead: true, canEdit: true, canDelete: true };
const NO_CRUD:   CrudFlags = { canCreate: false, canRead: false, canEdit: false, canDelete: false };

export async function getCrudFlags(
  roleName: string,
  tab: TabKey
): Promise<CrudFlags> {
  if (roleName === SUPER_ADMIN) return FULL_CRUD;
  const permissions = await getRolePermissions(roleName);
  if (!permissions) return NO_CRUD;
  const crud = permissions.crudPermissions[tab];
  if (!crud) return NO_CRUD;
  return {
    canCreate: crud.create === true,
    canRead:   crud.read   === true,
    canEdit:   crud.update === true,
    canDelete: crud.delete === true,
  };
}

// ---------------------------------------------------------------------------
// assertPermission — throws PermissionError if denied
// ---------------------------------------------------------------------------

export class PermissionError extends Error {
  public readonly status = 403;
  constructor(role: string, tab: TabKey, action: CrudAction) {
    super(`[permissions] Role "${role}" does not have "${action}" access to tab "${tab}".`);
    this.name = "PermissionError";
  }
}

export async function assertPermission(
  roleName: string,
  tab:      TabKey,
  action:   CrudAction
): Promise<void> {
  const allowed = await canPerformAction(roleName, tab, action);
  if (!allowed) throw new PermissionError(roleName, tab, action);
}

// ---------------------------------------------------------------------------
// requireRole — SuperAdmin-only route guard
// ---------------------------------------------------------------------------

export class RoleRequiredError extends Error {
  public readonly status = 403;
  constructor(required: SystemRole[]) {
    super(`[permissions] This route requires one of: ${required.join(", ")}.`);
    this.name = "RoleRequiredError";
  }
}

export function requireRole(roleName: string, allowed: SystemRole[]): void {
  if (!allowed.includes(roleName as SystemRole)) {
    throw new RoleRequiredError(allowed);
  }
}

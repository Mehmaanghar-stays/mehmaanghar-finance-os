// src/lib/permissions.types.ts
// =============================================================================
// MehmanGhar Financial OS — Permission Types & Constants (client-safe)
//
// This file contains ONLY pure types and constants — no imports from db.ts,
// no Node.js dependencies. Safe to import from both Server and Client Components.
//
// Server-only permission functions (getRolePermissions, assertPermission, etc.)
// live in permissions.ts which may only be imported from Server Components,
// API routes, and server-side lib files.
// =============================================================================

export type TabKey =
  | "dashboard"
  | "cashflow"
  | "properties"
  | "investors"
  | "reports"
  | "insights"
  | "expenses"
  | "payouts"
  | "bookings"
  | "crm"
  | "dailyexp"
  | "monthlyentry"
  | "utils"
  | "users";

export type CrudAction = "create" | "read" | "update" | "delete";

/**
 * All valid role names in the system.
 * SuperAdmin is seeded and cannot be deleted.
 * Admin and Co-Host are default non-super roles.
 */
export type SystemRole = "SuperAdmin" | "Admin" | "Co-Host";

/** Canonical SuperAdmin role name constant. Use this instead of the string literal. */
export const SUPER_ADMIN: SystemRole = "SuperAdmin";

export interface TabPermissions {
  [tabKey: string]: boolean;
}

export interface CrudPermissions {
  [tabKey: string]: {
    create: boolean;
    read:   boolean;
    update: boolean;
    delete: boolean;
  };
}

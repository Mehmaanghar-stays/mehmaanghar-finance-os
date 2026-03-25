// src/app/(dashboard)/properties/page.tsx
//
// Properties page — Server Component shell.
//
// Fetches properties + reports + role permissions, then renders
// <PropertiesClient /> with serializable props.
//
// HTML source: <div class="page" id="page-properties"> + rndProps()
//
// ═══ SCHEMA MIGRATION REQUIRED ═══════════════════════════════════════════
// The Property model needs city, comm, state, capital, type, rooms, assets
// fields before this page is fully functional. See SCHEMA_MIGRATION_property_fields.ts
// in the outputs directory.
//
// Until the migration is applied:
//   - city / state display as blank
//   - comm defaults to 25 (no commission breakdown in table)
//   - capital defaults to 0 (ROI shows N/A — correct fallback)
//   - assets defaults to []
// ═════════════════════════════════════════════════════════════════════════

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRolePermissions } from '@/lib/permissions';
import { PropertiesClient } from './PropertiesClient';
import type { SerializableReport } from '../dashboard/page';

// Re-export for PropertiesClient.tsx which imports from './page'
export type { SerializableReport };

// ---------------------------------------------------------------------------
// Serializable property type
// ---------------------------------------------------------------------------

export interface SerializableProperty {
  id: string;
  name: string;
  city: string;
  state: string;
  comm: number;
  capital: number;
  address: string | null;
  type: string;
  rooms: number;
  assets: Array<{ name: string; amount: number; type: string }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PropertiesPage() {
  // ── Session ───────────────────────────────────────────────────────────────
  const cookieName = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value ?? '';
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect('/login');

  // ── Role permissions ──────────────────────────────────────────────────────
  const rolePerms = await getRolePermissions(session.role);
  const tabPerms   = rolePerms?.tabPermissions  ?? {};
  const crudPerms  = rolePerms?.crudPermissions ?? {};

  const canCreate = crudPerms['properties']?.create === true;
  const canEdit   = crudPerms['properties']?.update === true;
  const canDelete = crudPerms['properties']?.delete === true;

  // Guard: if the role cannot read this tab, redirect (extra safety beyond proxy)
  if (tabPerms['properties'] !== true) redirect('/dashboard');

  // ── Fetch properties ──────────────────────────────────────────────────────
  const rawProps = await prisma.property.findMany({
    select: {
      id: true, name: true, address: true,
      city: true, state: true, comm: true,
      capital: true, type: true, rooms: true, assets: true,
    },
    orderBy: { name: 'asc' },
  });

  const properties: SerializableProperty[] = rawProps.map((p) => ({
    id:      p.id,
    name:    p.name,
    city:    p.city ?? '',
    state:   p.state ?? '',
    comm:    Number(p.comm) || 25,
    capital: Number(p.capital) || 0,
    address: p.address,
    type:    p.type ?? '',
    rooms:   Number(p.rooms) || 0,
    assets:  (p.assets as SerializableProperty['assets']) ?? [],
  }));

  // ── Fetch report rows (for per-property period stats) ─────────────────────
  const rawReports = await prisma.report.findMany({
    select: { id: true, property_id: true, month: true, year: true, data: true },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  });

  const reports: SerializableReport[] = rawReports.flatMap((r) => {
    if (!r.property_id || !r.month) return [];
    const d = r.data as Record<string, unknown>;
    return [{
      id:         r.id,
      pid:        r.property_id,
      month:      r.month,
      year:       r.year,
      rev:        Number(d.rev         ?? 0),
      roomRev:    Number(d.roomRev     ?? d.rev ?? 0),
      exp:        Number(d.exp         ?? 0),
      opProfit:   Number(d.opProfit    ?? 0),
      commission: Number(d.commission  ?? 0),
      invProfit:  Number(d.invProfit   ?? 0),
      nights:     Number(d.nights      ?? 0),
      days:       Number(d.days        ?? 0),
      occ:        Number(d.occ         ?? 0),
      roi:        Number(d.roi         ?? 0),
      adr:        Number(d.adr         ?? 0),
      revpar:     Number(d.revpar      ?? 0),
      channels:   (d.channels  as Record<string, number>) ?? {},
      expCats:    (d.expCats   as Record<string, number>) ?? {},
    }];
  });

  return (
    <PropertiesClient
      properties={properties}
      reports={reports}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
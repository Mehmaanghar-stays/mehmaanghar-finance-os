// src/app/(dashboard)/reports/page.tsx
//
// Reports page — Server Component shell.
// Fetches Report rows + Property rows; passes them to <ReportsClient />.
//
// HTML source: <div class="page" id="page-reports"> + rndReports()
//              + saveMonthlyBulk() + initMmModal()

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRolePermissions } from '@/lib/permissions';
import { ReportsClient } from './ReportsClient';
import type { SerializableReport } from '../dashboard/page';
import type { SerializableProperty } from '../properties/page';

export default async function ReportsPage() {
  // ── Session + permissions ─────────────────────────────────────────────────
  const cookieName = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value ?? '';
  const session = token ? await verifyToken(token) : null;
  if (!session) redirect('/login');

  const rolePerms = await getRolePermissions(session.role);
  const tabPerms  = rolePerms?.tabPermissions  ?? {};
  const crudPerms = rolePerms?.crudPermissions ?? {};
  if (tabPerms['reports'] !== true) redirect('/dashboard');

  // 'Monthly Entry' nav item (Sidebar) is gated on reports create permission
  const canMonthlyEntry = crudPerms['reports']?.create === true;

  // ── Fetch reports ─────────────────────────────────────────────────────────
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
      rev:        Number(d.rev        ?? 0),
      roomRev:    Number(d.roomRev    ?? d.rev ?? 0),
      exp:        Number(d.exp        ?? 0),
      opProfit:   Number(d.opProfit   ?? 0),
      commission: Number(d.commission ?? 0),
      invProfit:  Number(d.invProfit  ?? 0),
      nights:     Number(d.nights     ?? 0),
      days:       Number(d.days       ?? 0),
      occ:        Number(d.occ        ?? 0),
      roi:        Number(d.roi        ?? 0),
      adr:        Number(d.adr        ?? 0),
      revpar:     Number(d.revpar     ?? 0),
      channels:   (d.channels as Record<string, number>) ?? {},
      expCats:    (d.expCats  as Record<string, number>) ?? {},
    }];
  });

  // ── Fetch properties (for Monthly Entry modal + snapshot display) ──────────
  const rawProps = await prisma.property.findMany({
    select: { id: true, name: true, address: true },
    orderBy: { name: 'asc' },
  });

  const properties: SerializableProperty[] = rawProps.map((p) => ({
    id:      p.id,
    name:    p.name,
    city:    (p as Record<string, unknown>).city   as string ?? '',
    state:   (p as Record<string, unknown>).state  as string ?? '',
    comm:    Number((p as Record<string, unknown>).comm)     || 25,
    capital: Number((p as Record<string, unknown>).capital)  || 0,
    address: p.address,
    type:    (p as Record<string, unknown>).type   as string ?? '',
    rooms:   Number((p as Record<string, unknown>).rooms)    || 0,
    assets:  ((p as Record<string, unknown>).assets as SerializableProperty['assets']) ?? [],
  }));

  return (
    <ReportsClient
      reports={reports}
      properties={properties}
      canMonthlyEntry={canMonthlyEntry}
    />
  );
}
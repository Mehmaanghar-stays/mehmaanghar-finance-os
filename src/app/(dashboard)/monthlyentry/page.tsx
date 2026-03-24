// src/app/(dashboard)/monthlyentry/page.tsx
//
// Monthly Entry page — Server Component shell.
// SuperAdmin + Admin access; gated on the 'reports' tab permission
// (same permission key that gated the former modal trigger in the Sidebar).
//
// HTML source: <div class="ov" id="monthlyModal"> + saveMonthlyBulk()
//              + initMmModal() — now rendered as a full page instead of
//              a modal overlay.
//
// Fetches the property list (needed for the property selector) and passes
// serialized props to <MonthlyEntryClient />. No report rows are fetched
// here — this page only writes data, it does not display historical records.
//
// After a successful save, the client navigates to /reports via useRouter
// and syncs the period bar to the saved month/year via usePeriod.setPeriod.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getRolePermissions } from '@/lib/permissions';
import { MonthlyEntryClient } from './MonthlyEntryClient';
import type { SerializableProperty } from '../properties/page';

export default async function MonthlyEntryPage() {
  // ── Session + permissions ─────────────────────────────────────────────────
  const cookieName  = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token       = cookieStore.get(cookieName)?.value ?? '';
  const session     = token ? await verifyToken(token) : null;
  if (!session) redirect('/login');

  const rolePerms = await getRolePermissions(session.role);
  const tabPerms  = rolePerms?.tabPermissions  ?? {};
  const crudPerms = rolePerms?.crudPermissions ?? {};

  // Tab visibility guard — 'reports' permission gates this page, matching
  // the permKey used in the Sidebar nav item.
  if (tabPerms['reports'] !== true) redirect('/dashboard');

  // CRUD guard — only roles with reports.create can save monthly data.
  // The client receives this flag and disables the save button accordingly.
  const canCreate = crudPerms['reports']?.create === true;

  // ── Fetch properties ──────────────────────────────────────────────────────
  const rawProps = await prisma.property.findMany({
    select: { id: true, name: true, address: true },
    orderBy: { name: 'asc' },
  });

  const properties: SerializableProperty[] = rawProps.map((p) => ({
    id:      p.id,
    name:    p.name,
    city:    (p as Record<string, unknown>).city  as string ?? '',
    state:   (p as Record<string, unknown>).state as string ?? '',
    comm:    Number((p as Record<string, unknown>).comm)    || 25,
    capital: Number((p as Record<string, unknown>).capital) || 0,
    address: p.address,
    type:    (p as Record<string, unknown>).type  as string ?? '',
    rooms:   Number((p as Record<string, unknown>).rooms)   || 0,
    assets:  ((p as Record<string, unknown>).assets as SerializableProperty['assets']) ?? [],
  }));

  return (
    <MonthlyEntryClient
      properties={properties}
      canCreate={canCreate}
    />
  );
}
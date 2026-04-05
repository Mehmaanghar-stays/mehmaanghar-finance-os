// src/app/(dashboard)/monthlyentry/page.tsx
//
// Monthly Entry page — Server Component shell.
// SuperAdmin + Admin access; gated on the 'monthlyentry' tab permission.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { canAccessTab, getCrudFlags } from '@/lib/permissions';
import { MonthlyEntryClient } from './MonthlyEntryClient';
import type { MonthlyEntryProperty } from './MonthlyEntryClient';

export default async function MonthlyEntryPage() {
  const cookieName  = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token       = cookieStore.get(cookieName)?.value ?? '';
  const session     = token ? await verifyToken(token) : null;
  if (!session) redirect('/login');

  if (!(await canAccessTab(session.role, 'monthlyentry'))) redirect('/dashboard');
  const { canCreate } = await getCrudFlags(session.role, 'monthlyentry');

  // ── Fetch properties — only id + name needed for the property selector ─────
  const rawProps = await prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const properties: MonthlyEntryProperty[] = rawProps.map((p) => ({
    id:   p.id,
    name: p.name,
  }));

  // ── Fetch existing report keys — used client-side to warn before re-submit ─
  // Keys are "pid:month:year" strings. Client checks against selection.
  const existingReports = await prisma.report.findMany({
    where: { property_id: { not: null }, month: { not: null } },
    select: { property_id: true, month: true, year: true },
  });
  const existingKeys: string[] = existingReports
    .filter((r) => r.property_id && r.month)
    .map((r) => `${r.property_id}:${r.month}:${r.year}`);

  return (
    <MonthlyEntryClient
      properties={properties}
      canCreate={canCreate}
      existingKeys={existingKeys}
    />
  );
}
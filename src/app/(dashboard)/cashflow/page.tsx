// src/app/(dashboard)/cashflow/page.tsx
//
// Cash Flow page — Server Component shell.
//
// Fetches all Report rows and passes them as serializable props to
// <CashFlowClient />, which applies period filtering client-side.
//
// HTML source: <div class="page" id="page-cashflow">
// JS source:   rndCashflow()
//
// NOTE: Report rows are shared with the dashboard page. They use the same
// SerializableReport type defined in dashboard/page.tsx — imported from
// there to keep the shape DRY.

import { prisma } from '@/lib/db';
import type { SerializableReport } from '../dashboard/page';
import { CashFlowClient } from './CashFlowClient';

export default async function CashFlowPage() {
  // Fetch all report rows — same query as the dashboard page.
  const rawReports = await prisma.report.findMany({
    select: {
      id: true,
      property_id: true,
      month: true,
      year: true,
      data: true,
    },
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

  return <CashFlowClient reports={reports} />;
}
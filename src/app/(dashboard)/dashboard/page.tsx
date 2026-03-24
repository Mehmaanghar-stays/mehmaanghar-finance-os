// src/app/(dashboard)/dashboard/page.tsx
//
// Dashboard — Server Component shell.
//
// Fetches all Report rows from the DB and passes them as serializable props
// to <DashboardClient />, which runs period filtering client-side via Zustand.
//
// HTML source: <div class="page active" id="page-dashboard">
// JS source: rndMetrics(), rndDashCharts()

import { prisma } from '@/lib/db';
import { DashboardClient } from './DashboardClient';

// ---------------------------------------------------------------------------
// Data types shared with the client
// ---------------------------------------------------------------------------

export interface SerializableReport {
  id: string;
  pid: string;
  month: number;
  year: number;
  rev: number;
  roomRev: number;
  exp: number;
  opProfit: number;
  commission: number;
  invProfit: number;
  nights: number;
  days: number;
  occ: number;
  roi: number;
  adr: number;
  revpar: number;
  channels: Record<string, number>;
  expCats: Record<string, number>;
}

export interface SerializableProperty {
  id: string;
  name: string;
  // city and comm added in the schema migration (see layout.tsx flag).
  // Until then these default to "" and 25.
  city: string;
  comm: number;
}

// ---------------------------------------------------------------------------
// Page (Server Component)
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  // Fetch all report rows. The Report.data column holds the full calcF() output.
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

  // Normalise into SerializableReport. The data JSON column holds the full
  // calcF() output shape written by the reports API route (Phase 6).
  // Until reports exist this will be an empty array — showing empty state.
  const reports: SerializableReport[] = rawReports.flatMap((r) => {
    if (!r.property_id || !r.month) return [];
    const d = r.data as Record<string, unknown>;
    return [{
      id: r.id,
      pid: r.property_id,
      month: r.month,
      year: r.year,
      rev:        Number(d.rev ?? 0),
      roomRev:    Number(d.roomRev ?? d.rev ?? 0),
      exp:        Number(d.exp ?? 0),
      opProfit:   Number(d.opProfit ?? 0),
      commission: Number(d.commission ?? 0),
      invProfit:  Number(d.invProfit ?? 0),
      nights:     Number(d.nights ?? 0),
      days:       Number(d.days ?? 0),
      occ:        Number(d.occ ?? 0),
      roi:        Number(d.roi ?? 0),
      adr:        Number(d.adr ?? 0),
      revpar:     Number(d.revpar ?? 0),
      channels:   (d.channels as Record<string, number>) ?? {},
      expCats:    (d.expCats as Record<string, number>) ?? {},
    }];
  });

  // Fetch properties for lookup (name, city, comm).
  // SCHEMA GAP: city/comm not yet in schema. Defaults applied here.
  const rawProperties = await prisma.property.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const properties: SerializableProperty[] = rawProperties.map((p) => ({
    id: p.id,
    name: p.name,
    // Replace with real p.city / Number(p.comm) after schema migration.
    city: '',
    comm: 25,
  }));

  return (
    <DashboardClient reports={reports} properties={properties} />
  );
}
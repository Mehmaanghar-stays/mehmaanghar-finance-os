// src/app/(dashboard)/layout.tsx
//
// Dashboard layout — Server Component.
//
// Renders for every route under (dashboard):
//   /dashboard, /cashflow, /properties, /investors, /reports,
//   /insights, /expenses, /payouts, /bookings, /crm, /dailyexp, /utils
//
// Structure (mirrors mg-finance-os.html exactly):
//
//   <aside class="sb">        ← Sidebar (position:fixed, outside .main)
//   <div class="main">
//     <header class="topbar"> ← Topbar (sticky)
//     <div class="cnt">
//       <div class="pbar">    ← PeriodBar
//       {children}            ← Page content

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { PeriodBar } from '@/components/layout/PeriodBar';
import { ToastProvider } from '@/components/ui/Toast';
import type { CityOption, PropertyOption } from '@/components/layout/PeriodBar';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ── 1. Verify session ─────────────────────────────────────────────────────
  // proxy.ts already guards every route, but we read the session here too
  // so we can make role-aware decisions in this server component if needed.
  const cookieName = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value ?? '';

  const session = token ? await verifyToken(token) : null;

  // Should never reach here (proxy.ts redirects), but belt + suspenders.
  if (!session) redirect('/login');

  // ── 2. Fetch data for PeriodBar ───────────────────────────────────────────
  // Property.city and Property.comm are live in the schema (Phase 6 migration).
  const rawProperties = await prisma.property.findMany({
    select: { id: true, name: true, city: true, comm: true },
    orderBy: { name: 'asc' },
  });

  const citySet = new Set(rawProperties.map((p) => p.city).filter(Boolean));
  const cities: CityOption[] = [...citySet]
    .sort()
    .map((c) => ({ value: c, label: c }));

  const properties: PropertyOption[] = rawProperties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  // ── 3. Render ─────────────────────────────────────────────────────────────
  return (
    <ToastProvider>
      {/*
       * Sidebar: position:fixed, outside .main.
       * Self-contained — reads cookie + permissions internally.
       */}
      <Sidebar />

      {/*
       * .main — offset by 230px to clear the fixed sidebar.
       * The class is defined in globals.css (.main { margin-left: 230px; }).
       */}
      <div className="main">
        {/*
         * Topbar: sticky, z-index:50 (set in Topbar.module.css).
         * Self-contained — reads cookie + DB username internally.
         * PeriodBadge update: replace the static "—" in Topbar.tsx with
         * <PeriodBadge /> imported from PeriodBar.tsx. See Run 2 decisions.
         */}
        <Topbar />

        {/* .cnt — padding:20px 24px, applied to all page content */}
        <div className="cnt">
          {/*
           * PeriodBar: Client Component.
           * Cities and properties are serializable primitives (string arrays)
           * so they cross the Server→Client boundary safely.
           */}
          <PeriodBar cities={cities} properties={properties} />

          {/* Page content — each dashboard page renders here */}
          {children}
        </div>
      </div>
    </ToastProvider>
  );
}
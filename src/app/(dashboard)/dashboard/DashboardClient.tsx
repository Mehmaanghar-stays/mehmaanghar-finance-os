'use client';
// src/app/(dashboard)/dashboard/DashboardClient.tsx
//
// Client Component. Reads the Zustand period store, re-derives all metrics
// and chart data whenever the period/filter state changes.
//
// Renders (pixel-matched to HTML):
//   - Empty state (#d-empty) when no data for the current period
//   - MetricCard grid (11 cards, verbatim from rndMetrics())
//   - Info cards row (Total Nights · Total Expenses · Expense Goal)
//   - .crow.r2: RevenueChart + CommissionDonut
//   - .crow.r3: OccupancyChart + Booking Channels Donut + Property Revenue bar

import { useMemo } from 'react';
import Link from 'next/link';
import { usePeriod } from '@/hooks/usePeriod';
import { aggReps, withD, getFYMonths } from '@/lib/period';
import type { RepRow, PropLookup, PeriodState, FilterState } from '@/lib/period';
import { MetricCard, MetricCardGrid } from '@/components/ui/MetricCard';
import { RevenueChart } from '@/components/charts/RevenueChart';
import { CommissionDonut } from '@/components/charts/CommissionDonut';
import { OccupancyChart } from '@/components/charts/OccupancyChart';
import type { SerializableReport, SerializableProperty } from './page';
import type { RevenueTrendPoint } from '@/components/charts/RevenueChart';
import type { OccupancyTrendPoint } from '@/components/charts/OccupancyChart';

// Lazy-imported to keep initial bundle smaller (chart.js is ~200KB)
import dynamic from 'next/dynamic';
const ChannelsDonut  = dynamic(() => import('./ChannelsDonut').then(m => ({ default: m.ChannelsDonut })),  { ssr: false });
const PropertyRevBar = dynamic(() => import('./PropertyRevBar').then(m => ({ default: m.PropertyRevBar })), { ssr: false });

// ---------------------------------------------------------------------------
// Formatting helpers — verbatim fI() and fIN() from the HTML
// ---------------------------------------------------------------------------

function fI(n: number): string {
  if (!n && n !== 0) return '₹0';
  const v = Math.abs(n);
  if (v >= 100000) return (n < 0 ? '-' : '') + '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)   return (n < 0 ? '-' : '') + '₹' + (v / 1000).toFixed(0) + 'K';
  return (n < 0 ? '-' : '') + '₹' + Math.round(v);
}

function fIN(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

// Month abbrev array (for info card label)
const MS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------------------
// getPeriodMonths — verbatim port from getPeriodMonths() in the HTML
// Returns up to maxN {m, y, l} entries for the trend window.
// ---------------------------------------------------------------------------

const Q_MONTHS: Record<number, number[]> = {
  1: [4, 5, 6], 2: [7, 8, 9], 3: [10, 11, 12], 4: [1, 2, 3],
};

function getPeriodMonths(
  maxN: number,
  period: PeriodState,
): Array<{ m: number; y: number; l: string }> {
  const { cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo } = period;
  const res: Array<{ m: number; y: number; l: string }> = [];

  switch (cPType) {
    case 'monthly':
      for (let i = Math.min(maxN, 6) - 1; i >= 0; i--) {
        let m = cM - i; let y = cY;
        if (m <= 0) { m += 12; y--; }
        res.push({ m, y, l: MS[m] });
      }
      break;
    case 'quarterly': {
      const months = Q_MONTHS[cQ] ?? [];
      const yr = cQ === 4 ? cFY + 1 : cFY;
      months.forEach((m) => res.push({ m, y: yr, l: MS[m] }));
      break;
    }
    case 'fy':
      getFYMonths(cFY).forEach(({ month: m, year: y }) => res.push({ m, y, l: MS[m] }));
      break;
    case 'custom': {
      if (!cDateFrom && !cDateTo) {
        for (let i = 5; i >= 0; i--) {
          let m = cM - i; let y = cY;
          if (m <= 0) { m += 12; y--; }
          res.push({ m, y, l: MS[m] });
        }
        break;
      }
      const from = cDateFrom ? new Date(cDateFrom + '-01') : new Date(cY, cM - 7, 1);
      const to   = cDateTo   ? new Date(cDateTo   + '-01') : new Date(cY, cM - 1, 1);
      const d = new Date(from);
      while (d <= to && res.length < maxN) {
        res.push({ m: d.getMonth() + 1, y: d.getFullYear(), l: MS[d.getMonth() + 1] });
        d.setMonth(d.getMonth() + 1);
      }
      break;
    }
    default:
      for (let i = 5; i >= 0; i--) {
        let m = cM - i; let y = cY;
        if (m <= 0) { m += 12; y--; }
        res.push({ m, y, l: MS[m] });
      }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardClientProps {
  reports: SerializableReport[];
  properties: SerializableProperty[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DashboardClient({ reports, properties }: DashboardClientProps) {
  // ── Period state ──────────────────────────────────────────────────────────
  const { getFilteredReps, getFilteredRepsForMonth, ...periodState } = usePeriod();
  const { cM, cY } = periodState;

  // ── Build prop lookup map ─────────────────────────────────────────────────
  const propMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p])),
    [properties],
  );
  const propById = (pid: string): PropLookup | null =>
    propMap[pid]
      ? { id: pid, city: propMap[pid].city, comm: propMap[pid].comm }
      : null;

  // Cast SerializableReport → RepRow (shapes match)
  const allReps = reports as RepRow[];

  // ── Filtered reps for current period ──────────────────────────────────────
  const filteredReps = useMemo(
    () => getFilteredReps(allReps, propById),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReps, propMap, periodState.cPType, periodState.cM, periodState.cY,
     periodState.cQ, periodState.cFY, periodState.cDateFrom, periodState.cDateTo,
     periodState.cDay, periodState.cWeek, periodState.cCi, periodState.cPid, periodState.cComm],
  );

  // ── Aggregate for current period ──────────────────────────────────────────
  const agg = useMemo(() => {
    const raw = aggReps(filteredReps, (pid) => {
      // Capital base: property-level capital (schema gap: defaults to 0 until migrated)
      return 0;
    });
    return withD(raw);
  }, [filteredReps]);

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = !agg || (agg.rev === 0 && agg.exp === 0);

  // ── Trend data for charts (6 months) ──────────────────────────────────────
  const trendPeriods = useMemo(
    () => getPeriodMonths(6, periodState as PeriodState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodState.cPType, periodState.cM, periodState.cY, periodState.cQ,
     periodState.cFY, periodState.cDateFrom, periodState.cDateTo],
  );

  const trend = useMemo(() => {
    return trendPeriods.map(({ m, y, l }) => {
      const rs = getFilteredRepsForMonth(allReps, propById, m, y);
      const ta = withD(aggReps(rs));
      return {
        l,
        rev: ta?.rev ?? 0,
        exp: ta?.exp ?? 0,
        op:  ta?.opProfit ?? 0,
        occ: ta?.occ ?? 0,
        m, y,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendPeriods, allReps, propMap, periodState.cCi, periodState.cPid, periodState.cComm]);

  const revenueTrend: RevenueTrendPoint[] = trend;
  const occupancyTrend: OccupancyTrendPoint[] = trend;

  // ── Channel aggregation ───────────────────────────────────────────────────
  const chanAgg = useMemo(() => {
    const agg: Record<string, number> = {};
    filteredReps.forEach((r) => {
      if (r.channels && typeof r.channels === 'object') {
        Object.entries(r.channels).forEach(([k, v]) => {
          agg[k] = (agg[k] ?? 0) + v;
        });
      }
    });
    return agg;
  }, [filteredReps]);

  // ── Property revenue ──────────────────────────────────────────────────────
  const propRevs = useMemo(() => {
    const map: Record<string, number> = {};
    filteredReps.forEach((r) => { map[r.pid] = (map[r.pid] ?? 0) + r.rev; });
    return Object.entries(map)
      .map(([pid, rev]) => ({ name: propMap[pid]?.name ?? 'Unknown', rev }))
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 8);
  }, [filteredReps, propMap]);

  // ── Derived display values ────────────────────────────────────────────────
  const totalNights = filteredReps.reduce((s, r) => s + (r.nights ?? 0), 0);
  const activeProps = new Set(filteredReps.map((r) => r.pid)).size;

  // Expense ratio for info card
  const expRatio = agg && agg.rev > 0
    ? ((agg.exp / agg.rev) * 100).toFixed(1)
    : '0';

  // Commission split % (for donut)
  const commPct = agg && agg.opProfit > 0
    ? +((agg.commission / agg.opProfit) * 100).toFixed(1)
    : 0;
  const invPct = agg && agg.opProfit > 0
    ? +((agg.invProfit / agg.opProfit) * 100).toFixed(1)
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div id="d-empty" className="es">
        <div className="es-ico">📊</div>
        <div className="es-t">No Data for This Period</div>
        <div className="es-s">Upload a report or add data manually.</div>
        <Link href="/bookings" className="btn btn-or">+ Add Booking</Link>
      </div>
    );
  }

  return (
    <div id="d-content">

      {/* ── Metric cards (11 cards, verbatim from rndMetrics) ──────────────── */}
      <MetricCardGrid>
        <MetricCard accent label="Total Revenue"       value={fI(agg!.rev)}       sub="Gross booking revenue"                           iconText="₹"  iconVariant="w" />
        <MetricCard       label="Operating Profit"     value={fI(agg!.opProfit)}   sub={agg!.margin + '% of revenue'}                    iconText="✓"  iconVariant="g" />
        <MetricCard       label="Total Expenses"       value={fI(agg!.exp)}        sub={agg!.rev > 0 ? expRatio + '% of revenue' : ''}   iconText="↓"  iconVariant="r" />
        <MetricCard       label="MehmanGhar Commission" value={agg!.opProfit > 0 ? fI(agg!.commission) : '₹0'} sub={agg!.opProfit > 0 ? agg!.commPct + '% of op. profit' : 'No commission on loss'} iconText="%" iconVariant="o" />
        <MetricCard       label="Investor Payout"      value={fI(agg!.invProfit)}  sub={agg!.invPct + '% of op. profit'}                 iconText="→"  iconVariant="b" />
        <MetricCard       label="Occupancy"            value={agg!.occ + '%'}      sub={agg!.occ >= 75 ? '✓ On target' : '⚠ Below 75% target'} iconText="◉" iconVariant="go" />
        <MetricCard       label="ADR"                  value={fIN(agg!.adr ?? 0)}  sub="Avg Daily Rate (room only)"                      iconText="⌂"  iconVariant="b" />
        <MetricCard       label="RevPAR"               value={fIN(agg!.revpar ?? 0)} sub="Rev per available room-night"                  iconText="▤"  iconVariant="g" />
        <MetricCard       label="Active Properties"    value={String(activeProps)} sub={activeProps + ' active properties'}               iconText="🏠" iconVariant="o" />
        <MetricCard       label="Total Nights"         value={String(totalNights)} sub="Booked this period"                               iconText="🌙" iconVariant="b" />
        <MetricCard       label="Avg ROI"              value={agg!.roiDisplay ?? agg!.roi + '%'} sub={agg!._hasCapital ? 'On investor capital' : 'Capital not entered'} iconText="%" iconVariant="o" />
      </MetricCardGrid>

      {/* ── Info cards row ─────────────────────────────────────────────────── */}
      <div className="rg3" style={{ marginBottom: '16px' }}>
        {/* Total Nights */}
        <div className="cc" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--bl)', marginBottom: '4px' }}>TOTAL NIGHTS</div>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--tx)', lineHeight: 1 }}>{totalNights}</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>booked this period</div>
        </div>

        {/* Total Expenses */}
        <div className="cc" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rd)', marginBottom: '4px' }}>TOTAL EXPENSES</div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--rd)', lineHeight: 1 }}>{fIN(agg!.exp)}</div>
          <div style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '4px' }}>{expRatio}% of revenue</div>
        </div>

        {/* Expense goal — localStorage not used in full-stack; shows "Not set" until
            a dedicated goal field is added to the DB in a future iteration.
            The "Set" button will wire to an API route in v2. */}
        <div className="cc" style={{ padding: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--t2)' }}>
              EXPENSE GOAL — {MS[cM]} {cY}
            </div>
            <button className="btn btn-g btn-sm" style={{ fontSize: '9px', padding: '2px 7px' }} disabled>
              Set
            </button>
          </div>
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--t3)' }}>Not set</div>
            <div style={{ fontSize: '10.5px', color: 'var(--t3)' }}>Goal tracking — v2</div>
          </div>
        </div>
      </div>

      {/* ── .crow.r2: Revenue chart + Commission donut ──────────────────────── */}
      <div className="crow r2">
        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Revenue vs Expenses vs Op. Profit</div>
              <div className="cs">Monthly trend · correct commission formula</div>
            </div>
          </div>
          <RevenueChart trend={revenueTrend} />
        </div>
        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Commission Split</div>
              <div className="cs">% of Operating Profit</div>
            </div>
          </div>
          <CommissionDonut commPct={commPct} invPct={invPct} />
        </div>
      </div>

      {/* ── .crow.r3: Occupancy + Channels + Property Revenue ───────────────── */}
      <div className="crow r3">
        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Occupancy Trend</div>
              <div className="cs">6-month rolling</div>
            </div>
          </div>
          <OccupancyChart trend={occupancyTrend} />
        </div>

        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Booking Channels</div>
              <div className="cs">
                {Object.keys(chanAgg).length ? 'From report data' : 'No channel data'}
              </div>
            </div>
          </div>
          {Object.keys(chanAgg).length > 0 && (
            <ChannelsDonut chanAgg={chanAgg} />
          )}
        </div>

        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Property Revenue</div>
              <div className="cs">Top performers</div>
            </div>
          </div>
          {propRevs.length > 0 && (
            <PropertyRevBar propRevs={propRevs} />
          )}
        </div>
      </div>

    </div>
  );
}
'use client';
// src/app/(dashboard)/cashflow/CashFlowClient.tsx
//
// Client Component. Reads the Zustand period store, re-derives the aggregate
// and trend data whenever the period/filter state changes.
//
// Renders (verbatim from rndCashflow() in the HTML):
//   - Empty state when no revenue data for the period
//   - Three .cfc summary cards: Cash In / Cash Out / Net to Investors
//   - .crow.re: CashFlowChart (12-month) + RevExpenseBar (12-month)

import { useMemo } from 'react';
import Link from 'next/link';
import { usePeriod } from '@/hooks/usePeriod';
import { aggReps, withD, getFYMonths } from '@/lib/period';
import type { RepRow, PeriodState } from '@/lib/period';
import { CashFlowChart } from '@/components/charts/CashFlowChart';
import type { CashFlowTrendPoint } from '@/components/charts/CashFlowChart';
import { RevExpenseBar } from './RevExpenseBar';
import type { RevExpTrendPoint } from './RevExpenseBar';
import type { SerializableReport } from '../dashboard/page';

// ---------------------------------------------------------------------------
// Formatting helpers (verbatim fI / fIN from the HTML)
// ---------------------------------------------------------------------------

function fI(n: number): string {
  if (!n && n !== 0) return '₹0';
  const v = Math.abs(n);
  if (v >= 100000) return (n < 0 ? '-' : '') + '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)   return (n < 0 ? '-' : '') + '₹' + (v / 1000).toFixed(0) + 'K';
  return (n < 0 ? '-' : '') + '₹' + Math.round(v);
}

const MS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ---------------------------------------------------------------------------
// getPeriodMonths — verbatim port (same as DashboardClient, up to maxN=12)
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
      for (let i = Math.min(maxN, 12) - 1; i >= 0; i--) {
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
      getFYMonths(cFY).forEach(({ month: m, year: y }) =>
        res.push({ m, y, l: MS[m] }),
      );
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

interface CashFlowClientProps {
  reports: SerializableReport[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CashFlowClient({ reports }: CashFlowClientProps) {
  const { getFilteredReps, getFilteredRepsForMonth, ...periodState } = usePeriod();
  const { cM, cY } = periodState;

  const allReps = reports as RepRow[];

  // ── Filtered reps for current period ──────────────────────────────────────
  const filteredReps = useMemo(
    () => getFilteredReps(allReps, () => null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allReps, periodState.cPType, periodState.cM, periodState.cY,
     periodState.cQ, periodState.cFY, periodState.cDateFrom, periodState.cDateTo,
     periodState.cDay, periodState.cWeek, periodState.cCi, periodState.cPid, periodState.cComm],
  );

  // ── Aggregate ─────────────────────────────────────────────────────────────
  const agg = useMemo(() => withD(aggReps(filteredReps)), [filteredReps]);

  // ── 12-month trend periods ─────────────────────────────────────────────────
  const trendPeriods = useMemo(
    () => getPeriodMonths(12, periodState as PeriodState),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodState.cPType, periodState.cM, periodState.cY, periodState.cQ,
     periodState.cFY, periodState.cDateFrom, periodState.cDateTo],
  );

  // ── CashFlowChart data — verbatim from rndCashflow() ─────────────────────
  // ci = Math.round(rev / 1000)
  // co = Math.round((exp + commission) / 1000)
  const cfTrend: CashFlowTrendPoint[] = useMemo(
    () =>
      trendPeriods.map(({ m, y, l }) => {
        const rs = getFilteredRepsForMonth(allReps, () => null, m, y);
        const ta = withD(aggReps(rs));
        return {
          l,
          ci: Math.round((ta?.rev ?? 0) / 1000),
          co: Math.round(((ta?.exp ?? 0) + (ta?.commission ?? 0)) / 1000),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trendPeriods, allReps, periodState.cCi, periodState.cPid, periodState.cComm],
  );

  // ── RevExpenseBar data — verbatim from rndCashflow() ─────────────────────
  const expTrend: RevExpTrendPoint[] = useMemo(
    () =>
      trendPeriods.map(({ m, y, l }) => {
        const rs = getFilteredRepsForMonth(allReps, () => null, m, y);
        const ta = withD(aggReps(rs));
        return {
          l,
          rev: Math.round((ta?.rev ?? 0) / 1000),
          exp: Math.round((ta?.exp ?? 0) / 1000),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trendPeriods, allReps, periodState.cCi, periodState.cPid, periodState.cComm],
  );

  // ── Empty state — verbatim: !a || !a.rev ──────────────────────────────────
  if (!agg || !agg.rev) {
    return (
      <div id="cf-empty" className="es">
        <div className="es-ico">💸</div>
        <div className="es-t">No Cash Flow Data</div>
        <div className="es-s">Add bookings and expenses to see cash flow.</div>
        <Link href="/bookings" className="btn btn-or">+ Add Booking</Link>
      </div>
    );
  }

  // ── Period label for card subtitles ───────────────────────────────────────
  // Matches the HTML: `Total Revenue — ${MS[cM]} ${cY}`
  // For non-monthly periods a shorter label is used.
  const periodLabel = periodState.cPType === 'monthly'
    ? `${MS[cM]} ${cY}`
    : periodState.cPType === 'fy'
      ? `FY ${periodState.cFY}–${String(periodState.cFY + 1).slice(2)}`
      : periodState.cPType === 'quarterly'
        ? `Q${periodState.cQ} FY ${periodState.cFY}`
        : `${MS[cM]} ${cY}`;

  return (
    <div id="cf-content">

      {/* ── Three .cfc summary cards ────────────────────────────────────────
          Verbatim from rndCashflow() innerHTML template:
            .cfc.in  — 💰 Cash In       = revenue
            .cfc.out — 💸 Cash Out      = expenses + commission
            .cfc.net — 📊 Net to Investors = invProfit
      */}
      <div className="cfrow" id="cfCards">
        <div className="cfc in">
          <div className="cfc-l">💰 Cash In</div>
          <div className="cfc-a">{fI(agg.rev)}</div>
          <div className="cfc-d">Total Revenue — {periodLabel}</div>
        </div>

        <div className="cfc out">
          <div className="cfc-l">💸 Cash Out</div>
          <div className="cfc-a">{fI(agg.exp + agg.commission)}</div>
          <div className="cfc-d">
            Expenses ({fI(agg.exp)}) + Commission ({fI(agg.commission)})
          </div>
        </div>

        <div className="cfc net">
          <div className="cfc-l">📊 Net to Investors</div>
          <div className="cfc-a">{fI(agg.invProfit)}</div>
          <div className="cfc-d">{agg.invPct}% of operating profit</div>
        </div>
      </div>

      {/* ── .crow.re: two charts side by side ──────────────────────────────── */}
      <div className="crow re">
        {/* 12-Month Cash Flow line chart */}
        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">12-Month Cash Flow</div>
            </div>
          </div>
          <CashFlowChart trend={cfTrend} />
        </div>

        {/* Revenue vs Expenses bar chart */}
        <div className="cc">
          <div className="ch">
            <div>
              <div className="ct">Revenue vs Expenses Trend</div>
              <div className="cs">12-month real data</div>
            </div>
          </div>
          <RevExpenseBar trend={expTrend} />
        </div>
      </div>

    </div>
  );
}
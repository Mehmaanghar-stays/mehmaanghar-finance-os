'use client';
// src/components/layout/PeriodBar.tsx
//
// Client Component. Reads and writes the Zustand period store.
// Renders the full period control bar exactly as in mg-finance-os.html,
// including all period type controls, city/property/commission filters,
// and the period badge.
//
// Source element: <div class="pbar" id="periodBar"> in the HTML.
//
// Architecture notes:
//   - No DOM manipulation — Zustand replaces all global variable reads.
//   - updBadge() is ported verbatim as a pure function `getBadgeText()`.
//   - Year dropdowns are populated with a fixed window (currentYear-5 to +5),
//     matching populateYearDropdowns() in the HTML.
//   - City and property options come from props (Server Component fetches
//     them from the DB and passes them down as plain arrays).
//   - This component updates the Topbar pgBadge — import and render
//     <PeriodBadge /> from this file in layout.tsx (see bottom of file).

import { usePeriodStore } from '@/store/period';
import type { PeriodType } from '@/lib/period';
import styles from './PeriodBar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CityOption {
  value: string;  // city name string
  label: string;
}

export interface PropertyOption {
  value: string;  // property id
  label: string;  // property name
}

export interface PeriodBarProps {
  cities: CityOption[];
  properties: PropertyOption[];
}

// ---------------------------------------------------------------------------
// Month / quarter name arrays — verbatim from the HTML
// ---------------------------------------------------------------------------

const MN = ['', 'January', 'February', 'March', 'April', 'May', 'June',
             'July', 'August', 'September', 'October', 'November', 'December'];
const MS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const QNAMES = ['Q1 Apr–Jun', 'Q2 Jul–Sep', 'Q3 Oct–Dec', 'Q4 Jan–Mar'];

// ---------------------------------------------------------------------------
// getBadgeText — verbatim port of updBadge() from the HTML
// Pure function: takes store state, returns display string.
// ---------------------------------------------------------------------------

function getBadgeText(
  cPType: PeriodType,
  cM: number,
  cY: number,
  cQ: number,
  cFY: number,
  cDateFrom: string,
  cDateTo: string,
  cDay: string,
  cWeek: number,
): string {
  switch (cPType) {
    case 'daily':
      return cDay;
    case 'weekly':
      return 'Week ' + cWeek + ', ' + MS[cM] + ' ' + cY;
    case 'monthly':
      return MS[cM] + ' ' + cY;
    case 'quarterly':
      // In the HTML: qy = sQY dropdown value, which is always synced to cFY.
      return QNAMES[cQ - 1] + ' FY ' + cFY + '–' + String(cFY + 1).slice(2);
    case 'fy':
      return 'FY ' + cFY + '–' + String(cFY + 1).slice(2);
    case 'custom':
      return (cDateFrom || '—') + ' → ' + (cDateTo || '—');
    default:
      return MS[cM] + ' ' + cY;
  }
}

// ---------------------------------------------------------------------------
// Year range helper — mirrors populateYearDropdowns() in the HTML
// ---------------------------------------------------------------------------

function getYearRange(): number[] {
  const cy = new Date().getFullYear();
  const years: number[] = [];
  for (let y = cy - 5; y <= cy + 5; y++) years.push(y);
  return years;
}

const YEARS = getYearRange();

// ---------------------------------------------------------------------------
// PeriodBadge — small Client Component exported separately so Topbar can
// import and render it to replace the static "—" badge built in Run 2.
// ---------------------------------------------------------------------------

export function PeriodBadge() {
  const { cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo, cDay, cWeek } =
    usePeriodStore();
  const badge = getBadgeText(cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo, cDay, cWeek);
  return <>{badge}</>;
}

// ---------------------------------------------------------------------------
// PeriodBar
// ---------------------------------------------------------------------------

export function PeriodBar({ cities, properties }: PeriodBarProps) {
  const {
    cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo, cDay, cWeek,
    cCi, cPid, cComm,
    setPeriod, setFilters,
  } = usePeriodStore();

  const badgeText = getBadgeText(
    cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo, cDay, cWeek,
  );

  // ── Handler: period type change ──────────────────────────────────────────
  function handlePTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPeriod({ cPType: e.target.value as PeriodType });
  }

  return (
    <div className={styles.pbar} id="periodBar">

      {/* ── Period type selector ─────────────────────────────────────────── */}
      <span className={styles.plbl}>View by:</span>
      <select
        className={styles.fsel}
        value={cPType}
        onChange={handlePTypeChange}
      >
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="quarterly">Quarterly</option>
        <option value="fy">Financial Year</option>
        <option value="custom">Custom Range</option>
      </select>

      <div className={styles.fdiv} />

      {/* ── Daily controls ──────────────────────────────────────────────── */}
      {cPType === 'daily' && (
        <span className={styles['ctrl-group']}>
          <input
            type="date"
            className={`${styles.fsel} ${styles['fsel-date']}`}
            value={cDay}
            onChange={(e) => {
              const val = e.target.value;
              const d = new Date(val);
              setPeriod({
                cDay: val,
                cM: d.getMonth() + 1,
                cY: d.getFullYear(),
              });
            }}
          />
        </span>
      )}

      {/* ── Weekly controls ──────────────────────────────────────────────── */}
      {cPType === 'weekly' && (
        <span className={styles['ctrl-group']}>
          <select
            className={styles.fsel}
            value={cWeek}
            onChange={(e) => setPeriod({ cWeek: +e.target.value })}
          >
            <option value={1}>Week 1 (1–7)</option>
            <option value={2}>Week 2 (8–14)</option>
            <option value={3}>Week 3 (15–21)</option>
            <option value={4}>Week 4 (22–End)</option>
          </select>
          <select
            className={styles.fsel}
            value={cM}
            onChange={(e) => setPeriod({ cM: +e.target.value })}
          >
            {MS.slice(1).map((abbr, i) => (
              <option key={i + 1} value={i + 1}>{abbr}</option>
            ))}
          </select>
          <select
            className={styles.fsel}
            value={cY}
            onChange={(e) => setPeriod({ cY: +e.target.value })}
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
      )}

      {/* ── Monthly controls ─────────────────────────────────────────────── */}
      {cPType === 'monthly' && (
        <span className={styles['ctrl-group']}>
          <select
            className={styles.fsel}
            value={cM}
            onChange={(e) => setPeriod({ cM: +e.target.value })}
          >
            {MN.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            className={styles.fsel}
            value={cY}
            onChange={(e) => setPeriod({ cY: +e.target.value })}
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </span>
      )}

      {/* ── Quarterly controls ───────────────────────────────────────────── */}
      {cPType === 'quarterly' && (
        <span className={styles['ctrl-group']}>
          <select
            className={styles.fsel}
            value={cQ}
            onChange={(e) => setPeriod({ cQ: +e.target.value })}
          >
            <option value={1}>Q1 (Apr–Jun)</option>
            <option value={2}>Q2 (Jul–Sep)</option>
            <option value={3}>Q3 (Oct–Dec)</option>
            <option value={4}>Q4 (Jan–Mar)</option>
          </select>
          {/* sQY in the HTML — synced to cFY */}
          <select
            className={styles.fsel}
            value={cFY}
            onChange={(e) => setPeriod({ cFY: +e.target.value, cY: +e.target.value })}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                FY {y}–{String(y + 1).slice(2)}
              </option>
            ))}
          </select>
        </span>
      )}

      {/* ── Financial Year controls ──────────────────────────────────────── */}
      {cPType === 'fy' && (
        <span className={styles['ctrl-group']}>
          <select
            className={styles.fsel}
            value={cFY}
            onChange={(e) => setPeriod({ cFY: +e.target.value })}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                FY {y}–{String(y + 1).slice(2)}
              </option>
            ))}
          </select>
        </span>
      )}

      {/* ── Custom range controls ────────────────────────────────────────── */}
      {cPType === 'custom' && (
        <span className={styles['ctrl-group']}>
          <input
            type="month"
            className={`${styles.fsel} ${styles['fsel-month']}`}
            value={cDateFrom}
            onChange={(e) => setPeriod({ cDateFrom: e.target.value })}
          />
          <span className={styles['range-sep']}>to</span>
          <input
            type="month"
            className={`${styles.fsel} ${styles['fsel-month']}`}
            value={cDateTo}
            onChange={(e) => setPeriod({ cDateTo: e.target.value })}
          />
        </span>
      )}

      <div className={styles.fdiv} />

      {/* ── City filter ──────────────────────────────────────────────────── */}
      <select
        className={styles.fsel}
        value={cCi}
        onChange={(e) => setFilters({ cCi: e.target.value })}
      >
        <option value="all">All Cities</option>
        {cities.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>

      {/* ── Property filter ──────────────────────────────────────────────── */}
      <select
        className={styles.fsel}
        value={cPid}
        onChange={(e) => setFilters({ cPid: e.target.value })}
      >
        <option value="all">All Properties</option>
        {properties.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>

      {/* ── Commission filter ────────────────────────────────────────────── */}
      <select
        className={styles.fsel}
        value={cComm}
        onChange={(e) => setFilters({ cComm: e.target.value })}
      >
        <option value="all">All Commission</option>
        <option value="20">20%</option>
        <option value="25">25%</option>
        <option value="30">30%</option>
      </select>

      {/*
       * Period badge — mirrors pgBadge in the HTML.
       * In the HTML this is updated by updBadge() on every filter change.
       * Here it is derived reactively from store state.
       * Also imported by Topbar.tsx as <PeriodBadge /> to replace the
       * static "—" built in Run 2.
       */}
      {/* Badge is not rendered inside the PeriodBar itself — the Topbar
          renders it via <PeriodBadge />. If you also want it in the bar
          for debugging, uncomment:
          <span className={styles.plbl} style={{ marginLeft: 'auto' }}>
            {badgeText}
          </span>
      */}
      {/* Keep badgeText in scope so TS doesn't warn about unused var */}
      {void badgeText}
    </div>
  );
}
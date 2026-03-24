// src/hooks/usePeriod.ts
//
// Thin wrapper over the Zustand period store.
//
// Exports everything a component needs to read or update period/filter state,
// plus a convenience helper that calls getFReps() from src/lib/period.ts with
// the current store state — keeping all filtering logic in period.ts.

import { usePeriodStore } from '@/store/period';
import { getFReps } from '@/lib/period';
import type { PeriodState, FilterState, RepRow, PropLookup } from '@/lib/period';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePeriod() {
  // Read the full store slice. Zustand v5 — selector keeps re-renders granular.
  const store = usePeriodStore();

  // ── Period state (read) ───────────────────────────────────────────────────
  const periodState: PeriodState = {
    cPType:    store.cPType,
    cM:        store.cM,
    cY:        store.cY,
    cQ:        store.cQ,
    cFY:       store.cFY,
    cDateFrom: store.cDateFrom,
    cDateTo:   store.cDateTo,
    cDay:      store.cDay,
    cWeek:     store.cWeek,
  };

  // ── Filter state (read) ───────────────────────────────────────────────────
  const filterState: FilterState = {
    cCi:  store.cCi,
    cPid: store.cPid,
    cComm: store.cComm,
  };

  // ── Actions ───────────────────────────────────────────────────────────────
  const { setPeriod, setFilters, reset } = store;

  // ── Convenience: filter rep rows with current store state ─────────────────
  /**
   * Applies the current period and filter state to an array of report rows.
   *
   * @param reps     All report rows (from the server or API).
   * @param propById O(1) property lookup by pid — build from your property list:
   *                   const propMap = useMemo(() =>
   *                     Object.fromEntries(props.map(p => [p.id, p])), [props]);
   *                   const lookup = (pid: string) => propMap[pid] ?? null;
   */
  function getFilteredReps(
    reps: RepRow[],
    propById: (pid: string) => PropLookup | null,
  ): RepRow[] {
    return getFReps(reps, propById, periodState, filterState);
  }

  // ── Optional: filter with explicit m,y override (for trend loops) ─────────
  /**
   * Filter reps for a specific month/year regardless of the current period type.
   * Useful for chart components that loop over a 6-month rolling window.
   */
  function getFilteredRepsForMonth(
    reps: RepRow[],
    propById: (pid: string) => PropLookup | null,
    m: number,
    y: number,
  ): RepRow[] {
    return getFReps(reps, propById, periodState, filterState, m, y);
  }

  return {
    // State
    ...periodState,
    ...filterState,
    // Actions
    setPeriod,
    setFilters,
    reset,
    // Helpers
    getFilteredReps,
    getFilteredRepsForMonth,
  };
}
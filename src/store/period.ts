// src/store/period.ts
//
// ═══ PERIOD + FILTER STORE — SINGLE SOURCE OF TRUTH ═══
// Zustand v5 in-memory store. State shape exactly matches PeriodState and
// FilterState interfaces defined in src/lib/period.ts.
//
// Default values mirror the HTML source globals exactly:
//   cPType='monthly', cM=current month, cY=current year, cQ=1, cFY=FY start
//   (April of current or previous year per India FY convention), etc.
//
// ABSOLUTE RULE: Do NOT add persistence (localStorage, sessionStorage,
// IndexedDB, or any middleware that writes to storage). State is in-memory
// only per the v3 plan.

import { create } from 'zustand';
import type { PeriodState, FilterState, PeriodType } from '@/lib/period';

// ---------------------------------------------------------------------------
// Default value helpers — mirror the HTML's `const now = new Date()` block
// ---------------------------------------------------------------------------

function getDefaults(): PeriodState & FilterState {
  const now = new Date();
  const cM = now.getMonth() + 1;      // 1–12
  const cY = now.getFullYear();
  // India FY starts in April. If we're Jan–Mar the FY start is last year.
  const cFY = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  const cDay = `${cY}-${pad(cM)}-${pad(now.getDate())}`;

  return {
    // ── Period type ─────────────────────────────────────────────────────────
    cPType: 'monthly' as PeriodType,
    // ── Month / year (monthly + weekly mode) ────────────────────────────────
    cM,
    cY,
    // ── Quarter (India FY: Q1=Apr–Jun, Q2=Jul–Sep, Q3=Oct–Dec, Q4=Jan–Mar) ─
    cQ: 1,
    // ── Financial year start ─────────────────────────────────────────────────
    cFY,
    // ── Custom range ──────────────────────────────────────────────────────────
    cDateFrom: '',
    cDateTo: '',
    // ── Daily ────────────────────────────────────────────────────────────────
    cDay,
    // ── Weekly ───────────────────────────────────────────────────────────────
    cWeek: 1,
    // ── Filters ──────────────────────────────────────────────────────────────
    cCi: 'all',
    cPid: 'all',
    cComm: 'all',
  };
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface PeriodStore extends PeriodState, FilterState {
  /** Update any subset of period state fields */
  setPeriod: (partial: Partial<PeriodState>) => void;
  /** Update any subset of filter state fields */
  setFilters: (partial: Partial<FilterState>) => void;
  /** Reset everything back to defaults */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePeriodStore = create<PeriodStore>((set) => ({
  ...getDefaults(),

  setPeriod: (partial) => set((state) => ({ ...state, ...partial })),

  setFilters: (partial) => set((state) => ({ ...state, ...partial })),

  reset: () => set(getDefaults()),
}));
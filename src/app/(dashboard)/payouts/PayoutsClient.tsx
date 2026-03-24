'use client';
// src/app/(dashboard)/payouts/PayoutsClient.tsx
//
// Client Component. Renders the full Payout Ledger page.
//
// Period filtering: payout records have month/year fields (not a date string).
// The HTML's periodFilter() function maps cPType/cQ/cFY to month+year ranges.
// This is ported verbatim below as filterByPeriod().
//
// HTML source: rndPayouts(), togglePayStatus(), updPendingBadge()
//
// ─── SCHEMA NOTE ────────────────────────────────────────────────────────────
// HTML payout fields vs DB Payout model:
//   HTML.status    → derived: amount_paid IS NOT NULL → 'paid', else 'pending'
//   HTML.paidDate  → paid_on (DateTime @db.Date), serialised to YYYY-MM-DD
//   HTML.ref       → reference (String?) — added in add_phase6_fields migration
//   HTML.repId     → NOT IN SCHEMA — v1 omits this (links payout to report)
//   HTML.amount    → amount_owed (Decimal)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { usePeriod } from '@/hooks/usePeriod';
import { getFYMonths } from '@/lib/period';
import type { PeriodState } from '@/lib/period';
import { MetricCard, MetricCardGrid } from '@/components/ui/MetricCard';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import type { SerializablePayout } from './page';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20; // consistent with other tables

const MN = ['','January','February','March','April','May','June',
            'July','August','September','October','November','December'];

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const fIN = (n: number) => '₹' + Math.round(n || 0).toLocaleString('en-IN');
const fI  = (n: number) => {
  const v = Math.abs(n);
  if (v >= 100000) return (n < 0 ? '-' : '') + '₹' + (v / 100000).toFixed(1) + 'L';
  if (v >= 1000)   return (n < 0 ? '-' : '') + '₹' + (v / 1000).toFixed(0) + 'K';
  return (n < 0 ? '-' : '') + '₹' + Math.round(v);
};

// ---------------------------------------------------------------------------
// filterByPeriod — verbatim port of rndPayouts()'s periodFilter() from HTML
// Payouts have month/year (not a date string), so matchesPeriod() is not used.
// ---------------------------------------------------------------------------

const Q_MONTHS: Record<number, number[]> = {
  1: [4,5,6], 2: [7,8,9], 3: [10,11,12], 4: [1,2,3],
};

function filterByPeriod(
  pay: { month: number; year: number },
  period: PeriodState,
): boolean {
  const { cPType, cM, cY, cQ, cFY, cDateFrom, cDateTo } = period;
  switch (cPType) {
    case 'daily':
    case 'weekly':
    case 'monthly':
      return pay.month === cM && pay.year === cY;
    case 'quarterly': {
      const months = Q_MONTHS[cQ] ?? [];
      const yr = cQ === 4 ? cFY + 1 : cFY;
      return months.includes(pay.month) && pay.year === yr;
    }
    case 'fy': {
      const fyMonths = getFYMonths(cFY);
      return fyMonths.some((fm) => fm.month === pay.month && fm.year === pay.year);
    }
    case 'custom': {
      if (!cDateFrom && !cDateTo) return true;
      const pd   = pay.year * 100 + pay.month;
      const from = cDateFrom ? +(cDateFrom.replace('-', '')) || 0      : 0;
      const to   = cDateTo   ? +(cDateTo.replace('-', ''))   || 999999 : 999999;
      return pd >= from && pd <= to;
    }
    default:
      return pay.month === cM && pay.year === cY;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PayoutsClientProps {
  payouts: SerializablePayout[];
  /** All-time pending count (for Sidebar badge — passed as a prop) */
  totalPendingCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayoutsClient({
  payouts,
  totalPendingCount: initialPendingCount,
}: PayoutsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // ── Local state ───────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [invFilter,    setInvFilter]    = useState('all');
  const [page, setPage]                 = useState(1);

  // ── Period store ──────────────────────────────────────────────────────────
  const periodState = usePeriod();

  // ── Period-filtered (Pass 1 — for KPIs) ──────────────────────────────────
  const periodPays = useMemo(
    () => payouts.filter((p) => filterByPeriod(p, periodState as PeriodState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payouts, periodState.cPType, periodState.cM, periodState.cY,
     periodState.cQ, periodState.cFY, periodState.cDateFrom, periodState.cDateTo],
  );

  // ── Period + status + investor filter (Pass 2 — for table) ───────────────
  const filteredPays = useMemo(() => {
    let rows = [...periodPays];
    if (statusFilter !== 'all') rows = rows.filter((p) => p.status === statusFilter);
    if (invFilter    !== 'all') rows = rows.filter((p) => p.investorId === invFilter);
    return rows.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
  }, [periodPays, statusFilter, invFilter]);

  // ── KPI derivations (always from periodPays, verbatim from HTML) ──────────
  const totalPayable    = periodPays.reduce((s, p) => s + p.amountOwed, 0);
  const pendingAmount   = periodPays.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountOwed, 0);
  const paidAmount      = periodPays.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountOwed, 0);
  const pendingCount    = periodPays.filter((p) => p.status === 'pending').length;

  // All-time pending count (for the summary strip)
  const allTimePending  = payouts.filter((p) => p.status === 'pending').length;
  const allTimePendingAmt = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountOwed, 0);

  // ── Unique investors (for filter dropdown) ────────────────────────────────
  const uniqueInvestors = useMemo(() => {
    const seen = new Map<string, string>();
    payouts.forEach((p) => { if (!seen.has(p.investorId)) seen.set(p.investorId, p.investorName); });
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [payouts]);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredPays.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pagePays   = filteredPays.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Toggle status (Mark Paid / Revert to Pending) ─────────────────────────
  async function handleToggleStatus(pay: SerializablePayout) {
    if (pay.status === 'pending') {
      // Mark as paid — prompt for reference
      const ref = window.prompt('Enter payment reference / transaction ID (optional):', '') ?? null;
      if (ref === null) return; // user cancelled

      try {
        const res = await fetch(`/api/payouts/${pay.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status:    'paid',
            reference: ref,
            paidOn:    new Date().toISOString().split('T')[0],
          }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.error ?? 'Failed', 'er'); return; }
        toast('✓ Payout marked as paid', 'ok');
        startTransition(() => router.refresh());
      } catch { toast('Network error', 'er'); }
    } else {
      if (!window.confirm('Revert this payout to pending?')) return;
      try {
        const res = await fetch(`/api/payouts/${pay.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' }),
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.error ?? 'Failed', 'er'); return; }
        toast('↩ Payout reverted to pending', 'ok');
        startTransition(() => router.refresh());
      } catch { toast('Network error', 'er'); }
    }
  }

  async function handleDelete(pay: SerializablePayout) {
    if (!window.confirm('Delete this payout record? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/payouts/${pay.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.error ?? 'Failed to delete', 'er'); return; }
      toast('Payout deleted', 'er');
      startTransition(() => router.refresh());
    } catch { toast('Network error', 'er'); }
  }

  async function handleSyncFromReports() {
    try {
      const res = await fetch('/api/payouts/sync', { method: 'POST' });
      if (!res.ok) { toast('Sync failed — API not yet wired (Phase 6)', 'er'); return; }
      const data = await res.json();
      toast(`✓ ${data.count ?? 0} payouts synced from reports`, 'ok');
      startTransition(() => router.refresh());
    } catch { toast('Sync API not yet available (Phase 6)', 'in'); }
  }

  async function handleRecalcPending() {
    try {
      const res = await fetch('/api/payouts/recalc', { method: 'POST' });
      if (!res.ok) { toast('Recalc failed — API not yet wired (Phase 6)', 'er'); return; }
      const data = await res.json();
      toast(`✓ ${data.updated ?? 0} pending payouts recalculated`, 'ok');
      startTransition(() => router.refresh());
    } catch { toast('Recalc API not yet available (Phase 6)', 'in'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div className="stl" style={{ marginBottom: 0 }}>
          <div className="d" />Investor Payout Ledger
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Pending summary strip — verbatim colour logic */}
          <span
            id="pendingSummary"
            style={{
              background: allTimePending > 0 ? 'var(--rdp)' : 'var(--grp)',
              color:      allTimePending > 0 ? 'var(--rd)'  : 'var(--gr)',
              display:    allTimePending > 0 || payouts.length > 0 ? 'inline-flex' : 'none',
            }}
          >
            {allTimePending > 0
              ? `${allTimePending} Pending — ${fI(allTimePendingAmt)}`
              : 'All Paid ✓'}
          </span>
          <button className="btn btn-or btn-sm" onClick={handleSyncFromReports}>
            ↻ Sync from Reports
          </button>
          <button className="btn btn-g btn-sm" onClick={handleRecalcPending}>
            ♻ Recalculate Pending
          </button>
          <button className="btn btn-g btn-sm" onClick={() => toast('CSV export — Phase 6', 'in')}>
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI cards (verbatim from HTML payoutKpis) ────────────────────── */}
      <MetricCardGrid>
        <MetricCard label="Total Payable"    value={fI(totalPayable)}  sub="This period"                     iconText="₹" iconVariant="b" />
        <MetricCard label="Pending Payouts"  value={fI(pendingAmount)} sub={pendingCount + ' records'}       iconText="₹" iconVariant="r" />
        <MetricCard label="Total Paid"       value={fI(paidAmount)}    sub="This period"                     iconText="₹" iconVariant="g" />
        <MetricCard label="Payout Records"   value={String(payouts.length)} sub="All time"                   iconText="₹" iconVariant="o" />
      </MetricCardGrid>

      {/* ── Payout table ─────────────────────────────────────────────────── */}
      <div className="tw">
        <div className="th">
          <div>
            <div className="ct">Payout Records</div>
            <div className="cs" id="payoutSubtitle">
              {filteredPays.length} record{filteredPays.length !== 1 ? 's' : ''}{totalPages > 1 ? ` | Showing ${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE,filteredPays.length)}` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Status filter */}
            <select
              className="fsel"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as 'all'|'pending'|'paid'); setPage(1); }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
            {/* Investor filter */}
            <select
              className="fsel"
              value={invFilter}
              onChange={(e) => { setInvFilter(e.target.value); setPage(1); }}
            >
              <option value="all">All Investors</option>
              {uniqueInvestors.map((inv) => (
                <option key={inv.id} value={inv.id}>{inv.name}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredPays.length === 0 ? (
          <div style={{ padding: '40px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>💳</div>
            <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: 'var(--tx)' }}>
              {payouts.length === 0 ? 'No Payout Records Yet' : 'No Records Match'}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--t3)', marginBottom: '16px' }}>
              {payouts.length === 0
                ? 'Reports are saved automatically — payouts generate on save. Or click Sync to catch up.'
                : 'No records match the current filter.'}
            </div>
            {payouts.length === 0 && (
              <button className="btn btn-or btn-sm" onClick={handleSyncFromReports}>
                ↻ Sync from Reports
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              {/* Table columns — verbatim from HTML thead */}
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Investor</th>
                    <th>Property</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Paid On</th>
                    <th>Reference</th>
                    <th>Notes</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pagePays.map((pay) => {
                    const isPaid = pay.status === 'paid';
                    return (
                      <tr key={pay.id}>
                        <td>{MN[pay.month] ?? '?'} {pay.year}</td>
                        <td>
                          <div style={{ fontSize: '13px', fontWeight: 600 }}>
                            {pay.investorName}
                          </div>
                        </td>
                        <td>
                          {pay.propertyName}
                          {pay.propertyCity && (
                            <div style={{ fontSize: '10.5px', color: 'var(--t3)' }}>
                              {pay.propertyCity}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 800, color: 'var(--bl)' }}>
                          {fIN(pay.amountOwed)}
                        </td>
                        <td>
                          <span className={`pill ${isPaid ? 'g' : 'r'}`}>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--t3)' }}>
                          {pay.paidOn ?? '—'}
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--t2)' }}>
                          {pay.reference ?? '—'}
                        </td>
                        <td style={{ fontSize: '11px', color: 'var(--t3)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {pay.notes ?? ''}
                        </td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {/* Toggle status — verbatim green/grey button logic */}
                          {isPaid ? (
                            <button
                              className="btn btn-g btn-sm"
                              title="Undo"
                              onClick={() => handleToggleStatus(pay)}
                            >
                              ↩
                            </button>
                          ) : (
                            <button
                              className="btn btn-gr btn-sm"
                              onClick={() => handleToggleStatus(pay)}
                            >
                              ✓ Paid
                            </button>
                          )}
                          <button
                            className="btn btn-rd btn-sm"
                            title="Delete"
                            onClick={() => handleDelete(pay)}
                            style={{ marginLeft: '4px' }}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <Pagination
                total={filteredPays.length}
                page={safePage}
                pageSize={PAGE_SIZE}
                onChange={(p) => setPage(p)}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}
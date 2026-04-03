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

import { useState, useMemo, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { usePeriod } from '@/hooks/usePeriod';
import { usePageFilters } from '@/hooks/usePageFilters';
import { downloadCsv } from '@/lib/csvDownload';
import { PageFilterBar } from '@/components/layout/PageFilterBar';
import type { FilterOption } from '@/components/layout/PageFilterBar';
import { getFYMonths } from '@/lib/period';
import type { PeriodState } from '@/lib/period';
import { MetricCard, MetricCardGrid } from '@/components/ui/MetricCard';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import type { SerializablePayout } from './page';
import styles from '@/components/ui/ui.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20; // consistent with other tables

const MN = ['','January','February','March','April','May','June',
            'July','August','September','October','November','December'];

// ---------------------------------------------------------------------------
// Formatting helpers — full precision with 2 decimal places
// ---------------------------------------------------------------------------

const fIN = (n: number) =>
  '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fI  = (n: number) => {
  const num = Number(n) || 0;
  const v = Math.abs(num);
  if (v >= 100000) return (num < 0 ? '-' : '') + '₹' + (v / 100000).toFixed(2) + 'L';
  if (v >= 1000)   return (num < 0 ? '-' : '') + '₹' + (v / 1000).toFixed(2) + 'K';
  return (num < 0 ? '-' : '') + '₹' + v.toFixed(2);
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayoutsClient({
  payouts,
}: PayoutsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // ── Local state ───────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // Pay modal — replaces window.prompt for payment reference entry
  const [payModal, setPayModal]   = useState<{ id: string; investorName: string; amount: number } | null>(null);
  const [payRef,   setPayRef]     = useState('');
  const [isPaying, setIsPaying]   = useState(false);

  // ── Period store + per-page filters ───────────────────────────────────────
  const periodState = usePeriod();
  const filters = usePageFilters({ investor: true, status: true, property: true });

  // ── Period-filtered (Pass 1 — for KPIs) ──────────────────────────────────
  const periodPays = useMemo(
    () => payouts.filter((p) => filterByPeriod(p, periodState as PeriodState)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payouts, periodState.cPType, periodState.cM, periodState.cY,
     periodState.cQ, periodState.cFY, periodState.cDateFrom, periodState.cDateTo],
  );

  // ── Unique investors for filter dropdown ──────────────────────────────────
  // Group by name+contact so the same person investing in multiple properties
  // appears only once in the dropdown.
  const uniqueInvestors = useMemo(() => {
    const seen = new Map<string, string>(); // groupKey → display name
    payouts.forEach((p) => {
      const key = `${p.investorName.trim()}||${(p.investorContact ?? '').trim()}`;
      if (!seen.has(key)) seen.set(key, p.investorName);
    });
    return [...seen.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [payouts]);

  const investorOptions: FilterOption[] = useMemo(
    () => uniqueInvestors.map((i) => ({ value: i.key, label: i.name })),
    [uniqueInvestors],
  );

  const propertyOptions: FilterOption[] = useMemo(() => {
    const seen = new Map<string, string>(); // id → name
    payouts.forEach((p) => { if (!seen.has(p.propertyId)) seen.set(p.propertyId, p.propertyName); });
    return [...seen.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payouts]);

  const statusOptions: FilterOption[] = [
    { value: 'pending', label: 'Pending' },
    { value: 'paid',    label: 'Paid'    },
  ];

  // ── Period + status + investor filter (Pass 2 — for table) ───────────────
  const filteredPays = useMemo(() => {
    let rows = [...periodPays];
    if (filters.status !== 'all') rows = rows.filter((p) => p.status === filters.status);
    if (filters.investor !== 'all') {
      // filters.investor is the groupKey (name||contact) — match all records for this person
      rows = rows.filter((p) => {
        const key = `${p.investorName.trim()}||${(p.investorContact ?? '').trim()}`;
        return key === filters.investor;
      });
    }
    if (filters.property !== 'all') rows = rows.filter((p) => p.propertyId === filters.property);
    return rows.sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
  }, [periodPays, filters.status, filters.investor, filters.property]);

  // Reset to page 1 whenever filtered results change
  useEffect(() => { setPage(1); }, [filteredPays.length]);

  // ── KPI derivations (always from periodPays) ──────────────────────────────
  const totalPayable    = periodPays.reduce((s, p) => s + p.amountOwed, 0);
  const pendingAmount   = periodPays.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountOwed, 0);
  const paidAmount      = periodPays.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amountOwed, 0);
  const pendingCount    = periodPays.filter((p) => p.status === 'pending').length;

  // All-time pending count (for the summary strip)
  const allTimePending    = payouts.filter((p) => p.status === 'pending').length;
  const allTimePendingAmt = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amountOwed, 0);

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredPays.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pagePays   = filteredPays.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Toggle status (Mark Paid / Revert to Pending) ─────────────────────────
  function handleMarkPaid(pay: SerializablePayout) {
    setPayRef('');
    setPayModal({ id: pay.id, investorName: pay.investorName, amount: pay.amountOwed });
  }

  async function confirmMarkPaid() {
    if (!payModal) return;
    setIsPaying(true);
    try {
      const res = await fetch(`/api/payouts/${payModal.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status:    'paid',
          reference: payRef.trim() || null,
          paidOn:    new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.error ?? 'Failed', 'er'); return; }
      toast('✓ Payout marked as paid', 'ok');
      setPayModal(null);
      startTransition(() => router.refresh());
    } catch { toast('Network error', 'er'); }
    finally { setIsPaying(false); }
  }

  async function handleRevertPending(pay: SerializablePayout) {
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

  async function handleDelete(pay: SerializablePayout) {
    if (!window.confirm('Delete this payout record? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/payouts/${pay.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast(err.error ?? 'Failed to delete', 'er'); return; }
      toast('✓ Payout deleted', 'ok');
      startTransition(() => router.refresh());
    } catch { toast('Network error', 'er'); }
  }

  async function handleSyncFromReports() {
    try {
      const res = await fetch('/api/payouts/sync', { method: 'POST' });
      if (!res.ok) { toast('Sync failed — please try again', 'er'); return; }
      const data = await res.json();
      toast(`✓ ${data.count ?? 0} payouts synced from reports`, 'ok');
      startTransition(() => router.refresh());
    } catch { toast('Sync failed — network error', 'er'); }
  }

  async function handleRecalcPending() {
    try {
      const res = await fetch('/api/payouts/recalc', { method: 'POST' });
      if (!res.ok) { toast('Recalculate failed — please try again', 'er'); return; }
      const data = await res.json();
      toast(`✓ ${data.updated ?? 0} pending payouts recalculated`, 'ok');
      startTransition(() => router.refresh());
    } catch { toast('Recalculate failed — network error', 'er'); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-hdr">
        <div className="stl" style={{ marginBottom: 0 }}>
          <div className="d" />Investor Payout Ledger
        </div>
        <div className="page-hdr-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {(allTimePending > 0 || payouts.length > 0) && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span style={{ background: allTimePending > 0 ? 'var(--rdp)' : 'var(--grp)', color: allTimePending > 0 ? 'var(--rd)' : 'var(--gr)', display: 'inline-flex', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>
                {allTimePending > 0 ? `${allTimePending} Pending (all-time) — ${fIN(allTimePendingAmt)}` : 'All Paid ✓'}
              </span>
              {pendingCount > 0 && pendingCount !== allTimePending && (
                <span style={{ fontSize: '10.5px', color: 'var(--t3)' }}>{pendingCount} pending in this period</span>
              )}
            </div>
          )}
          <button className="btn btn-or btn-sm" onClick={handleSyncFromReports}>↻ Sync from Reports</button>
          <button className="btn btn-g btn-sm" onClick={handleRecalcPending}>♻ Recalculate Pending</button>
          <button className="btn btn-g btn-sm" onClick={() => {
            downloadCsv(
              ['Period', 'Investor', 'Property', 'City', 'Amount Owed', 'Status', 'Paid On', 'Reference', 'Notes'],
              filteredPays.map((p) => [
                `${MN[p.month] ?? '?'} ${p.year}`, p.investorName, p.propertyName,
                p.propertyCity || '', String(p.amountOwed),
                p.status === 'paid' ? 'Paid' : 'Pending',
                p.paidOn ?? '', p.reference ?? '', p.notes ?? '',
              ]),
              `mg-payouts-${new Date().toISOString().slice(0, 10)}.csv`,
            );
          }}>↓ CSV</button>
          <button className="btn btn-or btn-sm" onClick={async () => {
            const { exportTablePdf } = await import('@/components/layout/exportPdf');
            await exportTablePdf({
              title: 'Investor Payout Ledger',
              headers: ['Period', 'Investor', 'Property', 'Amount Owed', 'Status', 'Paid On', 'Reference', 'Notes'],
              rows: filteredPays.map((p) => [
                `${MN[p.month] ?? '?'} ${p.year}`, p.investorName,
                p.propertyCity ? `${p.propertyName}, ${p.propertyCity}` : p.propertyName,
                'Rs. ' + p.amountOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                p.status === 'paid' ? 'Paid' : 'Pending',
                p.paidOn ?? '—', p.reference ?? '—', p.notes ?? '—',
              ]),
              filename: `mg-payouts-${new Date().toISOString().slice(0, 10)}.pdf`,
            });
          }}>↓ PDF</button>
        </div>
      </div>

      <PageFilterBar
        filters={filters}
        config={{ investor: true, status: true, property: true }}
        investors={investorOptions}
        statuses={statusOptions}
        properties={propertyOptions}
      />

      {/* ── KPI cards ────────────────────────────────────────────────────── */}
      <MetricCardGrid>
        <MetricCard label="Total Payable"    value={fI(totalPayable)}  sub="This period"              iconText="₹" iconVariant="b" />
        <MetricCard label="Pending Payouts"  value={fI(pendingAmount)} sub={pendingCount + ' records'} iconText="₹" iconVariant="r" />
        <MetricCard label="Total Paid"       value={fI(paidAmount)}    sub="This period"              iconText="₹" iconVariant="g" />
        <MetricCard label="Payout Records"   value={String(payouts.length)} sub="All time"            iconText="₹" iconVariant="o" />
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
                          {/* Toggle status */}
                          {isPaid ? (
                            <button
                              className="btn btn-g btn-sm"
                              title="Revert to pending"
                              onClick={() => handleRevertPending(pay)}
                            >
                              ↩
                            </button>
                          ) : (
                            <button
                              className="btn btn-gr btn-sm"
                              onClick={() => handleMarkPaid(pay)}
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

      {/* ── Pay confirmation modal — uses standard .ov/.modal classes ────────── */}
      <div
        className={`${styles.ov}${payModal ? ' ' + styles.open : ''}`}
        onClick={(e) => { if (e.target === e.currentTarget) setPayModal(null); }}
      >
        <div className={styles.modal} style={{ width: '380px' }}>
          <button className={styles['mc-x']} onClick={() => setPayModal(null)} disabled={isPaying}>✕</button>
          <div className={styles.mt}>Mark Payout as Paid</div>
          <div className={styles.ms}>
            {payModal?.investorName} — {payModal ? fIN(payModal.amount) : ''}
          </div>

          <div className={styles.fl} style={{ marginBottom: '16px' }}>
            <label className={styles.label}>Payment Reference / UTR (optional)</label>
            <input
              className={styles.fi}
              type="text"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isPaying && confirmMarkPaid()}
              placeholder="e.g. UTR123456789"
              autoFocus={!!payModal}
            />
          </div>

          <div className={styles.mf}>
            <button
              className={`${styles.mb} ${styles.can}`}
              onClick={() => setPayModal(null)}
              disabled={isPaying}
            >
              Cancel
            </button>
            <button
              className={`${styles.mb} ${styles.sub}`}
              onClick={confirmMarkPaid}
              disabled={isPaying}
            >
              {isPaying ? 'Saving…' : '✓ Confirm Paid'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
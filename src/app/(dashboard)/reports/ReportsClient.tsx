'use client';
// src/app/(dashboard)/reports/ReportsClient.tsx
//
// Client Component. Two sections, pixel-matched to the HTML:
//
//  1. Collapsible report list (toggleRepList + rndReports)
//     - Period-filtered, sorted newest-first, paginated (PAGE_SIZE=20)
//     - Rows: property name + period, KPI meta line, 👁 snapshot + ↓ CSV
//     - Snapshot opens a DetailPanel with the full calcF() output
//
//  2. Generate Reports card grid (6 export-type cards)
//     - Each calls POST /api/exports — wired in Phase 6 API layer
//
// Monthly Entry is now a standalone page at /monthlyentry.
// All MonthlyEntryModal state, the canMonthlyEntry prop, MonthlyEntryModalTrigger,
// and the window.__openMonthlyEntry global have been removed from this file.

import { useState, useMemo } from 'react';
import { usePeriod } from '@/hooks/usePeriod';
import type { RepRow } from '@/lib/period';
import { Pagination } from '@/components/ui/Pagination';
import { DetailPanel } from '@/components/ui/DetailPanel';
import type { SerializableReport } from '../dashboard/page';
import type { SerializableProperty } from '../properties/page';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20; // verbatim from HTML

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fIN(n: number) {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

const MN = ['','January','February','March','April','May','June',
            'July','August','September','October','November','December'];

// ---------------------------------------------------------------------------
// Export card config — verbatim from the HTML card grid
// ---------------------------------------------------------------------------

const EXPORT_CARDS = [
  { icon: '📅', title: 'Monthly Report',  sub: 'All properties for selected month',    type: 'monthly',  btnClass: 'btn btn-or' },
  { icon: '🏠', title: 'Property-wise',   sub: 'Individual breakdown per property',    type: 'property', btnClass: 'btn btn-or' },
  { icon: '📈', title: 'Annual Report',   sub: 'Full year summary',                    type: 'annual',   btnClass: 'btn btn-or' },
  { icon: '🏦', title: 'Investor Report', sub: 'ROI & payout breakdown',               type: 'investor', btnClass: 'btn btn-or' },
  { icon: '🏙️', title: 'Consolidated',   sub: 'Multi-property combined',              type: 'monthly',  btnClass: 'btn btn-or' },
  { icon: '📊', title: 'Raw Data',        sub: 'Full data for spreadsheet',            type: 'raw',      btnClass: 'btn btn-g'  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportsClientProps {
  reports: SerializableReport[];
  properties: SerializableProperty[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReportsClient({
  reports,
  properties,
}: ReportsClientProps) {
  const { getFilteredReps } = usePeriod();

  // ── Local state ───────────────────────────────────────────────────────────
  const [listOpen, setListOpen]         = useState(false);
  const [page, setPage]                 = useState(1);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotRep, setSnapshotRep]   = useState<SerializableReport | null>(null);

  // ── Property lookup ───────────────────────────────────────────────────────
  const propMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p])),
    [properties],
  );

  // ── Period-filtered + sorted reports ─────────────────────────────────────
  const filteredReps = useMemo(
    // SerializableReport is structurally compatible with RepRow (same fields,
    // minus the optional _autoGen flag). Cast is safe.
    () => getFilteredReps(reports as RepRow[], () => null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports],
  );

  const sortedReps = useMemo(
    () => [...filteredReps].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month)),
    [filteredReps],
  );

  const totalPages = Math.max(1, Math.ceil(sortedReps.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = sortedReps.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // ── Toggle list — verbatim toggleRepList() ────────────────────────────────
  function handleToggleList() {
    if (!listOpen) setPage(1);
    setListOpen((v) => !v);
  }

  // ── Export — calls /api/exports (Phase 6) ─────────────────────────────────
  async function handleExport(type: string) {
    try {
      const res = await fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) {
        alert('Export failed — API not yet wired (Phase 6)');
        return;
      }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `mg-${type}-export.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export API not yet available — wired in Phase 6.');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══ Section 1: Collapsible Report List ════════════════════════════ */}
      <div
        className="stl"
        style={{ cursor: 'pointer', userSelect: 'none' }}
        onClick={handleToggleList}
      >
        <div className="d" />
        <span style={{ marginRight: '4px' }}>{listOpen ? '▼' : '▶'}</span>
        Auto-Generated Reports{' '}
        <span style={{ fontSize: '10px', color: 'var(--t3)', fontWeight: 400 }}>
          ({filteredReps.length} for current period)
        </span>
      </div>

      {listOpen && (
        <div className="tw" style={{ marginBottom: '16px' }}>
          <div className="th">
            <div className="ct">Filtered by current period</div>
          </div>

          {sortedReps.length === 0 ? (
            <div className="es" style={{ margin: '16px', borderRadius: 'var(--r)' }}>
              <div className="es-ico">📄</div>
              <div className="es-t">No Reports for This Period</div>
              <div className="es-s">
                Change the period filter or add bookings/expenses.
              </div>
            </div>
          ) : (
            <>
              {/* Report rows — verbatim from rndReports() */}
              {paginated.map((r) => {
                const prop = propMap[r.pid];
                return (
                  <div key={r.id} className="rrow">
                    <div className="rico">📄</div>
                    <div className="rinfo">
                      <div className="rname">
                        {prop?.name ?? 'Unknown'} — {MN[r.month]} {r.year}
                      </div>
                      <div className="rmeta">
                        Rev: {fIN(r.rev)} · Exp: {fIN(r.exp)} · Profit: {fIN(r.opProfit)} · Occ: {r.occ ?? 0}% · ROI: {r.roi ?? 0}%
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexShrink: 0 }}>
                      <button
                        className="btn btn-g btn-sm"
                        title="View snapshot"
                        onClick={() => { setSnapshotRep(r); setSnapshotOpen(true); }}
                      >
                        👁
                      </button>
                      <button
                        className="btn btn-g btn-sm"
                        title="Export CSV"
                        onClick={() => handleExport('property')}
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}

              {totalPages > 1 && (
                <Pagination
                  total={sortedReps.length}
                  page={safePage}
                  pageSize={PAGE_SIZE}
                  onChange={(p) => setPage(p)}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ══ Section 2: Generate Reports ═══════════════════════════════════ */}
      <div className="stl"><div className="d" />Generate Reports</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '11px' }}>
        {EXPORT_CARDS.map((card) => (
          <div key={card.title} className="cc" style={{ textAlign: 'center', padding: '22px 16px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>{card.icon}</div>
            <div style={{ fontSize: '13.5px', fontWeight: 700, marginBottom: '3px' }}>
              {card.title}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t3)', marginBottom: '14px' }}>
              {card.sub}
            </div>
            <button
              className={card.btnClass}
              style={{ width: '100%' }}
              onClick={() => handleExport(card.type)}
            >
              Select &amp; Export
            </button>
          </div>
        ))}
      </div>

      {/* ══ Report Snapshot Detail Panel ═══════════════════════════════════ */}
      <DetailPanel
        isOpen={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        title={snapshotRep ? (propMap[snapshotRep.pid]?.name ?? 'Report') : 'Report'}
        sub={
          snapshotRep
            ? `${MN[snapshotRep.month]} ${snapshotRep.year} — Report Snapshot`
            : ''
        }
      >
        {snapshotRep && (
          <ReportSnapshot rep={snapshotRep} propMap={propMap} />
        )}
      </DetailPanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// ReportSnapshot — verbatim port of showReportSnapshot() panel body
// ---------------------------------------------------------------------------

function ReportSnapshot({
  rep,
  propMap,
}: {
  rep: SerializableReport;
  propMap: Record<string, SerializableProperty>;
}) {
  const prop = propMap[rep.pid];

  const KPI_ROWS = [
    { l: 'Revenue',                           v: fIN(rep.rev),          c: 'var(--tx)' },
    { l: 'Expenses',                          v: fIN(rep.exp),          c: 'var(--rd)' },
    { l: 'Op. Profit',                        v: fIN(rep.opProfit),     c: 'var(--gr)' },
    { l: `Commission (${prop?.comm ?? 25}%)`, v: fIN(rep.commission),   c: 'var(--or)' },
    { l: 'Investor Net',                      v: fIN(rep.invProfit),    c: 'var(--bl)' },
    { l: 'Occupancy',                         v: (rep.occ ?? 0) + '%', c: 'var(--go)' },
    { l: 'ROI',                               v: (rep.roi ?? 0) + '%', c: 'var(--or)' },
    { l: 'ADR',                               v: fIN(rep.adr ?? 0),    c: 'var(--tx)' },
    { l: 'RevPAR',                            v: fIN(rep.revpar ?? 0), c: 'var(--gr)' },
  ];

  return (
    <>
      {/* Period header */}
      <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '12px' }}>
        {prop?.name ?? 'Unknown'} — {MN[rep.month]} {rep.year}
      </div>

      {/* KPI grid */}
      <div className="dp-kpi" style={{ marginBottom: '14px' }}>
        {KPI_ROWS.map((k) => (
          <div key={k.l} className="dp-k">
            <div className="dp-kl">{k.l}</div>
            <div className="dp-kv" style={{ color: k.c }}>{k.v}</div>
          </div>
        ))}
      </div>

      {/* Expense breakdown */}
      {rep.expCats && Object.keys(rep.expCats).length > 0 && (
        <div style={{ background: 'var(--rdp)', borderRadius: '9px', padding: '11px 13px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rd)', marginBottom: '7px' }}>
            EXPENSE BREAKDOWN
          </div>
          {Object.entries(rep.expCats)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                <span>{k.replace(/-/g, ' ')}</span>
                <span style={{ fontWeight: 600 }}>{fIN(v)}</span>
              </div>
            ))}
        </div>
      )}

      {/* Channel breakdown */}
      {rep.channels && Object.keys(rep.channels).length > 0 && (() => {
        const totN = Object.values(rep.channels).reduce((s, v) => s + v, 0);
        return (
          <div style={{ background: 'var(--grp)', borderRadius: '9px', padding: '11px 13px', marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr)', marginBottom: '7px' }}>
              BOOKING CHANNELS
            </div>
            {Object.entries(rep.channels)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>{k}</span>
                  <span style={{ fontWeight: 600 }}>
                    {v} nights
                    {totN > 0 ? ` (${((v / totN) * 100).toFixed(0)}%)` : ''}
                  </span>
                </div>
              ))}
          </div>
        );
      })()}
    </>
  );
}
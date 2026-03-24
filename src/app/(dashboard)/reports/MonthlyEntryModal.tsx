'use client';
// src/app/(dashboard)/reports/MonthlyEntryModal.tsx
//
// Monthly Data Entry modal. Pixel-matches the HTML monthlyModal exactly.
// Channels: Airbnb, Booking.com, MakeMyTrip, Direct, Goibibo, OYO, Other
// Expense categories: free-text rows, dynamic add/remove.
//
// On save → POST /api/monthly-entry
// The API (Phase 6) creates one Booking per channel and one DailyExpense
// per category in a single transaction, then triggers report regeneration.
//
// Source: <div class="ov" id="monthlyModal"> + saveMonthlyBulk() + initMmModal()

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { usePeriod } from '@/hooks/usePeriod';
import styles from '@/components/ui/ui.module.css';
import type { SerializableProperty } from '../properties/page';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChannelRow {
  id: number;
  name: string;
  nights: string;
  revenue: string;
}

interface ExpCatRow {
  id: number;
  category: string;
  amount: string;
}

// Verbatim channel options from addMmChannel() in the HTML
const CHANNEL_OPTS = [
  'Airbnb', 'Booking.com', 'MakeMyTrip', 'Direct',
  'Goibibo', 'OYO', 'Other',
];

// Default expense categories from initMmModal()
const DEFAULT_EXP_CATS = ['Rent', 'Electricity', 'Cleaning', 'Maintenance'];

const MS_OPTS = [
  { v: 1,  l: 'Jan' }, { v: 2,  l: 'Feb' }, { v: 3,  l: 'Mar' },
  { v: 4,  l: 'Apr' }, { v: 5,  l: 'May' }, { v: 6,  l: 'Jun' },
  { v: 7,  l: 'Jul' }, { v: 8,  l: 'Aug' }, { v: 9,  l: 'Sep' },
  { v: 10, l: 'Oct' }, { v: 11, l: 'Nov' }, { v: 12, l: 'Dec' },
];

const YEARS = (() => {
  const cy = new Date().getFullYear();
  return Array.from({ length: 11 }, (_, i) => cy - 5 + i);
})();

function fIN(n: number) {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MonthlyEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  properties: SerializableProperty[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthlyEntryModal({
  isOpen,
  onClose,
  properties,
}: MonthlyEntryModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { cM, cY } = usePeriod();

  const [pid, setPid]               = useState('');
  const [month, setMonth]           = useState(cM);
  const [year, setYear]             = useState(cY);
  const [channels, setChannels]     = useState<ChannelRow[]>([]);
  const [expCats, setExpCats]       = useState<ExpCatRow[]>([]);
  const [counter, setCounter]       = useState(0);
  const [isSaving, setIsSaving]     = useState(false);
  const [validation, setValidation] = useState<string[]>([]);

  // ── Init on open — verbatim initMmModal() ────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    setMonth(cM);
    setYear(cY);
    setPid(properties[0]?.id ?? '');
    let c = 0;
    setChannels([
      { id: ++c, name: 'Airbnb', nights: '', revenue: '' },
      { id: ++c, name: 'Direct', nights: '', revenue: '' },
    ]);
    setExpCats(
      DEFAULT_EXP_CATS.map((cat) => ({ id: ++c, category: cat, amount: '' })),
    );
    setCounter(c);
    setValidation([]);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live totals ───────────────────────────────────────────────────────────
  const totRev    = channels.reduce((s, c) => s + (parseFloat(c.revenue) || 0), 0);
  const totNights = channels.reduce((s, c) => s + (parseInt(c.nights)   || 0), 0);
  const totExp    = expCats.reduce( (s, c) => s + (parseFloat(c.amount)  || 0), 0);

  // ── Validation (verbatim updMmTotals() warnings) ─────────────────────────
  useEffect(() => {
    const warns: string[] = [];
    if (totRev > 0 && totNights <= 0)
      warns.push('Revenue entered but no nights — add nights per channel');
    setValidation(warns);
  }, [totRev, totNights]);

  // ── Channel helpers ───────────────────────────────────────────────────────
  function addChannel() {
    const id = counter + 1;
    setCounter(id);
    setChannels((prev) => [...prev, { id, name: 'Airbnb', nights: '', revenue: '' }]);
  }

  function updateChannel(id: number, field: keyof ChannelRow, value: string) {
    setChannels((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  function removeChannel(id: number) {
    setChannels((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Expense category helpers ──────────────────────────────────────────────
  function addExpCat() {
    const id = counter + 1;
    setCounter(id);
    setExpCats((prev) => [...prev, { id, category: '', amount: '' }]);
  }

  function updateExpCat(id: number, field: keyof ExpCatRow, value: string) {
    setExpCats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  function removeExpCat(id: number) {
    setExpCats((prev) => prev.filter((c) => c.id !== id));
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!pid) { toast('Select a property', 'er'); return; }
    if (!totRev && !totExp) { toast('Enter revenue or expense data', 'er'); return; }

    const validChannels = channels.filter((c) => (parseFloat(c.revenue) || 0) > 0);
    const validExpCats  = expCats.filter(
      (c) => c.category.trim() && (parseFloat(c.amount) || 0) > 0,
    );

    setIsSaving(true);
    try {
      const res = await fetch('/api/monthly-entry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: pid,
          month,
          year,
          channels: validChannels.map((c) => ({
            name:    c.name,
            nights:  parseInt(c.nights)    || 0,
            revenue: parseFloat(c.revenue) || 0,
          })),
          expCats: validExpCats.map((c) => ({
            category: c.category.trim(),
            amount:   parseFloat(c.amount) || 0,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'Failed to save monthly data', 'er');
        return;
      }

      const MS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      toast(
        `✓ Monthly data saved for ${MS[month]} ${year} — ` +
        `${validChannels.length} channels, ${validExpCats.length} expense categories`,
        'ok',
      );
      onClose();
      router.refresh();
    } catch {
      toast('Network error — please try again', 'er');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Monthly Data Entry"
      subtitle="Add full month data — revenue channels + expense categories"
      size="wide"
    >
      {/* Property + Month */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>Property *</label>
          <select
            className={styles.fs}
            value={pid}
            onChange={(e) => setPid(e.target.value)}
          >
            {properties.length === 0
              ? <option value="">No properties — add one first</option>
              : properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
          </select>
        </div>
        <div className={styles.fl}>
          <label>Month *</label>
          <select
            className={styles.fs}
            value={month}
            onChange={(e) => setMonth(+e.target.value)}
          >
            {MS_OPTS.map((m) => (
              <option key={m.v} value={m.v}>{m.l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Year */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>Year *</label>
          <select
            className={styles.fs}
            value={year}
            onChange={(e) => setYear(+e.target.value)}
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className={styles.fl}>
          <label style={{ color: 'var(--t3)' }}>Booking Period</label>
          <div style={{ fontSize: '12px', color: 'var(--t3)', padding: '9px 0' }}>
            Auto-set to {String(month).padStart(2, '0')}/{year}
          </div>
        </div>
      </div>

      {/* ── Revenue — Channel Breakdown ─────────────────────────────────── */}
      <div style={{ background: 'var(--grp)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr)' }}>
            REVENUE — CHANNEL BREAKDOWN
          </div>
          <button
            type="button"
            className="btn btn-g btn-sm"
            onClick={addChannel}
            style={{ fontSize: '10px', padding: '3px 8px' }}
          >
            + Channel
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr 1fr auto', gap: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--t3)', paddingBottom: '4px' }}>
          <span>Channel</span><span>Nights</span><span>Revenue ₹</span><span />
        </div>

        {channels.map((ch) => (
          <div key={ch.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr .8fr 1fr auto', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
            <select
              className={styles.fs}
              style={{ fontSize: '11px', padding: '5px 7px' }}
              value={ch.name}
              onChange={(e) => updateChannel(ch.id, 'name', e.target.value)}
            >
              {CHANNEL_OPTS.map((o) => <option key={o}>{o}</option>)}
            </select>
            <input
              className={styles.fi}
              type="number"
              placeholder="0"
              value={ch.nights}
              onChange={(e) => updateChannel(ch.id, 'nights', e.target.value)}
              style={{ fontSize: '11px', padding: '5px 7px' }}
            />
            <input
              className={styles.fi}
              type="number"
              placeholder="0"
              value={ch.revenue}
              onChange={(e) => updateChannel(ch.id, 'revenue', e.target.value)}
              style={{ fontSize: '11px', padding: '5px 7px' }}
            />
            <button
              type="button"
              className="btn btn-rd btn-sm"
              onClick={() => removeChannel(ch.id)}
              style={{ padding: '3px 6px', fontSize: '10px' }}
            >
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', fontWeight: 700, paddingTop: '6px', borderTop: '1px solid rgba(22,163,74,.15)' }}>
          <span>Total:</span>
          <span style={{ color: 'var(--t2)' }}>{totNights} nights</span>
          <span style={{ color: 'var(--gr)' }}>{fIN(totRev)}</span>
          <span />
        </div>
      </div>

      {/* ── Expenses — Category Breakdown ──────────────────────────────── */}
      <div style={{ background: 'var(--rdp)', borderRadius: '9px', padding: '12px', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--rd)' }}>
            EXPENSES — CATEGORY BREAKDOWN
          </div>
          <button
            type="button"
            className="btn btn-g btn-sm"
            onClick={addExpCat}
            style={{ fontSize: '10px', padding: '3px 8px' }}
          >
            + Category
          </button>
        </div>

        {/* Column headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '4px', fontSize: '10px', fontWeight: 600, color: 'var(--t3)', paddingBottom: '4px' }}>
          <span>Category</span><span>Amount ₹</span><span />
        </div>

        {expCats.map((ec) => (
          <div key={ec.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr auto', gap: '4px', marginBottom: '4px', alignItems: 'center' }}>
            <input
              className={styles.fi}
              placeholder="e.g. Rent, Cleaning"
              value={ec.category}
              onChange={(e) => updateExpCat(ec.id, 'category', e.target.value)}
              style={{ fontSize: '11px', padding: '5px 7px' }}
            />
            <input
              className={styles.fi}
              type="number"
              placeholder="0"
              value={ec.amount}
              onChange={(e) => updateExpCat(ec.id, 'amount', e.target.value)}
              style={{ fontSize: '11px', padding: '5px 7px' }}
            />
            <button
              type="button"
              className="btn btn-rd btn-sm"
              onClick={() => removeExpCat(ec.id)}
              style={{ padding: '3px 6px', fontSize: '10px' }}
            >
              ✕
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', fontWeight: 700, paddingTop: '6px', borderTop: '1px solid rgba(220,38,38,.15)' }}>
          <span>Total Expenses:</span>
          <span style={{ color: 'var(--rd)' }}>{fIN(totExp)}</span>
          <span />
        </div>
      </div>

      {/* Validation — verbatim updMmTotals() warnings */}
      {validation.length > 0 && (
        <div style={{ background: 'var(--gop)', border: '1px solid var(--go)', borderRadius: '8px', padding: '8px 12px', marginBottom: '12px', fontSize: '11px', color: 'var(--go)' }}>
          {validation.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {/* Footer */}
      <div className={styles.mf}>
        <button
          type="button"
          className={`${styles.mb} ${styles.can}`}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.mb} ${styles.sub}`}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save Monthly Data'}
        </button>
      </div>
    </Modal>
  );
}
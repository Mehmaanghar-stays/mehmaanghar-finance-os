'use client';
// src/app/(dashboard)/bookings/BookingsClient.tsx
//
// Client Component. Period filtering uses matchesPeriod() on check_in date
// (same approach as Daily Expenses — client-side, v2 gets URL-sync).
//
// HTML source: rndBookings(), saveBooking(), editBooking(), delBooking()

import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { usePeriod } from '@/hooks/usePeriod';
import { matchesPeriod } from '@/lib/period';
import type { PeriodState } from '@/lib/period';
import { MetricCard, MetricCardGrid } from '@/components/ui/MetricCard';
import { Pagination } from '@/components/ui/Pagination';
import { useToast } from '@/components/ui/Toast';
import { BookingModal } from './BookingModal';
import type { BookingFormValues, BookingSavePayload } from './BookingModal';
import type { SerializableProperty } from '../properties/page';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50; // verbatim _bkPage from HTML

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
// Types
// ---------------------------------------------------------------------------

export interface SerializableBooking {
  id: string;
  pid: string;
  propertyName: string;
  guestId: string | null;
  guestName: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;  // YYYY-MM-DD
  nights: number;
  revenue: number;
  platform: string;
  status: string;
  notes: string | null;
  bookingType: string;  // 'stay' | 'event' — defaults 'stay' until schema migrated
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BookingsClientProps {
  bookings: SerializableBooking[];
  properties: SerializableProperty[];
  guestNames: string[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BookingsClient({
  bookings,
  properties,
  guestNames,
  canCreate,
  canEdit,
  canDelete,
}: BookingsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  // ── Local state ───────────────────────────────────────────────────────────
  const [propFilter, setPropFilter] = useState('all');
  const [srcFilter,  setSrcFilter]  = useState('all');
  const [page, setPage]             = useState(1);
  const [modalOpen, setModalOpen]   = useState(false);
  const [editId, setEditId]         = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<BookingFormValues>>();
  const [isSaving, setIsSaving]     = useState(false);

  // ── Period store ──────────────────────────────────────────────────────────
  const periodState = usePeriod();

  // ── Property lookup ───────────────────────────────────────────────────────
  const propMap = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p])),
    [properties],
  );

  // ── Unique sources for filter dropdown ───────────────────────────────────
  const uniqueSources = useMemo(() => {
    const s = new Set(bookings.map((b) => b.platform).filter(Boolean));
    return [...s].sort();
  }, [bookings]);

  // ── Period + local filter ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    // matchesPeriod on checkIn — same pattern as Daily Expenses (Run 13)
    let bks = bookings.filter((b) => matchesPeriod(b.checkIn, periodState as PeriodState));
    if (propFilter !== 'all') bks = bks.filter((b) => b.pid === propFilter);
    if (srcFilter  !== 'all') bks = bks.filter((b) => b.platform === srcFilter);
    // Sort: newest check-in first — verbatim b.checkIn.localeCompare(a.checkIn)
    return [...bks].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, propFilter, srcFilter,
      periodState.cPType, periodState.cM, periodState.cY, periodState.cQ,
      periodState.cFY, periodState.cDateFrom, periodState.cDateTo,
      periodState.cDay, periodState.cWeek]);

  // ── KPI derivations — verbatim from HTML ─────────────────────────────────
  const totalRev     = filtered.reduce((s, b) => s + b.revenue, 0);
  const totalNights  = filtered.reduce((s, b) => s + b.nights, 0);
  const uniqueGuests = new Set(filtered.map((b) => b.guestId ?? b.guestName)).size;
  const avgPerNight  = totalNights > 0 ? Math.round(totalRev / totalNights) : 0;

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const overflow   = filtered.length > PAGE_SIZE;

  // ── Add / edit ────────────────────────────────────────────────────────────
  function handleAdd() {
    setEditId(null);
    setEditValues(undefined);
    setModalOpen(true);
  }

  function handleEdit(b: SerializableBooking) {
    setEditId(b.id);
    setEditValues({
      pid:        b.pid,
      source:     b.platform,
      guestName:  b.guestName,
      checkIn:    b.checkIn,
      checkOut:   b.checkOut,
      nights:     b.nights,
      roomAmount: String(b.revenue),
      notes:      b.notes ?? '',
      bookingType: (b.bookingType as 'stay' | 'event') || 'stay',
    });
    setModalOpen(true);
  }

  async function handleSave(payload: BookingSavePayload, id: string | null) {
    setIsSaving(true);
    try {
      const res = await fetch(
        id ? `/api/bookings/${id}` : '/api/bookings',
        {
          method:  id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'Failed to save booking', 'er');
        return;
      }
      toast(
        `✓ Booking ${fIN(payload.revenue)} saved — ${payload.guestName} (${payload.nights} nights)`,
        'ok',
      );
      setModalOpen(false);
      startTransition(() => router.refresh());
    } catch {
      toast('Network error — please try again', 'er');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(b: SerializableBooking) {
    if (!window.confirm('Delete this booking? Guest stats and reports will be recalculated.')) return;
    try {
      const res = await fetch(`/api/bookings/${b.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err.error ?? 'Failed to delete booking', 'er');
        return;
      }
      toast('✓ Booking deleted — reports recalculated', 'ok');
      startTransition(() => router.refresh());
    } catch {
      toast('Network error — please try again', 'er');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="page-hdr">
        <div className="stl" style={{ marginBottom: 0 }}>
          <div className="d" />Bookings
        </div>
        {canCreate && (
          <button className="btn btn-or btn-sm" onClick={handleAdd}>+ Add Booking</button>
        )}
      </div>

      {/* ── 4 KPI cards — verbatim from bookKpis HTML ────────────────────── */}
      <MetricCardGrid>
        <MetricCard label="Period Revenue" value={fI(totalRev)}       sub="Total booking revenue" iconText="₹" iconVariant="g" />
        <MetricCard label="Nights"         value={String(totalNights)} sub="Total booked nights"  iconText="🌙" iconVariant="o" />
        <MetricCard label="Guests"         value={String(uniqueGuests)} sub="Unique guests"       iconText="👤" iconVariant="b" />
        <MetricCard label="Avg/Night"      value={fI(avgPerNight)}     sub="Average per night"   iconText="₹" iconVariant="b" />
      </MetricCardGrid>

      {/* ── Table card ───────────────────────────────────────────────────── */}
      <div className="tw">
        <div className="th">
          <div className="ct" id="bookTitle">Booking Log</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* Property filter */}
            <select className="fsel" value={propFilter} onChange={(e) => { setPropFilter(e.target.value); setPage(1); }}>
              <option value="all">All Properties</option>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {/* Source filter */}
            <select className="fsel" value={srcFilter} onChange={(e) => { setSrcFilter(e.target.value); setPage(1); }}>
              <option value="all">All Sources</option>
              {uniqueSources.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)' }}>
            No bookings for this period. Change the View By filter or add a booking.
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              {/* Table columns — verbatim from HTML thead */}
              <table>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Property</th>
                    <th>Guest</th>
                    <th>Nights</th>
                    <th>Source</th>
                    <th>Amount</th>
                    {(canEdit || canDelete) && <th />}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((b) => {
                    const isEvent = b.bookingType === 'event';
                    return (
                      <tr key={b.id}>
                        <td>
                          {b.checkIn}
                          {b.checkOut && b.checkOut !== b.checkIn ? ` → ${b.checkOut}` : ''}
                        </td>
                        <td>{b.propertyName}</td>
                        <td>
                          {isEvent && (
                            <span className="pill o" style={{ fontSize: '9px', marginRight: '4px' }}>Event</span>
                          )}
                          {b.guestName}
                        </td>
                        <td>{b.nights || 0}</td>
                        <td><span className="pill b">{b.platform}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--gr)' }}>
                          {fIN(b.revenue || 0)}
                        </td>
                        {(canEdit || canDelete) && (
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {canEdit && (
                              <button className="btn btn-g btn-sm" onClick={() => handleEdit(b)}>✏️</button>
                            )}
                            {canDelete && (
                              <button className="btn btn-rd btn-sm" onClick={() => handleDelete(b)} style={{ marginLeft: '4px' }}>🗑</button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination or overflow notice */}
            {overflow && totalPages > 1 ? (
              <Pagination total={filtered.length} page={safePage} pageSize={PAGE_SIZE} onChange={(p) => setPage(p)} />
            ) : overflow ? (
              <div style={{ padding: '10px 16px', fontSize: '11.5px', color: 'var(--t3)', textAlign: 'center', borderTop: '1px solid var(--bdr)' }}>
                Showing {PAGE_SIZE} of {filtered.length} bookings. Use filters to narrow results.
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Add/Edit modal ─────────────────────────────────────────────────── */}
      <BookingModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        editId={editId}
        initialValues={editValues}
        properties={properties}
        guestNames={guestNames}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </>
  );
}
'use client';
// src/app/(dashboard)/dailyexp/DailyExpModal.tsx
//
// Add/Edit Daily Expense modal. Pixel-matches the HTML dexpModal exactly.
// Fields: Property, Date, Category (10 options), Amount, Notes.
//
// Invoice upload: the HTML has no file upload in dexpModal (only the
// invoice icon in the table triggers a future signed-URL fetch).
// Upload UI is future scope per v3 plan Section 3.1.
//
// Source: <div class="ov" id="dexpModal"> + saveDailyExp() + editDailyExp()

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import styles from '@/components/ui/ui.module.css';
import type { SerializableProperty } from '../properties/page';

// ---------------------------------------------------------------------------
// Constants — verbatim from the HTML dexpModal select options
// ---------------------------------------------------------------------------

export const DAILY_EXP_CATS: Array<{ value: string; label: string }> = [
  { value: 'cleaning',     label: 'Cleaning'      },
  { value: 'electricity',  label: 'Electricity'   },
  { value: 'water',        label: 'Water'         },
  { value: 'internet',     label: 'Internet/WiFi' },
  { value: 'rent',         label: 'Rent'          },
  { value: 'maintenance',  label: 'Maintenance'   },
  { value: 'supplies',     label: 'Supplies'      },
  { value: 'staff',        label: 'Staff Salary'  },
  { value: 'laundry',      label: 'Laundry'       },
  { value: 'other',        label: 'Other'         },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyExpFormValues {
  pid: string;
  date: string;
  category: string;
  amount: string;
  note: string;
}

export interface DailyExpSavePayload {
  propertyId: string;
  expenseDate: string;  // YYYY-MM-DD
  category: string;
  amount: number;
  description: string;
}

interface DailyExpModalProps {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
  initialValues?: Partial<DailyExpFormValues>;
  properties: SerializableProperty[];
  onSave: (payload: DailyExpSavePayload, editId: string | null) => Promise<void>;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// Blank default
// ---------------------------------------------------------------------------

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

const BLANK: DailyExpFormValues = {
  pid: '', date: todayStr(), category: 'cleaning', amount: '', note: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DailyExpModal({
  isOpen,
  onClose,
  editId,
  initialValues,
  properties,
  onSave,
  isSaving,
}: DailyExpModalProps) {
  const [form, setForm] = useState<DailyExpFormValues>(BLANK);
  const [monthBadge, setMonthBadge] = useState('');

  const MN = ['','January','February','March','April','May','June',
               'July','August','September','October','November','December'];

  useEffect(() => {
    if (isOpen) {
      const init: DailyExpFormValues = {
        ...BLANK,
        date: todayStr(),
        pid:  properties[0]?.id ?? '',
        ...initialValues,
      };
      setForm(init);
      updateMonthBadge(init.date);
    }
  }, [isOpen, initialValues]); // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: keyof DailyExpFormValues, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'date') updateMonthBadge(value);
  }

  function updateMonthBadge(dateStr: string) {
    if (!dateStr) { setMonthBadge(''); return; }
    const d = new Date(dateStr);
    setMonthBadge('→ ' + MN[d.getMonth() + 1] + ' ' + d.getFullYear());
  }

  async function handleSubmit() {
    if (!form.pid)                        return;
    if (!form.date)                       return;
    if (!form.amount || +form.amount <= 0) return;
    await onSave({
      propertyId:  form.pid,
      expenseDate: form.date,
      category:    form.category,
      amount:      parseFloat(form.amount),
      description: form.note.trim(),
    }, editId);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Daily Expense"
      subtitle="Record an operational expense"
    >
      {/* Property + Date row */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>Property *</label>
          <select
            className={styles.fs}
            value={form.pid}
            onChange={(e) => set('pid', e.target.value)}
          >
            {properties.length === 0 ? (
              <option value="">No properties</option>
            ) : (
              properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))
            )}
          </select>
        </div>
        <div className={styles.fl}>
          <label>Date *</label>
          <input
            className={styles.fi}
            type="date"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
          />
          {/* Month badge — verbatim from #deMonthBadge */}
          {monthBadge && (
            <div style={{ fontSize: '10.5px', color: 'var(--or)', fontWeight: 600, marginTop: '3px' }}>
              {monthBadge}
            </div>
          )}
        </div>
      </div>

      {/* Category + Amount row */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>Category *</label>
          <select
            className={styles.fs}
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {DAILY_EXP_CATS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.fl}>
          <label>Amount (₹) *</label>
          <input
            className={styles.fi}
            type="number"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Notes */}
      <div className={styles.fl}>
        <label>Notes</label>
        <input
          className={styles.fi}
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          placeholder="Optional note"
        />
      </div>

      {/* Invoice upload — future scope per v3 plan Section 3.1 */}
      {/* The icon (🧾) in the table will eventually fetch a signed URL on click */}

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
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : 'Save Expense'}
        </button>
      </div>
    </Modal>
  );
}
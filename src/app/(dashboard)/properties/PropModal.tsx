'use client';
// src/app/(dashboard)/properties/PropModal.tsx
//
// Add/Edit Property modal. Pixel-matches the HTML propModal exactly:
//   - Name, City (with datalist), State (select), Comm % (with custom option)
//   - Address, Capital Invested
//   - Saved Assets — dynamic rows (+ Add Asset button)
//   - Cancel / Save buttons
//
// Saved Assets: security deposits, rent advances, furniture.
// NOT included in ROI. Stored as JSON on the property record.

import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import styles from '@/components/ui/ui.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssetRow {
  id: number;      // local key for React rendering only
  name: string;
  amount: number;
  type: 'refundable' | 'recoverable';
}

export interface PropertyFormValues {
  name: string;
  city: string;
  state: string;
  comm: string;      // "20" | "25" | "30" | "custom"
  commCustom: string;
  address: string;
  capital: string;
  assets: AssetRow[];
}

export interface PropertySavePayload {
  name: string;
  city: string;
  state: string;
  /** Resolved number, e.g. 25 */
  comm: number;
  address: string;
  capital: number;
  assets: Array<{ name: string; amount: number; type: string }>;
}

interface PropModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** null = add mode, string = edit mode (property id) */
  editId: string | null;
  /** Pre-filled values when editing */
  initialValues?: Partial<PropertyFormValues>;
  onSave: (payload: PropertySavePayload, editId: string | null) => Promise<void>;
  isSaving: boolean;
}

// ---------------------------------------------------------------------------
// State → City mapping. Add new states as additional entries here.
// ---------------------------------------------------------------------------

const STATE_CITIES: Record<string, string[]> = {
  Maharashtra: [
    'Mumbai', 'Pune', 'Nashik', 'Nagpur', 'Aurangabad',
    'Thane', 'Lonavala', 'Mahabaleshwar', 'Kolhapur', 'Satara',
  ],
  'Uttar Pradesh': [
    'Lucknow', 'Agra', 'Varanasi', 'Kanpur', 'Noida',
    'Ghaziabad', 'Mathura', 'Allahabad', 'Meerut', 'Aligarh',
  ],
  Goa: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  Delhi: ['New Delhi', 'Dwarka', 'Rohini', 'Lajpat Nagar', 'Connaught Place'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi'],
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem'],
  Telangana: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam'],
  Rajasthan: ['Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bikaner'],
  Gujarat: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Rishikesh', 'Nainital', 'Mussoorie'],
  'Himachal Pradesh': ['Shimla', 'Manali', 'Dharamshala', 'Kullu', 'Solan'],
  'West Bengal': ['Kolkata', 'Howrah', 'Durgapur', 'Siliguri', 'Asansol'],
  Punjab: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda'],
  Haryana: ['Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Karnal'],
  'Madhya Pradesh': ['Bhopal', 'Indore', 'Gwalior', 'Jabalpur', 'Ujjain'],
};

const STATES = Object.keys(STATE_CITIES).sort();

// ---------------------------------------------------------------------------
// Default blank form
// ---------------------------------------------------------------------------

const BLANK: PropertyFormValues = {
  name: '', city: '', state: '', comm: '25', commCustom: '',
  address: '', capital: '', assets: [],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropModal({
  isOpen, onClose, editId, initialValues, onSave, isSaving,
}: PropModalProps) {
  const [form, setForm] = useState<PropertyFormValues>(BLANK);
  const [assetCounter, setAssetCounter] = useState(0);

  // Sync form when edit values arrive
  useEffect(() => {
    if (isOpen) {
      setForm(initialValues ? { ...BLANK, ...initialValues } : BLANK);
    }
  }, [isOpen, initialValues]);

  function set(field: keyof PropertyFormValues, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  // When state changes, clear city so user picks from the new state's list
  function handleStateChange(newState: string) {
    setForm((f) => ({ ...f, state: newState, city: '' }));
  }

  // Cities available for the currently selected state
  const availableCities = form.state ? (STATE_CITIES[form.state] ?? []) : [];

  // ── Asset rows ────────────────────────────────────────────────────────────

  function addAsset() {
    const id = assetCounter + 1;
    setAssetCounter(id);
    setForm((f) => ({
      ...f,
      assets: [...f.assets, { id, name: '', amount: 0, type: 'refundable' }],
    }));
  }

  function updateAsset(id: number, field: keyof AssetRow, value: string | number) {
    setForm((f) => ({
      ...f,
      assets: f.assets.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    }));
  }

  function removeAsset(id: number) {
    setForm((f) => ({ ...f, assets: f.assets.filter((a) => a.id !== id) }));
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const resolvedComm =
      form.comm === 'custom'
        ? parseFloat(form.commCustom) || 25
        : parseInt(form.comm);

    const payload: PropertySavePayload = {
      name: form.name.trim(),
      city: form.city.trim(),
      state: form.state,
      comm: resolvedComm,
      address: form.address.trim(),
      capital: parseFloat(form.capital) || 0,
      assets: form.assets
        .filter((a) => a.name && a.amount > 0)
        .map(({ name, amount, type }) => ({ name, amount, type })),
    };

    await onSave(payload, editId);
  }

  // ── Asset total ───────────────────────────────────────────────────────────

  const assetTotal = form.assets
    .filter((a) => a.name && a.amount > 0)
    .reduce((s, a) => s + a.amount, 0);

  const fIN = (n: number) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editId ? 'Edit Property' : 'Add Property'}
      subtitle="Create or update a property in the system"
    >
      {/* Property Name */}
      <div className={styles.fl}>
        <label>Property Name *</label>
        <input
          className={styles.fi}
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Andheri West Studio 2BHK"
        />
      </div>

      {/* State + City row — State first, City auto-populates from selected state */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>State *</label>
          <select
            className={styles.fs}
            value={form.state}
            onChange={(e) => handleStateChange(e.target.value)}
          >
            <option value="">Select State</option>
            {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className={styles.fl}>
          <label>City *</label>
          {availableCities.length > 0 ? (
            <select
              className={styles.fs}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
            >
              <option value="">Select City</option>
              {availableCities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input
              className={styles.fi}
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder={form.state ? 'Type city name' : 'Select a state first'}
              disabled={!form.state}
            />
          )}
        </div>
      </div>

      {/* Commission % */}
      <div className={styles.fg}>
        <div className={styles.fl}>
          <label>Commission % *</label>
          <select
            className={styles.fs}
            value={form.comm}
            onChange={(e) => set('comm', e.target.value)}
          >
            <option value="20">20%</option>
            <option value="25">25%</option>
            <option value="30">30%</option>
            <option value="custom">Custom…</option>
          </select>
        </div>
        {form.comm === 'custom' && (
          <div className={styles.fl}>
            <label>Custom %</label>
            <input
              className={styles.fi}
              type="number"
              value={form.commCustom}
              onChange={(e) => set('commCustom', e.target.value)}
              placeholder="e.g. 22"
              min={1}
              max={99}
            />
          </div>
        )}
      </div>

      {/* Address */}
      <div className={styles.fl}>
        <label>Address</label>
        <input
          className={styles.fi}
          value={form.address}
          onChange={(e) => set('address', e.target.value)}
          placeholder="Full address"
        />
      </div>

      {/* Capital Invested */}
      <div style={{ border: '1.5px solid var(--bdr)', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: 'var(--bg)' }}>
        <div className={styles.fl} style={{ marginBottom: '8px' }}>
          <label style={{ fontWeight: 700, fontSize: '12.5px' }}>💰 Capital Invested (₹)</label>
          <input
            className={styles.fi}
            type="number"
            value={form.capital}
            onChange={(e) => set('capital', e.target.value)}
            placeholder="e.g. 1000000"
            style={{ marginTop: '4px' }}
          />
        </div>
        <div style={{ fontSize: '10px', color: 'var(--t3)' }}>
          Used for ROI calculation. This is the actual money invested.
        </div>
      </div>

      {/* Saved Assets */}
      <div style={{ border: '1.5px solid var(--bdr)', borderRadius: '10px', padding: '12px', marginBottom: '12px', background: 'var(--bg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <label style={{ fontWeight: 700, fontSize: '12.5px' }}>
            💼 Saved Assets <span style={{ fontWeight: 400, fontSize: '10.5px', color: 'var(--t3)' }}>(Recoverable)</span>
          </label>
          <button type="button" className="btn btn-g btn-sm" onClick={addAsset}>+ Add Asset</button>
        </div>
        <div style={{ fontSize: '10px', color: 'var(--t3)', marginBottom: '8px' }}>
          Security deposits, rent advances, furniture — recoverable capital. NOT included in ROI.
        </div>

        {/* Asset rows */}
        {form.assets.map((asset) => (
          <div key={asset.id} style={{ display: 'grid', gridTemplateColumns: '1fr 110px 120px 28px', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
            <input
              className={styles.fi}
              value={asset.name}
              onChange={(e) => updateAsset(asset.id, 'name', e.target.value)}
              placeholder="Asset name"
            />
            <input
              className={styles.fi}
              type="number"
              value={asset.amount || ''}
              onChange={(e) => updateAsset(asset.id, 'amount', parseFloat(e.target.value) || 0)}
              placeholder="₹ Amount"
            />
            <select
              className={styles.fs}
              value={asset.type}
              onChange={(e) => updateAsset(asset.id, 'type', e.target.value as 'refundable' | 'recoverable')}
            >
              <option value="refundable">Refundable</option>
              <option value="recoverable">Recoverable</option>
            </select>
            <button
              type="button"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--rd)', fontSize: '14px' }}
              onClick={() => removeAsset(asset.id)}
            >
              ✕
            </button>
          </div>
        ))}

        {/* Asset total summary */}
        {assetTotal > 0 && (
          <div style={{ fontSize: '11.5px', padding: '8px', background: 'var(--s2)', borderRadius: '8px', marginTop: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--bl)' }}>
              <span>Total Secured Assets</span>
              <span>{fIN(assetTotal)}</span>
            </div>
            <div style={{ fontSize: '9.5px', color: 'var(--t3)', marginTop: '3px' }}>
              Recoverable — not included in ROI or expenses.
            </div>
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className={styles.mf}>
        <button type="button" className={`${styles.mb} ${styles.can}`} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={`${styles.mb} ${styles.sub}`}
          onClick={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? 'Saving…' : editId ? 'Update Property' : 'Save Property'}
        </button>
      </div>
    </Modal>
  );
}
'use client';
// src/components/ui/PropertyCombobox.tsx
//
// Searchable combobox for property selection.
// Replaces plain <select> elements wherever properties need to be chosen.
//
// Two usage modes:
//
//   A) Filter mode (PageFilterBar, UtilsClient inline filter)
//      value = property id | 'all'
//      Has an "All Properties" option at the top.
//      onChange(value: string) → 'all' or property id
//
//   B) Form mode (modals — BookingModal, DailyExpModal, UtilModal, MonthlyEntry)
//      value = property id | ''
//      No "All" option. Can be required.
//      onChange(value: string) → property id
//
// Keyboard:
//   ↓ / ↑  — navigate options
//   Enter   — select highlighted option
//   Escape  — close without changing
//   Type    — filters the list instantly
//
// Closes on outside click via useEffect.

import { useState, useEffect, useRef, useCallback } from 'react';

export interface PropertyOption {
  value: string;  // property id
  label: string;  // property name
  sub?:  string;  // optional city/sub-label
}

interface PropertyComboboxProps {
  options:      PropertyOption[];
  value:        string;             // current selected value
  onChange:     (v: string) => void;
  allLabel?:    string;             // if provided → show "All X" at top (filter mode)
  placeholder?: string;            // input placeholder when nothing selected
  className?:   string;            // outer wrapper class
  inputClass?:  string;            // class on the text input
  disabled?:    boolean;
  /** Minimum characters before filtering kicks in — default 0 (filter immediately) */
  minChars?:    number;
  /** Explicit width for the trigger button e.g. '160px' — defaults to auto */
  width?:       string;
}

export function PropertyCombobox({
  options,
  value,
  onChange,
  allLabel,
  placeholder,
  className,
  inputClass,
  disabled = false,
  minChars = 0,
  width,
}: PropertyComboboxProps) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [cursor,  setCursor]  = useState(-1);

  const wrapRef   = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const listRef   = useRef<HTMLUListElement>(null);

  // ── Derive display label from current value ─────────────────────────────
  const selectedLabel = value === 'all' || value === ''
    ? ''
    : options.find((o) => o.value === value)?.label ?? '';

  // ── Filtered option list ─────────────────────────────────────────────────
  const filtered = query.length >= minChars && query.trim()
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase()) ||
        (o.sub ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : options;

  // ── Close on outside click ───────────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        setCursor(-1);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Scroll highlighted item into view ───────────────────────────────────
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('li[role="option"]');
      if (items[cursor]) {
        (items[cursor] as HTMLElement).scrollIntoView({ block: 'nearest' });
      }
    }
  }, [cursor]);

  // ── Handlers ────────────────────────────────────────────────────────────
  function openDropdown() {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setCursor(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function selectOption(val: string) {
    onChange(val);
    setOpen(false);
    setQuery('');
    setCursor(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Total items = allLabel option (1 if present) + filtered items
    const total = (allLabel ? 1 : 0) + filtered.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cursor < 0) return;
      if (allLabel && cursor === 0) {
        selectOption('all');
      } else {
        const idx = allLabel ? cursor - 1 : cursor;
        if (filtered[idx]) selectOption(filtered[idx].value);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
      setCursor(-1);
    }
  }

  // ── Displayed text in the trigger button ─────────────────────────────────
  const triggerText = value === 'all'
    ? (allLabel ?? 'All Properties')
    : selectedLabel || (placeholder ?? 'Select property…');

  const isPlaceholder = !value || value === 'all' || !selectedLabel;

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', display: 'inline-block', width: width ?? 'auto' }}
      className={className}
    >
      {/* ── Trigger button ────────────────────────────────────────────────── */}
      {!open ? (
        <button
          type="button"
          onClick={openDropdown}
          disabled={disabled}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px',
            width: '100%',
            border: '1.5px solid var(--bdr)',
            borderRadius: '8px',
            padding: inputClass ? '8px 30px 8px 11px' : '6px 28px 6px 10px',
            fontSize: inputClass ? '13px' : '12.5px',
            fontFamily: "'Sora', sans-serif",
            color: isPlaceholder ? 'var(--t3)' : 'var(--tx)',
            backgroundColor: disabled ? 'var(--bg2)' : '#fff',
            cursor: disabled ? 'not-allowed' : 'pointer',
            outline: 'none',
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E\")",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 9px center',
            transition: 'border-color .14s',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {triggerText}
          </span>
        </button>
      ) : (
        /* ── Search input (replaces trigger when open) ────────────────── */
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setCursor(-1); }}
          onKeyDown={handleKeyDown}
          placeholder={`Search…`}
          style={{
            display: 'block',
            width: '100%',
            border: '1.5px solid var(--or)',
            borderRadius: '8px',
            padding: inputClass ? '8px 11px' : '6px 10px',
            fontSize: inputClass ? '13px' : '12.5px',
            fontFamily: "'Sora', sans-serif",
            color: 'var(--tx)',
            backgroundColor: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* ── Dropdown list ─────────────────────────────────────────────────── */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 9999,
            minWidth: '100%',
            maxWidth: '320px',
            maxHeight: '220px',
            overflowY: 'auto',
            background: '#fff',
            border: '1.5px solid var(--bdr)',
            borderRadius: '9px',
            boxShadow: '0 4px 16px rgba(0,0,0,.10)',
            padding: '4px',
            margin: 0,
            listStyle: 'none',
          }}
        >
          {/* "All X" option — filter mode only */}
          {allLabel && (
            <li
              role="option"
              aria-selected={value === 'all'}
              onMouseDown={(e) => { e.preventDefault(); selectOption('all'); }}
              onMouseEnter={() => setCursor(0)}
              style={{
                padding: '7px 10px',
                borderRadius: '6px',
                fontSize: '12.5px',
                cursor: 'pointer',
                color: cursor === 0 ? '#fff' : value === 'all' ? 'var(--or)' : 'var(--t2)',
                background: cursor === 0 ? 'var(--or)' : value === 'all' ? 'var(--orp)' : 'transparent',
                fontWeight: value === 'all' ? 600 : 400,
              }}
            >
              {allLabel}
            </li>
          )}

          {/* Filtered options */}
          {filtered.length === 0 ? (
            <li style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--t3)' }}>
              No properties found
            </li>
          ) : (
            filtered.map((opt, i) => {
              const idx = allLabel ? i + 1 : i;
              const isSelected = opt.value === value;
              const isHighlighted = cursor === idx;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => { e.preventDefault(); selectOption(opt.value); }}
                  onMouseEnter={() => setCursor(idx)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    color: isHighlighted ? '#fff' : isSelected ? 'var(--or)' : 'var(--tx)',
                    background: isHighlighted ? 'var(--or)' : isSelected ? 'var(--orp)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {opt.sub && (
                    <span style={{
                      fontSize: '10.5px',
                      color: isHighlighted ? 'rgba(255,255,255,.75)' : 'var(--t3)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}>
                      {opt.sub}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

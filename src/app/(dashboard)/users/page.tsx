'use client';
// src/app/(dashboard)/users/page.tsx
//
// User Management + Role Permissions panel — SuperAdmin only.
// Rendered inside the standard (dashboard) layout (Sidebar + Topbar + PeriodBar).
// Access enforced by proxy.ts + getRolePermissions() — non-SuperAdmin roles
// receive tabPerms['users'] !== true and are redirected by the Server Component
// wrapper. This Client Component never renders for non-SuperAdmin users.
//
// Two sections:
//   1. User Management — create users + list all users (unchanged from Phase 7)
//   2. Role Permissions — visual matrix for SuperAdmin to view/edit per-tab
//      and per-CRUD permissions for each role, without code changes
//
// ─── API ROUTE OBSERVATION ──────────────────────────────────────────────────
// GET  /api/roles  → { roles: [{ id, name, tab_permissions, crud_permissions, … }] }
// PATCH /api/roles → body: { id, tab_permissions?, crud_permissions? }
//   Field names are snake_case — matching the Prisma column names.
//   The prompt referenced "PUT /api/roles" but the actual route is PATCH.
//   Using PATCH as implemented — the route is not changed.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import styles from '@/components/ui/ui.module.css';
import type { TabKey, CrudAction } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  username: string;
  role: { name: string };
  created_at: string;
}

/** Full role row including permission JSON columns from GET /api/roles. */
interface RoleRow {
  id: string;
  name: string;
  tab_permissions: Record<TabKey, boolean>;
  crud_permissions: Record<TabKey, Record<CrudAction, boolean>>;
}

// ---------------------------------------------------------------------------
// Constants — sourced from permissions.ts TabKey type
// ---------------------------------------------------------------------------

const ALL_TAB_KEYS: TabKey[] = [
  'dashboard',
  'cashflow',
  'properties',
  'investors',
  'reports',
  'insights',
  'expenses',
  'payouts',
  'bookings',
  'crm',
  'dailyexp',
  'utils',
  'users',
];

/** Human-readable labels — matches Sidebar nav labels. */
const TAB_LABELS: Record<TabKey, string> = {
  dashboard:  'Dashboard',
  cashflow:   'Cash Flow',
  properties: 'Properties',
  investors:  'Investors',
  reports:    'Reports',
  insights:   'Smart Insights',
  expenses:   'Expense Intel',
  payouts:    'Payout Ledger',
  bookings:   'Bookings',
  crm:        'Guest CRM',
  dailyexp:   'Daily Expenses',
  utils:      'Rent & Utilities',
  users:      'User Management',
};

const CRUD_ACTIONS: CrudAction[] = ['read', 'create', 'update', 'delete'];

const CRUD_LABELS: Record<CrudAction, string> = {
  read:   'Read',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
  const { toast } = useToast();

  const [users,        setUsers]        = useState<UserRow[]>([]);
  const [roles,        setRoles]        = useState<RoleRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  // Create form state
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRoleId,   setFormRoleId]   = useState('');
  const [formError,    setFormError]    = useState<string | null>(null);
  const [formSuccess,  setFormSuccess]  = useState<string | null>(null);
  const [formLoading,  setFormLoading]  = useState(false);

  // Permissions editor state
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [editedTabPerms, setEditedTabPerms] = useState<
    Record<string, Record<TabKey, boolean>>
  >({});
  const [editedCrudPerms, setEditedCrudPerms] = useState<
    Record<string, Record<TabKey, Record<CrudAction, boolean>>>
  >({});
  const [dirtyRoles, setDirtyRoles] = useState<Set<string>>(new Set());
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);

  // ── Fetch users ───────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/auth/users');
      if (!res.ok) throw new Error('Failed to load users.');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setFetchError('Failed to load user list. Check your connection.');
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ── Fetch roles (full permissions) ────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to load roles.');
      const data = await res.json();
      const fetched: RoleRow[] = data.roles ?? [];
      setRoles(fetched);

      // Pre-select first non-SuperAdmin role for create-user form
      const firstNonSuper = fetched.find((r) => r.name !== 'SuperAdmin');
      if (firstNonSuper) setFormRoleId(firstNonSuper.id);

      // Pre-select first non-SuperAdmin for permissions editor
      if (firstNonSuper) setSelectedRoleId(firstNonSuper.id);

      // Seed editable permission maps from fetched data
      const tabMap: Record<string, Record<TabKey, boolean>> = {};
      const crudMap: Record<string, Record<TabKey, Record<CrudAction, boolean>>> = {};
      for (const r of fetched) {
        tabMap[r.id] = { ...r.tab_permissions };
        const crudCopy = {} as Record<TabKey, Record<CrudAction, boolean>>;
        for (const tk of ALL_TAB_KEYS) {
          crudCopy[tk] = r.crud_permissions[tk]
            ? { ...r.crud_permissions[tk] }
            : { create: false, read: false, update: false, delete: false };
        }
        crudMap[r.id] = crudCopy;
      }
      setEditedTabPerms(tabMap);
      setEditedCrudPerms(crudMap);
      setDirtyRoles(new Set());
    } catch {
      setFetchError('Failed to load roles. Check your connection.');
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // ── Create user ───────────────────────────────────────────────────────────
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormLoading(true);
    try {
      const res = await fetch('/api/auth/create-user', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formUsername.trim(),
          password: formPassword,
          roleId:   formRoleId,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? 'Failed to create user.'); return; }
      setFormSuccess(`User "${data.username}" created successfully.`);
      setFormUsername('');
      setFormPassword('');
      await fetchUsers();
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  // ── Permission toggle handlers ────────────────────────────────────────────
  function handleTabToggle(roleId: string, tab: TabKey, checked: boolean) {
    setEditedTabPerms((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [tab]: checked },
    }));
    if (!checked) {
      // Tab hidden → turn off all CRUD
      setEditedCrudPerms((prev) => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [tab]: { create: false, read: false, update: false, delete: false },
        },
      }));
    } else {
      // Tab visible → auto-enable read CRUD
      setEditedCrudPerms((prev) => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [tab]: { ...prev[roleId][tab], read: true },
        },
      }));
    }
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  function handleCrudToggle(roleId: string, tab: TabKey, action: CrudAction, checked: boolean) {
    setEditedCrudPerms((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [tab]: { ...prev[roleId][tab], [action]: checked },
      },
    }));
    // Enabling any CRUD action but tab visibility is off → auto-enable tab
    if (checked && !editedTabPerms[roleId]?.[tab]) {
      setEditedTabPerms((prev) => ({
        ...prev,
        [roleId]: { ...prev[roleId], [tab]: true },
      }));
    }
    // Turning off read CRUD → also hide tab + turn off all CRUD
    if (action === 'read' && !checked) {
      setEditedTabPerms((prev) => ({
        ...prev,
        [roleId]: { ...prev[roleId], [tab]: false },
      }));
      setEditedCrudPerms((prev) => ({
        ...prev,
        [roleId]: {
          ...prev[roleId],
          [tab]: { create: false, read: false, update: false, delete: false },
        },
      }));
    }
    setDirtyRoles((prev) => new Set(prev).add(roleId));
  }

  // ── Save permissions ──────────────────────────────────────────────────────
  async function handleSavePermissions(roleId: string) {
    const role = roles.find((r) => r.id === roleId);
    if (!role || role.name === 'SuperAdmin') return;

    setSavingRoleId(roleId);
    try {
      const res = await fetch('/api/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: roleId,
          tab_permissions: editedTabPerms[roleId],
          crud_permissions: editedCrudPerms[roleId],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error ?? 'Failed to save permissions', 'er');
        return;
      }

      toast(`✓ Permissions saved for "${role.name}"`, 'ok');
      setDirtyRoles((prev) => {
        const next = new Set(prev);
        next.delete(roleId);
        return next;
      });
    } catch {
      toast('Network error — please try again', 'er');
    } finally {
      setSavingRoleId(null);
    }
  }

  // ── Derived state for permissions section ─────────────────────────────────
  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const isSuperAdminSelected = selectedRole?.name === 'SuperAdmin';
  const nonSuperAdminRoles = roles.filter((r) => r.name !== 'SuperAdmin');
  const superAdminRole = roles.find((r) => r.name === 'SuperAdmin');

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Admin banner — visual cue that this is a system panel ────────── */}
      <div style={{
        background: 'var(--orp)',
        border: '1.5px solid var(--or)',
        borderRadius: 'var(--r)',
        padding: '10px 16px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
      }}>
        <span style={{ fontSize: '16px' }}>⚙</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--or)' }}>
            System Administration
          </div>
          <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '1px' }}>
            SuperAdmin only · Changes here affect platform access for all users
          </div>
        </div>
      </div>

      {/* ── Fetch error ────────────────────────────────────────────────────── */}
      {fetchError && (
        <div style={{
          background: 'var(--rdp)', border: '1px solid var(--rd)',
          borderRadius: '8px', padding: '10px 14px',
          fontSize: '13px', color: 'var(--rd)', marginBottom: '16px',
        }}>
          {fetchError}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 1: User Management                                          */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── Create User form ─────────────────────────────────────────────── */}
      <div className="stl"><div className="d" />Create New User</div>

      <div className="cc" style={{ marginBottom: '20px', padding: '16px' }}>
        {/* Responsive form grid: 3 fields + button */}
        <form
          onSubmit={handleCreateUser}
          noValidate
          className="rg4"
          style={{ alignItems: 'flex-end' }}
        >
          <div className={styles.fl}>
            <label>Username</label>
            <input
              className={styles.fi}
              type="text"
              placeholder="e.g. john.doe"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              disabled={formLoading}
              required
            />
          </div>
          <div className={styles.fl}>
            <label>Password</label>
            <input
              className={styles.fi}
              type="password"
              placeholder="Min. 8 characters"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              disabled={formLoading}
              required
            />
          </div>
          <div className={styles.fl}>
            <label>Role</label>
            <select
              className={styles.fs}
              value={formRoleId}
              onChange={(e) => setFormRoleId(e.target.value)}
              disabled={formLoading || loadingRoles}
            >
              {roles
                .filter((r) => r.name !== 'SuperAdmin')
                .map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
            </select>
          </div>
          <div className={styles.fl}>
            <label>&nbsp;</label>
            <button
              type="submit"
              className="btn btn-or"
              disabled={formLoading || !formUsername.trim() || !formPassword}
              style={{ width: '100%', whiteSpace: 'nowrap' }}
            >
              {formLoading ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>

        {/* Form feedback */}
        {formError && (
          <div style={{
            marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
            background: 'var(--rdp)', border: '1px solid var(--rd)', color: 'var(--rd)',
          }}>
            {formError}
          </div>
        )}
        {formSuccess && (
          <div style={{
            marginTop: '12px', padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
            background: 'var(--grp)', border: '1px solid var(--gr)', color: 'var(--gr)',
          }}>
            {formSuccess}
          </div>
        )}
      </div>

      {/* ── All Users table ──────────────────────────────────────────────── */}
      <div className="stl"><div className="d" />All Users</div>

      <div className="tw">
        {loadingUsers ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
            Loading users…
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
            No users found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ minWidth: '400px' }}>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSuperAdmin = u.role.name === 'SuperAdmin';
                  const isAdmin      = u.role.name === 'Admin';
                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.username}</td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '11px',
                          fontWeight: 600,
                          background: isSuperAdmin
                            ? 'var(--orp)'
                            : isAdmin
                            ? 'rgba(99,102,241,.1)'
                            : 'var(--s2)',
                          color: isSuperAdmin
                            ? 'var(--or)'
                            : isAdmin
                            ? '#6366F1'
                            : 'var(--t2)',
                          border: `1px solid ${isSuperAdmin ? 'var(--or)' : isAdmin ? 'rgba(99,102,241,.25)' : 'var(--bdr)'}`,
                        }}>
                          {isSuperAdmin && '⚙ '}{u.role.name}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--t2)' }}>
                        {new Date(u.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Role Permissions                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      <div className="stl" style={{ marginTop: '8px' }}><div className="d" />Role Permissions</div>

      <div className="cc" style={{ padding: '16px', marginBottom: '16px' }}>
        {loadingRoles ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: '13px' }}>
            Loading roles…
          </div>
        ) : (
          <>
            {/* ── Role selection tab strip ──────────────────────────────────── */}
            {/* Uses .btn .btn-g (inactive) / .btn .btn-or (active) — same pill */}
            {/* toggle pattern used throughout the app for inline selection.     */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {superAdminRole && (
                <button
                  className={`btn ${selectedRoleId === superAdminRole.id ? 'btn-or' : 'btn-g'} btn-sm`}
                  onClick={() => setSelectedRoleId(superAdminRole.id)}
                >
                  ⚙ {superAdminRole.name}
                </button>
              )}
              {nonSuperAdminRoles.map((r) => (
                <button
                  key={r.id}
                  className={`btn ${selectedRoleId === r.id ? 'btn-or' : 'btn-g'} btn-sm`}
                  onClick={() => setSelectedRoleId(r.id)}
                >
                  {r.name}
                </button>
              ))}
            </div>

            {/* ── Locked notice for SuperAdmin ──────────────────────────────── */}
            {isSuperAdminSelected && (
              <div style={{
                background: 'var(--orp)',
                border: '1px solid var(--or)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                color: 'var(--or)',
                marginBottom: '12px',
              }}>
                SuperAdmin has full access to all tabs and actions. These permissions cannot be edited.
              </div>
            )}

            {/* ── Permissions matrix table ─────────────────────────────────── */}
            {selectedRoleId && editedTabPerms[selectedRoleId] && (
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    minWidth: '520px',
                    ...(isSuperAdminSelected
                      ? { opacity: 0.5, pointerEvents: 'none' as const }
                      : {}),
                  }}
                >
                  <thead>
                    <tr>
                      <th>Tab</th>
                      <th style={{ textAlign: 'center' }}>Visible</th>
                      {CRUD_ACTIONS.map((action) => (
                        <th key={action} style={{ textAlign: 'center' }}>
                          {CRUD_LABELS[action]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_TAB_KEYS.map((tab) => {
                      const tabVisible = editedTabPerms[selectedRoleId]?.[tab] ?? false;
                      return (
                        <tr key={tab}>
                          <td style={{ fontWeight: 600, fontSize: '12.5px' }}>
                            {TAB_LABELS[tab]}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={tabVisible}
                              onChange={(e) =>
                                handleTabToggle(selectedRoleId, tab, e.target.checked)
                              }
                              style={{ accentColor: 'var(--or)' }}
                            />
                          </td>
                          {CRUD_ACTIONS.map((action) => {
                            const checked =
                              editedCrudPerms[selectedRoleId]?.[tab]?.[action] ?? false;
                            return (
                              <td key={action} style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) =>
                                    handleCrudToggle(
                                      selectedRoleId,
                                      tab,
                                      action,
                                      e.target.checked,
                                    )
                                  }
                                  style={{ accentColor: 'var(--or)' }}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Save button (non-SuperAdmin only) ────────────────────────── */}
            {selectedRoleId && !isSuperAdminSelected && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  className="btn btn-or"
                  disabled={savingRoleId === selectedRoleId || !dirtyRoles.has(selectedRoleId)}
                  onClick={() => handleSavePermissions(selectedRoleId)}
                >
                  {savingRoleId === selectedRoleId ? 'Saving…' : 'Save Permissions'}
                </button>
                {!dirtyRoles.has(selectedRoleId) && (
                  <span style={{ fontSize: '11px', color: 'var(--t3)' }}>
                    No unsaved changes
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
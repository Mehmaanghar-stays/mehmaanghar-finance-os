'use client';
// src/app/(dashboard)/users/page.tsx
//
// User Management panel — SuperAdmin only.
// Rendered inside the standard (dashboard) layout (Sidebar + Topbar + PeriodBar).
// Access enforced by proxy.ts + getRolePermissions() — non-SuperAdmin roles
// receive tabPerms['users'] !== true and are redirected by the Server Component
// wrapper. This Client Component never renders for non-SuperAdmin users.
//
// Visual distinction from property-management pages: an admin-banner at the
// top of the content area makes the system-administration context clear.
//
// Deferred to v2:
//   - Edit user (change role or password)
//   - Delete user
//   - Granular per-role CRUD editing UI (v3 plan Section 8.1)

import { useState, useEffect, useCallback } from 'react';
import styles from '@/components/ui/ui.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserRow {
  id: string;
  username: string;
  role: { name: string };
  created_at: string;
}

interface RoleRow {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function UsersPage() {
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

  // ── Fetch roles ───────────────────────────────────────────────────────────
  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to load roles.');
      const data = await res.json();
      setRoles(data.roles ?? []);
      // Pre-select first non-SuperAdmin role
      const firstNonSuper = (data.roles ?? []).find(
        (r: RoleRow) => r.name !== 'SuperAdmin',
      );
      if (firstNonSuper) setFormRoleId(firstNonSuper.id);
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Admin banner — visual cue that this is a system panel ────────── */}
      {/* Orange border + background, same pattern as the targets panel in     */}
      {/* InsightsClient — consistent with the design language for             */}
      {/* "configuration / elevated access" contexts.                          */}
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

      {/* ── Create User form ─────────────────────────────────────────────── */}
      <div className="stl"><div className="d" />Create New User</div>

      <div className="cc" style={{ marginBottom: '20px', padding: '16px' }}>
        {/* 3-col grid matching existing form but using platform classes */}
        <form
          onSubmit={handleCreateUser}
          noValidate
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}
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
          <button
            type="submit"
            className="btn btn-or"
            disabled={formLoading || !formUsername.trim() || !formPassword}
            style={{ height: '38px' }}
          >
            {formLoading ? 'Creating…' : 'Create User'}
          </button>
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
            <table>
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
                        {/* Role badge — same pill pattern, colour-coded for admin level */}
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
    </>
  );
}
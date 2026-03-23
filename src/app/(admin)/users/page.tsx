"use client";
// src/app/(admin)/users/page.tsx
// =============================================================================
// MehmanGhar Financial OS — User Management Panel (SuperAdmin only)
//
// Accessible only to SuperAdmin — enforced by proxy.ts (JWT check) and
// additionally by the role guard on the create-user and roles API routes.
//
// Features in v1:
//   - List all users with their role
//   - Create new user (username + password + role assignment)
//   - View all roles and their permissions (read-only display)
//
// Deferred to v2:
//   - Edit user (change role or password)
//   - Delete user
//   - Granular per-role CRUD editing UI (v3 plan Section 8.1)
// =============================================================================

import { useState, useEffect, useCallback } from "react";

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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Create form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRoleId, setFormRoleId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // ----------------------------------------------------------
  // Fetch users
  // ----------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/auth/users");
      if (!res.ok) throw new Error("Failed to load users.");
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch {
      setFetchError("Failed to load user list. Check your connection.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // ----------------------------------------------------------
  // Fetch roles
  // ----------------------------------------------------------
  const fetchRoles = useCallback(async () => {
    setLoadingRoles(true);
    try {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Failed to load roles.");
      const data = await res.json();
      setRoles(data.roles ?? []);
      // Pre-select first non-SuperAdmin role
      const firstNonSuper = (data.roles ?? []).find(
        (r: RoleRow) => r.name !== "SuperAdmin"
      );
      if (firstNonSuper) setFormRoleId(firstNonSuper.id);
    } catch {
      setFetchError("Failed to load roles. Check your connection.");
    } finally {
      setLoadingRoles(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // ----------------------------------------------------------
  // Create user
  // ----------------------------------------------------------
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setFormLoading(true);

    try {
      const res = await fetch("/api/auth/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formUsername.trim(),
          password: formPassword,
          roleId: formRoleId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error ?? "Failed to create user.");
        return;
      }

      setFormSuccess(`User "${data.username}" created successfully.`);
      setFormUsername("");
      setFormPassword("");
      await fetchUsers();
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setFormLoading(false);
    }
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&display=swap');

        .users-page {
          font-family: 'Sora', sans-serif;
          padding: 32px;
          max-width: 960px;
          color: #F1F3F9;
        }

        .page-title {
          font-size: 20px;
          font-weight: 600;
          color: #F1F3F9;
          margin-bottom: 4px;
          letter-spacing: -0.2px;
        }

        .page-sub {
          font-size: 13px;
          color: #8B91A7;
          margin-bottom: 32px;
        }

        .section { margin-bottom: 40px; }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #8B91A7;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid #2A2F42;
        }

        /* Create form */
        .create-form {
          background: #181B24;
          border: 1px solid #2A2F42;
          border-radius: 10px;
          padding: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr auto;
          gap: 12px;
          align-items: flex-end;
        }

        @media (max-width: 680px) {
          .create-form { grid-template-columns: 1fr; }
        }

        .form-field { display: flex; flex-direction: column; gap: 6px; }

        .form-label {
          font-size: 11px;
          font-weight: 500;
          color: #8B91A7;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-input, .form-select {
          height: 40px;
          padding: 0 12px;
          background: #1E2130;
          border: 1px solid #2A2F42;
          border-radius: 8px;
          color: #F1F3F9;
          font-family: 'Sora', sans-serif;
          font-size: 13px;
          outline: none;
          transition: border-color 0.15s;
        }

        .form-input:focus, .form-select:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.12);
        }

        .form-input::placeholder { color: #4A5068; }

        .btn-create {
          height: 40px;
          padding: 0 20px;
          background: #F97316;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-family: 'Sora', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s;
          white-space: nowrap;
        }

        .btn-create:hover:not(:disabled) { background: #EA6C0A; }
        .btn-create:disabled { opacity: 0.5; cursor: not-allowed; }

        .form-feedback {
          margin-top: 12px;
          font-size: 13px;
          padding: 10px 14px;
          border-radius: 8px;
        }

        .form-feedback.error {
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.2);
          color: #F87171;
        }

        .form-feedback.success {
          background: rgba(52,211,153,0.08);
          border: 1px solid rgba(52,211,153,0.2);
          color: #34D399;
        }

        /* Users table */
        .table-wrap {
          background: #181B24;
          border: 1px solid #2A2F42;
          border-radius: 10px;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        thead { background: #1A1D28; }

        th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: #8B91A7;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          border-bottom: 1px solid #2A2F42;
        }

        td {
          padding: 13px 16px;
          color: #C8CCDB;
          border-bottom: 1px solid #1E2130;
        }

        tr:last-child td { border-bottom: none; }
        tr:hover td { background: rgba(255,255,255,0.02); }

        .role-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .role-badge.super-admin {
          background: rgba(249,115,22,0.15);
          color: #F97316;
          border: 1px solid rgba(249,115,22,0.25);
        }

        .role-badge.admin {
          background: rgba(99,102,241,0.12);
          color: #818CF8;
          border: 1px solid rgba(99,102,241,0.2);
        }

        .role-badge.other {
          background: rgba(139,145,167,0.1);
          color: #8B91A7;
          border: 1px solid rgba(139,145,167,0.2);
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: #8B91A7;
          font-size: 13px;
        }

        .loading-text {
          color: #8B91A7;
          font-size: 13px;
        }
      `}</style>

      <div className="users-page">
        <h1 className="page-title">User Management</h1>
        <p className="page-sub">Create and manage platform users. SuperAdmin access only.</p>

        {fetchError && (
          <div className="form-feedback error" style={{ marginBottom: 24 }}>
            {fetchError}
          </div>
        )}

        {/* ---- Create User ---- */}
        <div className="section">
          <div className="section-title">Create New User</div>
          <form className="create-form" onSubmit={handleCreateUser} noValidate>
            <div className="form-field">
              <label className="form-label">Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. john.doe"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Min. 8 characters"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                disabled={formLoading}
                required
              />
            </div>
            <div className="form-field">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                value={formRoleId}
                onChange={(e) => setFormRoleId(e.target.value)}
                disabled={formLoading || loadingRoles}
              >
                {roles
                  .filter((r) => r.name !== "SuperAdmin")
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
            </div>
            <button type="submit" className="btn-create" disabled={formLoading}>
              {formLoading ? "Creating…" : "Create User"}
            </button>
          </form>

          {formError && (
            <div className="form-feedback error">{formError}</div>
          )}
          {formSuccess && (
            <div className="form-feedback success">{formSuccess}</div>
          )}
        </div>

        {/* ---- Users Table ---- */}
        <div className="section">
          <div className="section-title">All Users</div>
          <div className="table-wrap">
            {loadingUsers ? (
              <div className="empty-state loading-text">Loading users…</div>
            ) : users.length === 0 ? (
              <div className="empty-state">No users found.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.username}</td>
                      <td>
                        <span
                          className={`role-badge ${
                            u.role.name === "SuperAdmin"
                              ? "super-admin"
                              : u.role.name === "Admin"
                              ? "admin"
                              : "other"
                          }`}
                        >
                          {u.role.name}
                        </span>
                      </td>
                      <td>
                        {new Date(u.created_at).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
// src/components/layout/Topbar.tsx
//
// Server Component. Reads the JWT cookie, resolves the current user's display
// name from the DB, and renders the topbar exactly as in mg-finance-os.html.
//
// Architecture:
//   - Server Component for username resolution (zero client bundle cost).
//   - TopbarTitle.tsx — thin Client Component for usePathname()-derived title.
//   - pgBadge renders as static "—" for now. Run 3 (PeriodBar) will replace
//     it with a <PeriodBadge /> Client Component reading from the Zustand store.
//   - All action buttons (+ Property, + Investor, Backup, Restore, Export CSV)
//     are inert <button> elements. OnClick handlers are wired in Phase 6.
//
// Original HTML source: <header class="topbar"> in mg-finance-os.html.
//
// NOTE: 'Playfair Display' and 'Sora' fonts must be loaded in the root
// layout.tsx (next/font or Google Fonts <link>). These fonts are declared in
// Topbar.module.css but the load must be initiated at the root level.

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { TopbarTitle } from './TopbarTitle';
import { PeriodBadge } from './PeriodBar';
import styles from './Topbar.module.css';

// ---------------------------------------------------------------------------
// Topbar Server Component
// ---------------------------------------------------------------------------

export async function Topbar() {
  // ── 1. Read and verify session ────────────────────────────────────────────
  const cookieName = process.env.COOKIE_NAME ?? 'mg_session';
  // In Next.js 15/16, cookies() returns a Promise.
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value ?? '';

  const session = token ? await verifyToken(token) : null;

  // proxy.ts guarantees a redirect to /login before Topbar renders, but
  // guard here for safety.
  if (!session) return null;

  // ── 2. Fetch display name from DB ─────────────────────────────────────────
  // In the original HTML, the "Updated by" badge reads from localStorage and
  // is set manually by the user. In the full-stack version it is the
  // authenticated username — automatically correct and always up to date.
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { username: true },
  });

  const username = user?.username ?? 'User';

  // ── 3. Button class helper ─────────────────────────────────────────────────
  // Combines base + variant + size modifier classes from Topbar.module.css.
  function btnClass(...variants: string[]): string {
    return [styles.btn, ...variants.map((v) => styles[v])].join(' ');
  }

  // ── 4. Render ─────────────────────────────────────────────────────────────
  return (
    <header className={styles.topbar}>
      {/* Left side — logo, page title, period badge */}
      <div className={styles['tb-l']}>
        {/*
         * Logo: same asset as Sidebar. Extract the base64 JPEG from the
         * original HTML and save it as public/logo.jpg before running the app.
         */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.jpg"
          alt="MehmanGhar"
          width={34}
          height={34}
          className={styles['tb-logo']}
        />

        {/* Page title — resolved from current pathname by the Client Component */}
        <TopbarTitle />

        {/*
         * Period badge (pgBadge).
         * Shows the active period filter, e.g. "January 2025", "Q1 FY 2024–25".
         * Renders as "—" in v1. Run 3 replaces this with:
         *   <PeriodBadge />
         * which reads the period display string from the Zustand period store.
         */}
        <span className={styles['tb-badge']}><PeriodBadge /></span>
      </div>

      {/* Right side — action buttons */}
      <div className={styles['tb-r']}>
        {/*
         * + Property / + Investor
         * Open modals. Inert in v1. Modal system is built in Run 4.
         * In Run 5 (layout.tsx), wire these to the modal open state.
         */}
        <button
          type="button"
          className={btnClass('btn-g', 'btn-sm')}
        >
          + Property
        </button>

        <button
          type="button"
          className={btnClass('btn-g', 'btn-sm')}
        >
          + Investor
        </button>

        {/*
         * Username badge.
         * Original HTML: reads from localStorage, user sets it manually.
         * Full-stack version: shows the authenticated username from the DB.
         * Inert — no change-name flow in v1.
         */}
        <button
          type="button"
          className={btnClass('btn-g', 'btn-sm')}
          title="Logged in as"
        >
          👤 {username}
        </button>

        {/*
         * Backup / Restore.
         * Original HTML: exposes full localStorage JSON via exportFullBackup()
         * and importBackup(). In the full-stack version these call export/import
         * API routes built in Phase 6.
         * Inert for now.
         */}
        <button
          type="button"
          className={btnClass('btn-g', 'btn-sm')}
          title="Download full backup as JSON"
        >
          💾 Backup
        </button>

        {/*
         * Restore: original HTML uses a <label> wrapping a hidden <input
         * type="file"> to trigger the file picker without a visible input.
         * Structure preserved exactly. The onchange handler is wired in Phase 6.
         */}
        <label
          className={btnClass('btn-g', 'btn-sm')}
          style={{ cursor: 'pointer' }}
          title="Restore from JSON backup"
        >
          📂 Restore
          {/* onChange wired to POST /api/exports/restore in Phase 6 */}
          <input type="file" accept=".json" style={{ display: 'none' }} />
        </label>

        {/*
         * Export CSV.
         * Original HTML: openExportModal('monthly') → expCSV().
         * Full-stack version: calls GET /api/exports?format=csv — Phase 6.
         */}
        <button
          type="button"
          className={btnClass('btn-or', 'btn-sm')}
        >
          ↓ Export CSV
        </button>
      </div>
    </header>
  );
}
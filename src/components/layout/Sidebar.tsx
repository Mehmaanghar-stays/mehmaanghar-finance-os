// src/components/layout/Sidebar.tsx
//
// Server Component. Reads the JWT cookie, resolves role permissions, and
// renders only the tabs the current user is allowed to see.
//
// Architecture decisions:
//   - Server Component so that permission resolution is zero-client-bundle.
//   - NavItem.tsx is a thin Client Component child that handles usePathname().
//     Children (SVG icons, text) are rendered server-side and serialized
//     through the RSC boundary as normal — no serialization issue.
//   - Monthly Entry renders as a <button> (NavItem with modalId). The modal
//     trigger will be wired up in Phase 5 when the modal system is built.
//   - Pending badge on Payouts is hidden for now (count requires payout API
//     route, built in Phase 6).
//   - Logo image: expects /public/logo.jpg — extract the base64 JPEG from
//     the original HTML source and save it there before running the app.

import Image from 'next/image';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getRolePermissions } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import type { TabKey } from '@/lib/permissions';
import { NavItem } from './NavItem';
import styles from './Sidebar.module.css';

// ---------------------------------------------------------------------------
// Nav structure — mirrors the <aside class="sb"> in mg-finance-os.html exactly.
// Each item has a permKey that maps to TabPermissions from the database.
// Monthly Entry uses 'reports' as its permission key (closest match — it
// creates monthly report records). Adjust in v2 if a dedicated key is added.
// ---------------------------------------------------------------------------

interface LinkNavItem {
  type: 'link';
  label: string;
  href: string;
  permKey: TabKey;
  icon: React.ReactNode;
}

interface ModalNavItem {
  type: 'modal';
  label: string;
  modalId: string;
  permKey: TabKey;
  icon: React.ReactNode;
}

type NavItemDef = LinkNavItem | ModalNavItem;

interface NavSection {
  label: string;
  items: NavItemDef[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [
      {
        type: 'link',
        label: 'Dashboard',
        href: '/dashboard',
        permKey: 'dashboard',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Cash Flow',
        href: '/cashflow',
        permKey: 'cashflow',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        type: 'link',
        label: 'Properties',
        href: '/properties',
        permKey: 'properties',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Investors',
        href: '/investors',
        permKey: 'investors',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Reports',
        href: '/reports',
        permKey: 'reports',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Smart Insights',
        href: '/insights',
        permKey: 'insights',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Expense Intel',
        href: '/expenses',
        permKey: 'expenses',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Payout Ledger',
        href: '/payouts',
        permKey: 'payouts',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Daily Operations',
    items: [
      {
        type: 'link',
        label: 'Daily Expenses',
        href: '/dailyexp',
        permKey: 'dailyexp',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Bookings',
        href: '/bookings',
        permKey: 'bookings',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        type: 'link',
        label: 'Guest CRM',
        href: '/crm',
        permKey: 'crm',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        ),
      },
      {
        // Not a route — opens a modal. Gated under 'reports' (monthly report
        // entry). Phase 5: wire NavItem onClick to the modal system.
        type: 'modal',
        label: 'Monthly Entry',
        modalId: 'monthlyModal',
        permKey: 'reports',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Utilities',
    items: [
      {
        type: 'link',
        label: 'Rent & Utilities',
        href: '/utils',
        permKey: 'utils',
        icon: (
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" />
            <path d="M13 2v7h7" />
          </svg>
        ),
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Sidebar Server Component
// ---------------------------------------------------------------------------

export async function Sidebar() {
  // ── 1. Read and verify session ────────────────────────────────────────────
  const cookieName = process.env.COOKIE_NAME ?? 'mg_session';
  // In Next.js 15/16, cookies() returns a Promise.
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value ?? '';

  const session = token ? await verifyToken(token) : null;

  // proxy.ts guarantees a redirect to /login before Sidebar renders, but
  // guard here for safety (e.g. during unit tests or direct render).
  if (!session) return null;

  // ── 2. Resolve tab permissions ────────────────────────────────────────────
  const rolePerms = await getRolePermissions(session.role);
  const tabPerms = rolePerms?.tabPermissions ?? {};

  // ── 2b. Fetch all-time pending payout count ───────────────────────────────
  // Server-side query — zero client bundle cost. Prisma derives 'pending'
  // from amount_paid IS NULL (no separate status column in schema).
  let pendingPayoutCount = 0;
  try {
    pendingPayoutCount = await prisma.payout.count({
      where: {
        amount_paid: null,
        paid_on:     null,
      },
    });
  } catch {
    // DB not yet migrated or payout table empty — safe default
  }

  // ── 3. Render ─────────────────────────────────────────────────────────────
  return (
    <aside className={styles.sb}>
      {/* Logo / brand */}
      <div className={styles['sb-logo']}>
        {/*
         * Logo image: save the base64 JPEG from the original HTML as
         * /public/logo.jpg before running the application.
         */}
        <Image
          src="/logo.jpg"
          alt="MehmanGhar Stays logo"
          width={42}
          height={42}
          className={styles['sb-logo-img']}
          priority
        />
        <div className={styles['sb-txt']}>
          <strong>MehmanGhar Stays</strong>
          <span>Financial OS</span>
        </div>
      </div>

      {/* Nav sections */}
      <nav className={styles['sb-nav']}>
        {NAV_SECTIONS.map((section) => {
          // Filter items to those the role can see.
          const visibleItems = section.items.filter(
            (item) => tabPerms[item.permKey] === true,
          );

          // Omit the section entirely if no items are visible.
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className={styles['sb-sec']}>
              <div className={styles['sb-lbl']}>{section.label}</div>

              {visibleItems.map((item) => {
                if (item.type === 'link') {
                  // Special case: Payout Ledger shows a pending-count badge.
                  // The badge is hidden until the payout API route (Phase 6)
                  // provides the count. At that point, fetch the count
                  // server-side here and pass it as a prop.
                  const showBadge = item.permKey === 'payouts' && pendingPayoutCount > 0;

                  return (
                    <NavItem key={item.href} href={item.href}>
                      {item.icon}
                      {item.label}
                      {showBadge && (
                        <span className={styles['pending-badge']}>
                          {pendingPayoutCount}
                        </span>
                      )}
                    </NavItem>
                  );
                }

                // Modal trigger
                return (
                  <NavItem key={item.modalId} modalId={item.modalId}>
                    {item.icon}
                    {item.label}
                  </NavItem>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={styles['sb-foot']}>
        MehmanGhar Stays Services Pvt. Ltd.<br />
        CIN: U55101MH2025PTC456442<br />
        Andheri West, Mumbai 400061<br />
        <a href="tel:+919839143040">+91 98391 43040</a>
      </div>
    </aside>
  );
}
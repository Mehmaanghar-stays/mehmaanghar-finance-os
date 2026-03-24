'use client';
// src/components/layout/TopbarTitle.tsx
//
// Thin Client Component. Only exists because usePathname() requires a client
// context. Topbar.tsx is a Server Component — this file handles the one
// dynamic piece it needs: mapping the current pathname to a page title.
//
// Same pattern as NavItem.tsx (Run 1).

import { usePathname } from 'next/navigation';
import styles from './Topbar.module.css';

// ---------------------------------------------------------------------------
// Pathname → title map
// Covers all 12 dashboard tabs + admin route.
// ---------------------------------------------------------------------------

const PATH_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/cashflow':   'Cash Flow',
  '/properties': 'Properties',
  '/investors':  'Investors',
  '/reports':    'Reports',
  '/insights':   'Smart Insights',
  '/expenses':   'Expense Intel',
  '/payouts':    'Payout Ledger',
  '/dailyexp':   'Daily Expenses',
  '/bookings':   'Bookings',
  '/crm':        'Guest CRM',
  '/utils':      'Rent & Utilities',
  '/users':      'User Management',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TopbarTitle() {
  const pathname = usePathname();

  // Exact match first; fallback strips trailing segments for nested routes.
  const title =
    PATH_TITLES[pathname] ??
    PATH_TITLES[`/${pathname.split('/')[1]}`] ??
    'MehmanGhar';

  return <span className={styles['tb-title']}>{title}</span>;
}
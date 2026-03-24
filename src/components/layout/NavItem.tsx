'use client';
// src/components/layout/NavItem.tsx
//
// Thin Client Component. Only exists because usePathname() requires a client
// context. Sidebar.tsx is a Server Component — this file handles the one piece
// of client state it needs: the active tab highlight.
//
// Server Component renders SVG icons + labels as children. They cross the RSC
// boundary as server-rendered content, not as serialized React elements.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BaseProp {
  children: React.ReactNode;
}

interface LinkItem extends BaseProp {
  /** Absolute pathname, e.g. '/dashboard' */
  href: string;
  modalId?: never;
}

interface ModalItem extends BaseProp {
  href?: never;
  /**
   * Modal identifier, e.g. 'monthlyModal'.
   * Phase 5: wire openModal(modalId) once the modal system is built.
   */
  modalId: string;
}

type NavItemProps = LinkItem | ModalItem;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NavItem({ href, modalId, children }: NavItemProps) {
  const pathname = usePathname();

  // A link item is active when the current pathname starts with its href.
  // Exact match first to handle root-level pages correctly.
  const isActive =
    href != null
      ? pathname === href || pathname.startsWith(href + '/')
      : false;

  const className = [styles.ni, isActive ? styles.active : '']
    .filter(Boolean)
    .join(' ');

  if (href != null) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  // Modal trigger — onClick wired up in Phase 5 when modal infrastructure
  // is built. The modalId prop is accepted but not yet consumed.
  return (
    <button type="button" className={className}>
      {children}
    </button>
  );
}
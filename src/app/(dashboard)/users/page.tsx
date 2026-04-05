// src/app/(dashboard)/users/page.tsx
//
// User Management — Server Component shell.
// SuperAdmin only — non-SuperAdmin roles are redirected to /dashboard.
// The layout.tsx already verifies the JWT; this adds role-level gating.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';
import { UsersClient } from './UsersClient';
import { SUPER_ADMIN } from "@/lib/permissions";

export default async function UsersPage() {
  const cookieName  = process.env.COOKIE_NAME ?? 'mg_session';
  const cookieStore = await cookies();
  const token       = cookieStore.get(cookieName)?.value ?? '';
  const session     = token ? await verifyToken(token) : null;

  // Layout already handles missing session → redirect to /login.
  // This guards against non-SuperAdmin roles accessing /users directly.
  if (!session || session.role !== SUPER_ADMIN) {
    redirect('/dashboard');
  }

  return <UsersClient />;
}

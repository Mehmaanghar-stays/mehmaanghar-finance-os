// src/app/(auth)/login/page.tsx
// =============================================================================
// MehmanGhar Financial OS — Login Page
//
// Design spec (v3 plan + prompt): dark background, orange brand, Sora font.
// This is a Server Component wrapper that renders the LoginForm client component.
// The form itself is a client component because it handles state and fetch calls.
// =============================================================================

import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign In — MehmanGhar Finance OS",
};

export default function LoginPage() {
  return <LoginForm />;
}
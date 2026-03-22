// prisma/seed.ts
// =============================================================================
// MehmanGhar Financial OS — SuperAdmin Seed Script
// Phase 2 — run once after the schema is migrated.
//
// Usage:
//   npx prisma db seed
//
// Reads credentials from environment variables — never hardcoded.
// Required env vars (set in .env.local):
//   SEED_SUPERADMIN_USERNAME  — the SuperAdmin login username
//   SEED_SUPERADMIN_PASSWORD  — the plaintext initial password (hashed on write)
//   BCRYPT_ROUNDS             — bcrypt work factor (plan specifies 12)
//   DIRECT_URL                — direct Supabase connection (no pooler)
//
// Idempotent: re-running will not create duplicates. If the SuperAdmin role
// or user already exists, the script updates them in place (upsert).
// =============================================================================

import { config } from "dotenv";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client/client";
import bcrypt from "bcryptjs";

// Load .env.local — tsx does not follow Next.js env conventions.
// Must run before any process.env access.
config({ path: ".env.local" });

// ---------------------------------------------------------------------------
// Prisma 7: rust-free engine requires a driver adapter.
// Seed uses DIRECT_URL (same as prisma.config.ts) to bypass the pooler.
// ---------------------------------------------------------------------------

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

// ---------------------------------------------------------------------------
// Tab keys — must match the route segments in src/app/(dashboard)/
// ---------------------------------------------------------------------------

const ALL_TABS = [
  "dashboard",
  "cashflow",
  "properties",
  "investors",
  "reports",
  "insights",
  "expenses",
  "payouts",
  "bookings",
  "crm",
  "dailyexp",
  "utils",
] as const;

type TabKey = (typeof ALL_TABS)[number];

// ---------------------------------------------------------------------------
// Permission builders
// ---------------------------------------------------------------------------

function buildSuperAdminTabPermissions(): Record<TabKey, boolean> {
  return Object.fromEntries(ALL_TABS.map((tab) => [tab, true])) as Record<
    TabKey,
    boolean
  >;
}

function buildSuperAdminCrudPermissions(): Record<
  TabKey,
  { create: boolean; read: boolean; update: boolean; delete: boolean }
> {
  return Object.fromEntries(
    ALL_TABS.map((tab) => [
      tab,
      { create: true, read: true, update: true, delete: true },
    ])
  ) as Record<
    TabKey,
    { create: boolean; read: boolean; update: boolean; delete: boolean }
  >;
}

// ---------------------------------------------------------------------------
// Env var validation
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `[seed] Missing required environment variable: ${name}\n` +
        `Set it in .env.local before running the seed script.`
    );
  }
  return value.trim();
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[seed] Starting SuperAdmin seed...");

  const username = requireEnv("SEED_SUPERADMIN_USERNAME");
  const plaintextPassword = requireEnv("SEED_SUPERADMIN_PASSWORD");
  const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);

  if (isNaN(bcryptRounds) || bcryptRounds < 10 || bcryptRounds > 15) {
    throw new Error(
      `[seed] BCRYPT_ROUNDS must be between 10 and 15. Got: ${process.env.BCRYPT_ROUNDS}`
    );
  }

  console.log(`[seed] Hashing password (bcrypt rounds: ${bcryptRounds})...`);
  const passwordHash = await bcrypt.hash(plaintextPassword, bcryptRounds);

  console.log("[seed] Upserting SuperAdmin role...");
  const superAdminRole = await prisma.role.upsert({
    where: { name: "SuperAdmin" },
    update: {
      tab_permissions: buildSuperAdminTabPermissions(),
      crud_permissions: buildSuperAdminCrudPermissions(),
    },
    create: {
      name: "SuperAdmin",
      tab_permissions: buildSuperAdminTabPermissions(),
      crud_permissions: buildSuperAdminCrudPermissions(),
    },
  });

  console.log(`[seed] SuperAdmin role ready — id: ${superAdminRole.id}`);

  console.log(`[seed] Upserting SuperAdmin user: "${username}"...`);
  const superAdminUser = await prisma.user.upsert({
    where: { username },
    update: {
      password_hash: passwordHash,
      role_id: superAdminRole.id,
    },
    create: {
      username,
      password_hash: passwordHash,
      role_id: superAdminRole.id,
    },
  });

  console.log(`[seed] SuperAdmin user ready — id: ${superAdminUser.id}`);
  console.log("[seed] Done. SuperAdmin can now log in at /login.");
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main()
  .catch((err: unknown) => {
    console.error("[seed] Fatal error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
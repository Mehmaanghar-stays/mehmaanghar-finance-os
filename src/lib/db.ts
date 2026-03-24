// src/lib/db.ts
// =============================================================================
// MehmanGhar Financial OS — Prisma Client Singleton
//
// Prisma 7 (rust-free engine) requires a driver adapter for every PrismaClient
// instance. This module is the ONLY place in the codebase that imports pg and
// @prisma/adapter-pg — all API routes import `prisma` from here.
//
// Connection strategy:
//   - Runtime (Next.js app): uses DATABASE_URL — the Supabase pooler URL
//     (port 6543, ?pgbouncer=true). Handles concurrent requests efficiently.
//   - CLI (prisma.config.ts + seed.ts): uses DIRECT_URL — bypasses the pooler.
//     This module is runtime-only; the CLI manages its own connection.
//
// Singleton pattern: in Next.js dev mode, hot-reload creates new module
// instances on every file change. Without the global cache, each reload would
// open a new pg.Pool, exhausting the Supabase free-tier connection limit (10).
// The global cache ensures only one Pool exists per process.
// =============================================================================

import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client/client";

// ---------------------------------------------------------------------------
// Global cache type — extends globalThis so TypeScript knows about it
// ---------------------------------------------------------------------------

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "[db] DATABASE_URL is not set. Add it to .env.local before starting the app.",
    );
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  // Pool type from @types/pg conflicts with the bundled @types/pg inside
  // @prisma/adapter-pg. The adapter IS compatible at runtime; this cast
  // bridges the structural mismatch between the two @types/pg versions.
  return new PrismaClient({
    adapter,
  } as unknown as ConstructorParameters<typeof PrismaClient>[0]);
}

// ---------------------------------------------------------------------------
// Exported singleton
// ---------------------------------------------------------------------------

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
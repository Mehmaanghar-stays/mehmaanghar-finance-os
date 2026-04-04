// src/app/api/regen-reports/route.ts
// =============================================================================
// MehmanGhar Financial OS — Report Regeneration Endpoint
//
// POST — Triggers a full report regeneration from current bookings + expenses.
//        Delegates to src/lib/regenReports.ts.
//        Called automatically after every write to bookings, daily-expenses,
//        and monthly-entry. Also available for manual triggers (e.g. Restore).
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { regenReports } from "@/lib/regenReports";

interface ErrorResponse {
  error: string;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse> {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const role = session.role;

  try {
    const result = await regenReports();
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Regen failed.";
    return NextResponse.json<ErrorResponse>({ error: msg }, { status: 500 });
  }
}

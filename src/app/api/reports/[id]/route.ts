// src/app/api/reports/[id]/route.ts
// =============================================================================
// MehmanGhar Financial OS — Reports dynamic segment route
//
// DELETE — hard delete by URL segment. SuperAdmin only.
// No PATCH — reports are immutable.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertPermission, PermissionError, RoleRequiredError } from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client/client";

interface ErrorResponse {
  error: string;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorised." }, { status: 401 });
  }
  const role = session.role;

  try {
    await assertPermission(role, "reports", "delete");
  } catch (err) {
    if (err instanceof PermissionError || err instanceof RoleRequiredError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }

  const { id } = await params;

  try {
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Report not found." }, { status: 404 });
      }
    }
    return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
  }
}
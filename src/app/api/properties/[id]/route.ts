// src/app/api/properties/[id]/route.ts
// =============================================================================
// MehmanGhar Financial OS — Properties dynamic segment route
//
// Handles the PATCH and DELETE calls that PropertiesClient makes to
// /api/properties/${id}. The base route.ts handles GET (list) and POST (create).
//
// PATCH  — update property fields. SuperAdmin only.
// DELETE — guarded: 409 if related records exist. SuperAdmin only.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  requireRole,
  PermissionError,
  RoleRequiredError,
} from "@/lib/permissions";
import { Prisma } from "@/generated/prisma/client/client";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

interface PropertyRow {
  id: string;
  name: string;
  address: string | null;
  city: string;
  state: string;
  comm: number;
  capital: number;
  type: string;
  rooms: number;
  assets: unknown;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

interface ErrorResponse {
  error: string;
}

function serializeProperty(
  p: Awaited<ReturnType<typeof prisma.property.findUniqueOrThrow>>
): PropertyRow {
  return {
    id: p.id,
    name: p.name,
    address: p.address,
    city: p.city,
    state: p.state,
    comm: p.comm.toNumber(),
    capital: p.capital.toNumber(),
    type: p.type,
    rooms: p.rooms,
    assets: p.assets,
    image_path: p.image_path,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}

function handleError(err: unknown): NextResponse<ErrorResponse> {
  if (err instanceof PermissionError || err instanceof RoleRequiredError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Property not found." }, { status: 404 });
    }
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "A property with this name already exists." },
        { status: 409 }
      );
    }
  }
  return NextResponse.json({ error: "An unexpected error occurred." }, { status: 500 });
}

// ---------------------------------------------------------------------------
// PATCH — update property
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ data: PropertyRow } | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    requireRole(role, ["SuperAdmin"]);
  } catch (err) {
    return handleError(err);
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const updateData: Prisma.PropertyUpdateInput = {};
  if (typeof body.name === "string") updateData.name = body.name.trim();
  if (body.address !== undefined)
    updateData.address =
      typeof body.address === "string" ? body.address.trim() || null : null;
  if (typeof body.city === "string") updateData.city = body.city.trim();
  if (typeof body.state === "string") updateData.state = body.state.trim();
  if (typeof body.comm === "number") updateData.comm = body.comm;
  if (typeof body.capital === "number") updateData.capital = body.capital;
  if (typeof body.type === "string") updateData.type = body.type.trim();
  if (typeof body.rooms === "number") updateData.rooms = Math.floor(body.rooms);
  if (Array.isArray(body.assets)) updateData.assets = body.assets;

  try {
    const property = await prisma.property.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ data: serializeProperty(property) });
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE — guarded delete
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    requireRole(role, ["SuperAdmin"]);
  } catch (err) {
    return handleError(err);
  }

  const { id } = await params;

  try {
    const [bookingCount, expenseCount, investorCount, payoutCount] =
      await Promise.all([
        prisma.booking.count({ where: { property_id: id } }),
        prisma.dailyExpense.count({ where: { property_id: id } }),
        prisma.investor.count({ where: { property_id: id } }),
        prisma.payout.count({ where: { property_id: id } }),
      ]);

    const blockers: string[] = [];
    if (bookingCount > 0) blockers.push(`${bookingCount} booking(s)`);
    if (expenseCount > 0) blockers.push(`${expenseCount} daily expense(s)`);
    if (investorCount > 0) blockers.push(`${investorCount} investor(s)`);
    if (payoutCount > 0) blockers.push(`${payoutCount} payout record(s)`);

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this property. It has related records: ${blockers.join(", ")}. Remove them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.property.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
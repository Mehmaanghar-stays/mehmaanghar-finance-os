// src/app/api/properties/route.ts
// =============================================================================
// MehmanGhar Financial OS — Properties API Route
//
// Full CRUD for the Property model.
//
// GET    — list properties. SuperAdmin sees all; Admin sees only properties
//          they have bookings or daily_expenses on.
// POST   — create property. SuperAdmin only.
// PUT    — update property by id (in request body). SuperAdmin only.
// DELETE — soft-delete guard: 409 if related bookings or daily_expenses exist.
//          SuperAdmin only.
//
// Permission checks are the first operation in every method handler.
// No financial calculations of any kind in this file.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  assertPermission,
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

interface PropertyListResponse {
  data: PropertyRow[];
}

interface PropertySingleResponse {
  data: PropertyRow;
}

interface ErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// Serializer — converts Prisma Property to PropertyRow (Decimal → number)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Error handler — maps known Prisma codes to HTTP responses
// ---------------------------------------------------------------------------

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
  return NextResponse.json(
    { error: "An unexpected error occurred." },
    { status: 500 }
  );
}

// ---------------------------------------------------------------------------
// GET — list properties
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest
): Promise<NextResponse<PropertyListResponse | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    await assertPermission(role, "properties", "read");
  } catch (err) {
    return handleError(err);
  }

  try {
    let properties;

    if (role === "SuperAdmin") {
      // SuperAdmin sees all properties
      properties = await prisma.property.findMany({
        orderBy: { name: "asc" },
      });
    } else {
      // Admin sees only properties they have bookings or daily_expenses on.
      // We resolve this by finding all property_ids referenced in those tables,
      // then fetching those properties.
      const userId = request.headers.get("x-user-id") ?? "";

      // Bookings and daily expenses are not scoped per-user in the schema —
      // Admin can access all records in their allowed tabs. The restriction
      // here is: Admin sees properties that have any bookings or daily expenses,
      // i.e. properties that are "active" from an Admin perspective.
      const [bookingProps, expenseProps] = await Promise.all([
        prisma.booking.findMany({
          select: { property_id: true },
          distinct: ["property_id"],
        }),
        prisma.dailyExpense.findMany({
          select: { property_id: true },
          distinct: ["property_id"],
        }),
      ]);

      // Suppress unused variable warning — userId is available for future
      // per-user scoping if the business owner requests it.
      void userId;

      const propertyIds = [
        ...new Set([
          ...bookingProps.map((b) => b.property_id),
          ...expenseProps.map((e) => e.property_id),
        ]),
      ];

      properties = await prisma.property.findMany({
        where: { id: { in: propertyIds } },
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({ data: properties.map(serializeProperty) });
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// POST — create property (SuperAdmin only)
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest
): Promise<NextResponse<PropertySingleResponse | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    requireRole(role, ["SuperAdmin"]);
  } catch (err) {
    return handleError(err);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = body.name;
  if (typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "Field \"name\" is required and must be a non-empty string." },
      { status: 422 }
    );
  }

  try {
    const property = await prisma.property.create({
      data: {
        name: name.trim(),
        address: typeof body.address === "string" ? body.address.trim() : null,
        city: typeof body.city === "string" ? body.city.trim() : "",
        state: typeof body.state === "string" ? body.state.trim() : "",
        comm:
          typeof body.comm === "number"
            ? body.comm
            : new Prisma.Decimal(25),
        capital:
          typeof body.capital === "number"
            ? body.capital
            : new Prisma.Decimal(0),
        type: typeof body.type === "string" ? body.type.trim() : "",
        rooms: typeof body.rooms === "number" ? Math.floor(body.rooms) : 0,
        assets: Array.isArray(body.assets) ? body.assets : [],
      },
    });

    return NextResponse.json({ data: serializeProperty(property) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// PUT — update property by id (SuperAdmin only)
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest
): Promise<NextResponse<PropertySingleResponse | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    requireRole(role, ["SuperAdmin"]);
  } catch (err) {
    return handleError(err);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = body.id;
  if (typeof id !== "string" || id.trim() === "") {
    return NextResponse.json(
      { error: "Field \"id\" is required in the request body." },
      { status: 422 }
    );
  }

  // Build update payload — only include fields that were provided
  const updateData: Prisma.PropertyUpdateInput = {};
  if (typeof body.name === "string") updateData.name = body.name.trim();
  if (body.address !== undefined)
    updateData.address =
      typeof body.address === "string" ? body.address.trim() : null;
  if (typeof body.city === "string") updateData.city = body.city.trim();
  if (typeof body.state === "string") updateData.state = body.state.trim();
  if (typeof body.comm === "number") updateData.comm = body.comm;
  if (typeof body.capital === "number") updateData.capital = body.capital;
  if (typeof body.type === "string") updateData.type = body.type.trim();
  if (typeof body.rooms === "number") updateData.rooms = Math.floor(body.rooms);
  if (Array.isArray(body.assets)) updateData.assets = body.assets;

  try {
    const property = await prisma.property.update({
      where: { id: id.trim() },
      data: updateData,
    });

    return NextResponse.json({ data: serializeProperty(property) });
  } catch (err) {
    return handleError(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE — guarded delete (SuperAdmin only)
// 409 if related bookings or daily_expenses exist
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  const role = request.headers.get("x-user-role") ?? "";

  try {
    requireRole(role, ["SuperAdmin"]);
  } catch (err) {
    return handleError(err);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const id = body.id;
  if (typeof id !== "string" || id.trim() === "") {
    return NextResponse.json(
      { error: "Field \"id\" is required in the request body." },
      { status: 422 }
    );
  }

  const propertyId = id.trim();

  try {
    // Check for related records before attempting deletion
    const [bookingCount, expenseCount, investorCount, payoutCount] =
      await Promise.all([
        prisma.booking.count({ where: { property_id: propertyId } }),
        prisma.dailyExpense.count({ where: { property_id: propertyId } }),
        prisma.investor.count({ where: { property_id: propertyId } }),
        prisma.payout.count({ where: { property_id: propertyId } }),
      ]);

    const blockers: string[] = [];
    if (bookingCount > 0)
      blockers.push(`${bookingCount} booking(s)`);
    if (expenseCount > 0)
      blockers.push(`${expenseCount} daily expense(s)`);
    if (investorCount > 0)
      blockers.push(`${investorCount} investor(s)`);
    if (payoutCount > 0)
      blockers.push(`${payoutCount} payout record(s)`);

    if (blockers.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this property. It has related records: ${blockers.join(", ")}. Remove them first.`,
        },
        { status: 409 }
      );
    }

    await prisma.property.delete({ where: { id: propertyId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
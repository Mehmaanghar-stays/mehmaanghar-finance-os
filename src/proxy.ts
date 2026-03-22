// src/proxy.ts
// =============================================================================
// MehmanGhar Financial OS — JWT + Role Guard Proxy
//
// Next.js 16: middleware.ts is deprecated. This file must be named proxy.ts
// and the exported function must be named `proxy`.
// Runtime: Node.js (default for proxy.ts — Edge runtime is not supported here).
//
// Responsibilities:
//   1. Extract the session JWT from the HttpOnly cookie.
//   2. Verify the JWT using jose jwtVerify (HS256).
//   3. Reject unauthenticated requests with a 401 (API routes) or redirect
//      to /login (page routes).
//   4. Forward verified user context to downstream handlers via request headers
//      (x-user-id, x-user-role) so API routes can read it without re-verifying.
//
// Design note: This proxy performs only JWT crypto — no database calls.
// Fine-grained per-route role checks happen inside each API route using
// src/lib/permissions.ts. This layer only ensures the token is present and valid.
// =============================================================================

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, errors as joseErrors } from "jose";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COOKIE_NAME = process.env.COOKIE_NAME ?? "mg_session";
const LOGIN_PATH = "/login";

// ---------------------------------------------------------------------------
// Route matcher — tells Next.js which paths run this proxy
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT Next.js internals and static assets.
     * The login page is allowed through by explicit check inside the function.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

// ---------------------------------------------------------------------------
// JWT payload shape — mirrors the payload written in src/lib/auth.ts signToken()
// ---------------------------------------------------------------------------

interface JwtPayload {
  sub: string;   // user UUID
  role: string;  // e.g. "SuperAdmin" | "Admin"
}

// ---------------------------------------------------------------------------
// Proxy entry point
// ---------------------------------------------------------------------------

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // ----------------------------------------------------------
  // 1. Always allow the login page through — no token needed.
  // ----------------------------------------------------------
  if (pathname === LOGIN_PATH || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // ----------------------------------------------------------
  // 2. Extract session token from the HttpOnly cookie.
  // ----------------------------------------------------------
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return rejectRequest(request, pathname, "No session token.");
  }

  // ----------------------------------------------------------
  // 3. Verify the JWT.
  // ----------------------------------------------------------
  let payload: JwtPayload;

  try {
    const secret = getJwtSecret();
    const { payload: verified } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    if (typeof verified.sub !== "string" || typeof verified["role"] !== "string") {
      return rejectRequest(request, pathname, "Malformed token payload.");
    }

    payload = {
      sub: verified.sub,
      role: verified["role"] as string,
    };
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      return rejectRequest(request, pathname, "Session expired.");
    }
    if (
      err instanceof joseErrors.JWTInvalid ||
      err instanceof joseErrors.JWSInvalid ||
      err instanceof joseErrors.JWSSignatureVerificationFailed
    ) {
      return rejectRequest(request, pathname, "Invalid token.");
    }
    // Unexpected error — do not expose detail to client.
    console.error("[proxy] JWT verification failed:", err);
    return rejectRequest(request, pathname, "Authentication error.");
  }

  // ----------------------------------------------------------
  // 4. Token is valid. Forward user context via request headers.
  //    API routes read these with: request.headers.get("x-user-id")
  // ----------------------------------------------------------
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", payload.sub);
  requestHeaders.set("x-user-role", payload.role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET is missing or too short. Set a strong value in .env.local."
    );
  }
  return new TextEncoder().encode(secret);
}

function rejectRequest(
  request: NextRequest,
  pathname: string,
  reason: string
): NextResponse {
  const isApiRoute = pathname.startsWith("/api/");

  if (isApiRoute) {
    return NextResponse.json(
      { error: "Unauthorised.", reason },
      { status: 401 }
    );
  }

  // Page routes: redirect to /login with the intended destination as ?next=
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

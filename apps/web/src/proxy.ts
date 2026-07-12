import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { vars } from "@/vars";
import { ACCESS_TOKEN_MAX_AGE, AUTH_COOKIE_OPTS, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

// Next.js 16 proxy (formerly middleware). Runs before a page renders: it
// verifies the session tokens, silently rotates them via the backend when the
// access token has expired (but the refresh token is still valid), writes the
// fresh tokens as httpOnly cookies, and injects the bearer + current pathname
// into the request so server components (getCurrentUser / PermissionGuard) can
// read them without re-reading cookies.

const accessSecret = new TextEncoder().encode(
  process.env.ACCESS_TOKEN_SECRET ?? "",
);
const refreshSecret = new TextEncoder().encode(
  process.env.REFRESH_TOKEN_SECRET ?? "",
);

// Cryptographically verify a JWT against the shared secret (same secret the
// NestJS backend signs with). Returns true only for a well-formed, unexpired token.
async function isTokenValid(
  token: string,
  secret: Uint8Array,
): Promise<boolean> {
  if (!secret.length) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Centralized token rotation: ask the backend to mint a fresh access/refresh
// pair from the stored refresh token. Returns null on any failure.
async function rotateTokens(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${vars.API_GATEWAY_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!json.accessToken || !json.refreshToken) return null;
    return { accessToken: json.accessToken, refreshToken: json.refreshToken };
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Stamp the pathname so the server-side PermissionGuard can resolve the
  // route's required permission.
  requestHeaders.set("x-current-path", request.nextUrl.pathname);

  const accessToken = request.cookies.get("accessToken")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  let authorization: string | null = null;
  let rotated: { accessToken: string; refreshToken: string } | null = null;

  const accessValid = accessToken
    ? await isTokenValid(accessToken, accessSecret)
    : false;

  if (accessValid && accessToken) {
    authorization = `Bearer ${accessToken}`;
  } else if (refreshToken && (await isTokenValid(refreshToken, refreshSecret))) {
    // Access token expired/missing but the refresh token is still good — rotate.
    rotated = await rotateTokens(refreshToken);
    if (rotated) {
      authorization = `Bearer ${rotated.accessToken}`;
    }
  }

  // Expose the (verified or freshly rotated) bearer to downstream server code.
  if (authorization) {
    requestHeaders.set("authorization", authorization);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // Persist the rotated tokens as httpOnly cookies for the browser.
  if (rotated) {
    response.cookies.set("accessToken", rotated.accessToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    response.cookies.set("refreshToken", rotated.refreshToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  return response;
}

// Run on every page except the BFF API routes, Next internals, and static
// assets. The /api tree is handled by the catch-all proxy, not the middleware.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\.).*)",
  ],
};

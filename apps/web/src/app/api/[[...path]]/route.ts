import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { vars } from "@/vars";
import {
  ACCESS_TOKEN_MAX_AGE,
  AUTH_COOKIE_OPTS,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-cookies";

// Node runtime: we do a server-side fetch to the NestJS backend and may read
// cookies, so the default Node.js runtime (not Edge) is required.
export const runtime = "nodejs";

// Strip the /api prefix to recover the upstream path. The catch-all matches
// /api/*, so pathname is always "/api/...". Guard against a bare "/api".
function upstreamPath(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/api\/?/, "");
  return withoutPrefix.startsWith("/") ? withoutPrefix : `/${withoutPrefix}`;
}

// Forward only the headers the backend needs; drop hop-by-hop headers and the
// cookie (the backend is token-based, not cookie-based).
function upstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "cookie" ||
      lower === "connection"
    ) {
      continue;
    }
    headers.set(key, value);
  }
  return headers;
}

// If the backend returned a fresh token pair (login/register/refresh), set them
// as httpOnly cookies on the browser-facing response.
function applyAuthCookies(
  response: NextResponse,
  body: Record<string, unknown> | null,
): void {
  if (!body) return;
  const accessToken = body.accessToken;
  const refreshToken = body.refreshToken;
  if (typeof accessToken === "string") {
    response.cookies.set("accessToken", accessToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }
  if (typeof refreshToken === "string") {
    response.cookies.set("refreshToken", refreshToken, {
      ...AUTH_COOKIE_OPTS,
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }
}

async function proxy(request: NextRequest): Promise<NextResponse> {
  const path = upstreamPath(request.nextUrl.pathname);
  const target = `${vars.API_GATEWAY_URL}${path}${request.nextUrl.search}`;

  const headers = upstreamHeaders(request);

  // Inject the bearer token from the httpOnly cookie so the token-based backend
  // can authenticate the request. The browser's own Authorization header (if
  // any) is preserved.
  const store = await cookies();
  const accessToken = store.get("accessToken")?.value;
  if (accessToken && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  let backendRes: Response;
  try {
    backendRes = await fetch(target, {
      method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to reach the server. Try again." },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  const contentType = backendRes.headers.get("content-type") ?? "";
  for (const [key, value] of backendRes.headers) {
    const lower = key.toLowerCase();
    if (
      [
        "content-type",
        "content-disposition",
        "content-length",
        "cache-control",
        "pragma",
        "expires",
        "etag",
        "location",
      ].includes(lower)
    ) {
      responseHeaders.set(key, value);
    }
  }
  // Forward any Set-Cookie the backend emits (future-proofing).
  const setCookies = backendRes.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    responseHeaders.append("set-cookie", cookie);
  }

  const status = backendRes.status;

  // JSON responses: parse so we can extract + set auth cookies, then re-emit.
  if (contentType.includes("application/json")) {
    const json = (await backendRes.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    const response = NextResponse.json(json ?? {}, {
      status,
      headers: responseHeaders,
    });
    applyAuthCookies(response, json);
    return response;
  }

  // Everything else (PDF invoices, etc.) — stream the bytes straight through.
  const buffer = await backendRes.arrayBuffer();
  return new NextResponse(buffer, { status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;

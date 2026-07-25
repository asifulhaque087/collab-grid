import { NextRequest, NextResponse } from "next/server";
import { vars } from "@/vars";
import { ACCESS_TOKEN_MAX_AGE, AUTH_COOKIE_OPTS, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

// Node runtime: we do a server-side fetch to the NestJS backend.
export const runtime = "nodejs";

// Strip the /api prefix to recover the upstream path. The catch-all matches
// /api/*, so pathname is always "/api/...". Guard against a bare "/api".
function upstreamPath(pathname: string): string {
  const withoutPrefix = pathname.replace(/^\/api\/private\/?/, "");
  return withoutPrefix.startsWith("/") ? withoutPrefix : `/${withoutPrefix}`;
}

// Forward only the headers the backend needs; drop hop-by-hop headers, the
// cookie (the backend is token-based, not cookie-based), and let the
// middleware-injected `authorization` header authenticate the upstream call.
function upstreamHeaders(request: NextRequest, bodyLength?: number): Headers {
  const headers = new Headers();

  const key = "authorization";
  // const value = request.headers.get("authorization");
  const value = request.headers.get("authorization") ?? "";

  // console.log("|||||||||||||||||||||||||||||||| ", request.headers.get("x-current-path"));
  // console.log("|||||||||||||||||||||||||||||||| ", request.headers);
  // console.log("|||||||||||||||||||||||||||||||| ", value);

  if (!value) throw new Error("Unauthorizationnnnnn");

  headers.set(key, value);

  const contentType = request.headers.get("content-type") ?? "application/json";
  headers.set("Content-Type", contentType);

  if (bodyLength !== undefined && bodyLength > 0) {
    headers.set("Content-Length", bodyLength.toString());
  }

  return headers;
}

// If the backend returned a fresh token pair (login/register/refresh), set them
// as httpOnly cookies on the browser-facing response.
function applyAuthCookies(response: NextResponse, body: Record<string, unknown> | null): void {
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

  // const headers = upstreamHeaders(request);

  const method = request.method;
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const headers = upstreamHeaders(request, body?.byteLength);

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
    return NextResponse.json({ message: "Unable to reach the server. Try again." }, { status: 502 });
  }

  const responseHeaders = new Headers();
  const contentType = backendRes.headers.get("content-type") ?? "";

  const status = backendRes.status;
  // console.log("backend response is ", backendRes);

  if (status === 204 || status === 304) {
    return new NextResponse(null, { status, headers: responseHeaders });
  }

  // JSON responses: parse so we can extract + set auth cookies, then re-emit.
  if (contentType.includes("application/json")) {
    const json = (await backendRes.json().catch(() => null)) as Record<string, unknown> | null;
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

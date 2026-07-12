import { cookies, headers } from "next/headers";

export { extractErrorMessage } from "@/lib/errors";
export {
  ACCESS_TOKEN_MAX_AGE,
  AUTH_COOKIE_OPTS,
  REFRESH_TOKEN_MAX_AGE,
} from "@/lib/auth-cookies";

// The browser-facing BFF prefix. Every browser API call hits /api/*, which the
// catch-all route (app/api/[[...path]]/route.ts) proxies to the NestJS backend.
export const API_ROUTE = "/api";

// Absolute URL to the BFF route for server-side fetches. Server components and
// server actions run on the Next server, so they reach their own /api route via
// the incoming request's host. Routing them through /api keeps every backend
// call flowing through the single BFF entry point.
export async function bffUrl(path: string): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${proto}://${host}${API_ROUTE}${clean}`;
}

// Forward the current auth cookies on a server-side BFF call so the catch-all
// route can read them and mint the upstream bearer token. A bare server fetch
// does not automatically forward the browser's cookies.
export async function serverBffCookies(): Promise<string | undefined> {
  const store = await cookies();
  const parts: string[] = [];
  const accessToken = store.get("accessToken")?.value;
  const refreshToken = store.get("refreshToken")?.value;
  if (accessToken) parts.push(`accessToken=${accessToken}`);
  if (refreshToken) parts.push(`refreshToken=${refreshToken}`);
  return parts.length ? parts.join("; ") : undefined;
}

// Server-side fetch through the BFF. Forwards the auth cookies so the upstream
// request is authenticated, and forces no-store so session data is never cached.
// Callers must set Content-Type themselves (e.g. application/json for JSON
// bodies, or leave it unset for FormData/multipart uploads).
export async function bffFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = await bffUrl(path);
  const cookieHeader = await serverBffCookies();
  const requestHeaders = new Headers(init.headers);
  if (cookieHeader) requestHeaders.set("Cookie", cookieHeader);
  // Forward a bearer the middleware may have verified/rotated on this very
  // request, so the upstream call uses the freshest token.
  const incomingAuth = (await headers()).get("authorization");
  if (incomingAuth && !requestHeaders.has("authorization")) {
    requestHeaders.set("authorization", incomingAuth);
  }
  return fetch(url, {
    ...init,
    headers: requestHeaders,
    cache: "no-store",
  });
}

import { headers } from "next/headers";
import { vars } from "@/vars";

export { extractErrorMessage } from "@/lib/errors";
export { ACCESS_TOKEN_MAX_AGE, AUTH_COOKIE_OPTS, REFRESH_TOKEN_MAX_AGE } from "@/lib/auth-cookies";

const API_URL = vars.API_GATEWAY_URL;
export { API_URL };

// The middleware (proxy.ts) verifies the session and injects the bearer token
// as the `authorization` request header. Server code trusts that header instead
// of reading raw cookies — it never parses or stores the token itself.
export async function authBearer(): Promise<string | undefined> {
  return (await headers()).get("authorization") ?? undefined;
}

// Headers carrying the injected bearer token (authorization only — for GETs).
export async function authHeaders(): Promise<HeadersInit> {
  const auth = await authBearer();
  return auth ? { authorization: auth } : {};
}

// Headers carrying the injected bearer token + JSON content type.
export async function jsonHeaders(): Promise<HeadersInit> {
  const auth = await authBearer();
  return {
    ...(auth ? { Authorization: auth } : {}),
    "Content-Type": "application/json",
  };
}

const LOCAL_SERVER = "http://localhost:3000";

// Prepend /api/private to the local server or API_URL
export async function privateApi(endpoint: string, options: RequestInit = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return fetch(`${LOCAL_SERVER}/api/private${cleanEndpoint}`, options);
}

// Prepend /api/public to the local server or API_URL
export async function publicApi(endpoint: string, options: RequestInit = {}) {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return fetch(`${LOCAL_SERVER}/api/public${cleanEndpoint}`, options);
}

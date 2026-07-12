import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Quota } from "@/lib/ability";
import { vars } from "@/vars";

// Browser-facing API origin for the Google OAuth full-page redirect. Computed
// in server components and threaded down to the (client) Google button so the
// callback's cookies land directly on the browser.
export function googleAuthUrl(): string {
  return `${vars.PUBLIC_API_GATEWAY_URL}/auth/google`;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  roles: string[];
  permissions: { action: string; subject: string }[];
  quotas: Quota[];
}

// Resolves the signed-in user from the BFF, or null when there's no valid
// session. Wrapped in React's `cache()` so repeated calls within a single
// request are de-duplicated. Only ever called from routes the middleware covers
// (dashboard / auth pages), so the `authorization` header the middleware
// injected is present and is forwarded to the BFF route, which authenticates
// the upstream Nest call. Best-effort: never throws.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const headerList = await headers();
  const auth = headerList.get("authorization");
  // Server-side fetch needs an absolute URL for the self BFF route.
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("host") ?? "localhost:3000";
  const base = `${proto}://${host}`;
  // console.log("(((((((((((((((((((((( ", auth);
  try {
    const res = await fetch(`${base}/api/private/auth/me`, {
      headers: auth ? { authorization: auth } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
});

// Resolves the signed-in user or bounces to sign-in. Used to gate the dashboard
// layout — every page below it requires an authenticated session.
// export async function requireAuth(): Promise<CurrentUser> {
//   const user = await getCurrentUser();
//   // if (!user) redirect("/sign-in");
//   return user;
// }

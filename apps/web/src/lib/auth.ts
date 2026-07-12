import { cache } from "react";
import { redirect } from "next/navigation";
import type { Quota } from "@/lib/ability";
import { bffFetch } from "@/lib/api";
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
// request are de-duplicated. The BFF (app/api/[[...path]]) injects the bearer
// token from the httpOnly cookie, so this never touches raw tokens. Best-effort:
// never throws.
export const getCurrentUser = cache(
  async (): Promise<CurrentUser | null> => {
    try {
      const res = await bffFetch("/auth/me");
      if (!res.ok) return null;
      return (await res.json()) as CurrentUser;
    } catch {
      return null;
    }
  },
);

// Resolves the signed-in user or bounces to sign-in. Used to gate the dashboard
// layout — every page below it requires an authenticated session.
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

// Browser-facing API origin for the Google OAuth full-page redirect. Computed
// in server components and threaded down to the (client) Google button so the
// callback's cookies land directly on the browser.
export function googleAuthUrl(): string {
  return `${API_URL}/auth/google`;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  roles: string[];
  permissions: { action: string; subject: string }[];
  quotas: unknown[];
}

// Resolves the signed-in user from the auth cookies, or null when there's no
// valid session. Used by the auth route group to bounce logged-in visitors
// away from the login/register/reset pages. Best-effort: never throws.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const accessToken = store.get("accessToken")?.value;
  const refreshToken = store.get("refreshToken")?.value;

  if (!accessToken && !refreshToken) return null;

  const cookieHeader = [
    accessToken && `accessToken=${accessToken}`,
    refreshToken && `refreshToken=${refreshToken}`,
  ]
    .filter(Boolean)
    .join("; ");

  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
}

// Resolves the signed-in user or bounces to sign-in. Used to gate the dashboard
// layout — every page below it requires an authenticated session.
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

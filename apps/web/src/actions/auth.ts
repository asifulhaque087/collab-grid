"use server";

import { cookies } from "next/headers";
import type {
  ForgotPasswordValues,
  ResetPasswordValues,
} from "@/lib/auth-schemas";
import { bffFetch, extractErrorMessage } from "@/lib/api";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// Signs the user out: tells the API to revoke the refresh token (through the
// BFF, which authenticates with the bearer cookie), then clears both cookies on
// the Next side so the browser session ends. Best-effort on the API call —
// cookies are cleared regardless.
export async function logoutAction(): Promise<ActionResult<null>> {
  const store = await cookies();
  const accessToken = store.get("accessToken")?.value;
  const refreshToken = store.get("refreshToken")?.value;

  if (accessToken || refreshToken) {
    try {
      await bffFetch("/auth/logout", { method: "POST" });
    } catch {
      // Ignore — we still clear the local session below.
    }
  }

  store.delete("accessToken");
  store.delete("refreshToken");

  return { success: true, data: null };
}

export async function forgotPasswordAction(
  input: ForgotPasswordValues,
): Promise<ActionResult<{ message: string }>> {
  const res = await bffFetch("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      success: false,
      error: extractErrorMessage(body, "Could not send the reset link"),
    };
  }

  return { success: true, data: body as { message: string } };
}

export async function resetPasswordAction(
  input: ResetPasswordValues,
): Promise<ActionResult<{ message: string }>> {
  const res = await bffFetch("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      success: false,
      error: extractErrorMessage(body, "Could not reset your password"),
    };
  }

  return { success: true, data: body as { message: string } };
}

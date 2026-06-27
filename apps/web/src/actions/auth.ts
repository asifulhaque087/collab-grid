"use server";

import { cookies } from "next/headers";
import type {
  ForgotPasswordValues,
  LoginValues,
  RegisterValues,
  ResetPasswordValues,
} from "@/lib/auth-schemas";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

// NestJS validation errors arrive as `message: string | string[]`. Flatten to
// a single user-facing line.
function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return fallback;
}

// The API sets the auth tokens as httpOnly cookies via Set-Cookie on its own
// response. A server action's fetch receives those headers but they never reach
// the browser, so we copy accessToken/refreshToken onto the Next response.
// Cookies are host-scoped (localhost), so they're shared across the web (3000)
// and api (3001) ports.
async function forwardAuthCookies(res: Response): Promise<void> {
  const store = await cookies();

  for (const raw of res.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();

    if (name !== "accessToken" && name !== "refreshToken") continue;

    const maxAgeAttr = attrs.find((a) =>
      a.trim().toLowerCase().startsWith("max-age="),
    );
    const maxAge = maxAgeAttr ? Number(maxAgeAttr.split("=")[1]) : undefined;

    store.set(name, value, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      ...(maxAge !== undefined && !Number.isNaN(maxAge) ? { maxAge } : {}),
    });
  }
}

async function postJson(
  path: string,
  payload: unknown,
): Promise<ActionResult<Response>> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { success: true, data: res };
  } catch {
    return { success: false, error: "Unable to reach the server. Try again." };
  }
}

export async function loginAction(
  input: LoginValues,
): Promise<ActionResult<{ id: string; name: string; email: string }>> {
  const result = await postJson("/auth/login", input);
  if (!result.success) return result;

  const res = result.data;
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { success: false, error: extractMessage(body, "Login failed") };
  }

  await forwardAuthCookies(res);
  return { success: true, data: body };
}

export async function registerAction(
  input: RegisterValues,
): Promise<ActionResult<{ id: string; name: string; email: string }>> {
  const result = await postJson("/auth/register", input);
  if (!result.success) return result;

  const res = result.data;
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: extractMessage(body, "Registration failed"),
    };
  }

  await forwardAuthCookies(res);
  return { success: true, data: body };
}

// Signs the user out: tells the API to revoke the refresh token (forwarding the
// auth cookies), then clears both cookies on the Next side so the browser
// session ends. Best-effort on the API call — cookies are cleared regardless.
export async function logoutAction(): Promise<ActionResult<null>> {
  const store = await cookies();
  const accessToken = store.get("accessToken")?.value;
  const refreshToken = store.get("refreshToken")?.value;

  const cookieHeader = [
    accessToken && `accessToken=${accessToken}`,
    refreshToken && `refreshToken=${refreshToken}`,
  ]
    .filter(Boolean)
    .join("; ");

  try {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader },
    });
  } catch {
    // Ignore — we still clear the local session below.
  }

  store.delete("accessToken");
  store.delete("refreshToken");

  return { success: true, data: null };
}

export async function forgotPasswordAction(
  input: ForgotPasswordValues,
): Promise<ActionResult<{ message: string }>> {
  const result = await postJson("/auth/forgot-password", input);
  if (!result.success) return result;

  const res = result.data;
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: extractMessage(body, "Could not send the reset link"),
    };
  }

  return { success: true, data: body };
}

export async function resetPasswordAction(
  input: ResetPasswordValues,
): Promise<ActionResult<{ message: string }>> {
  const result = await postJson("/auth/reset-password", input);
  if (!result.success) return result;

  const res = result.data;
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      success: false,
      error: extractMessage(body, "Could not reset your password"),
    };
  }

  return { success: true, data: body };
}

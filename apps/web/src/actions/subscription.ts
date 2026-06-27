"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/auth";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  return token
    ? { Cookie: `accessToken=${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export type SubscribeResult = {
  plan: string;
  planExpiresAt: string;
  amountPaid: string;
  transactionId: string;
};

// Activates a plan for the freshly registered tenant. No real gateway yet —
// the demo transaction id stands in for a payment confirmation.
export async function subscribeAction(input: {
  plan: string;
  durationMonth: 1 | 6 | 12 | 24;
}): Promise<ActionResult<SubscribeResult>> {
  const transactionId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `demo-${crypto.randomUUID()}`
      : `demo-${Date.now()}`;

  let res: Response;
  try {
    res = await fetch(`${API_URL}/subscription`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ ...input, transactionId }),
    });
  } catch {
    return { success: false, error: "Unable to reach the server. Try again." };
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? Array.isArray((body as { message: unknown }).message)
          ? ((body as { message: string[] }).message).join(", ")
          : String((body as { message: unknown }).message)
        : "Subscription failed";
    return { success: false, error: message };
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/transactions");
  return { success: true, data: body as SubscribeResult };
}

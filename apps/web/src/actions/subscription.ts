"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/auth";
import { API_URL, extractErrorMessage, jsonHeaders } from "@/lib/api";

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
      headers: await jsonHeaders(),
      body: JSON.stringify({ ...input, transactionId }),
    });
  } catch {
    return { success: false, error: "Unable to reach the server. Try again." };
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    return { success: false, error: extractErrorMessage(body, "Subscription failed") };
  }

  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard/transactions");
  return { success: true, data: body as SubscribeResult };
}

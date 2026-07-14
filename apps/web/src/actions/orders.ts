"use server";

import { publicApi } from "@/lib/api";

type ApiError = { message?: string };

export interface OrderInput {
  idempotencyKey: string;
  boardId: string;
  buyerUserId: string;
  widgetIds: string[];
  email?: string;
  phone: string;
  address: string;
  cardLast4?: string;
}

export interface OrderResult {
  success: boolean;
  data?: { orderId: string; duplicate: boolean };
  error?: string;
}

// Anonymous end-user checkout — no auth. The idempotencyKey makes a repeat
// submit a no-op (returns the original order) instead of a double charge.
export async function createOrder(input: OrderInput): Promise<OrderResult> {
  const res = await publicApi("/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    return {
      success: false,
      error: body?.message ?? "Payment failed. Please try again.",
    };
  }

  return { success: true, data: await res.json() };
}

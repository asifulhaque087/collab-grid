"use server";

import { publicApi, privateApi } from "@/lib/api";
import type { Order } from "@/types";

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

interface ApiOrder {
  id: string;
  buyerName: string | null;
  email: string | null;
  amountTotal: string;
  paymentMethod: string;
  cardLast4: string | null;
  status: 'paid';
  createdAt: Date;
  boardId: string | null;
  boardName: string | null;
  items: { id: string; name: string; sku: string; price: string; quantity: number }[];
}

function mapOrder(o: ApiOrder): Order {
  const firstItem = o.items[0];
  return {
    id: o.id,
    customer: o.buyerName ?? o.email ?? "Anonymous",
    widget: firstItem?.name ?? "—",
    board: o.boardName ?? "—",
    amount: `৳${Number(o.amountTotal).toLocaleString()}`,
    amountTone: "committed" as const,
    payment: o.cardLast4 ? `${o.paymentMethod} •••• ${o.cardLast4}` : o.paymentMethod,
    status: o.status,
    date: new Date(o.createdAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
  };
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

// Tenant-scoped order listing — requires authentication.
export async function getOrders(): Promise<Order[]> {
  const res = await privateApi("/orders");

  if (!res.ok) {
    return [];
  }

  const data = (await res.json()) as ApiOrder[];
  return data.map(mapOrder);
}

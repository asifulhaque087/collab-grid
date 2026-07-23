"use server";

import { revalidatePath } from "next/cache";
import { jsonHeaders, privateApi } from "@/lib/api";

type ApiError = { message?: string };

export interface PlanPermissionQuota {
  permissionId: string;
  limit: number;
}

export async function createPlan(data: { name: string; price: string; permissions: PlanPermissionQuota[] }) {
  const res = await privateApi("/packages", {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to create plan");
  }

  revalidatePath("/dashboard/plans");
  return res.json();
}

export async function updatePlan(id: string, data: { name?: string; price?: string; permissions?: PlanPermissionQuota[] }) {
  const res = await privateApi(`/packages/${id}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to update plan");
  }

  revalidatePath("/dashboard/plans");
  return res.json();
}

export async function deletePlan(id: string) {
  const res = await privateApi(`/packages/${id}`, {
    method: "DELETE",
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to delete plan");
  }

  revalidatePath("/dashboard/plans");
}

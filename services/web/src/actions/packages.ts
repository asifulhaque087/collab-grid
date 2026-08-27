"use server";

import { revalidatePath } from "next/cache";
import { jsonHeaders, privateApi } from "@/lib/api";

type ApiError = { message?: string };

export interface PackagePermissionQuota {
  permissionId: string;
  limit: number;
}

export async function createPackage(data: { name: string; price: string; permissions: PackagePermissionQuota[] }) {
  const res = await privateApi("/packages", {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to create package");
  }

  revalidatePath("/dashboard/packages");
  return res.json();
}

export async function updatePackage(id: string, data: { name?: string; price?: string; permissions?: PackagePermissionQuota[] }) {
  const res = await privateApi(`/packages/${id}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to update package");
  }

  revalidatePath("/dashboard/packages");
  return res.json();
}

export async function deletePackage(id: string) {
  const res = await privateApi(`/packages/${id}`, {
    method: "DELETE",
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to delete package");
  }

  revalidatePath("/dashboard/packages");
}

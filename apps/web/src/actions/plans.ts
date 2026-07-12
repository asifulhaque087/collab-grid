'use server';

import { revalidatePath } from 'next/cache';
import { API_URL, jsonHeaders } from '@/lib/api';

type ApiError = { message?: string };

export interface PlanPermissionQuota {
  permissionId: string;
  totalOperation: number;
}

export async function createPlan(data: {
  name: string;
  permissions: PlanPermissionQuota[];
}) {
  const res = await fetch(`${API_URL}/plans`, {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to create plan');
  }

  revalidatePath('/dashboard/plans');
  return res.json();
}

export async function updatePlan(
  id: string,
  data: { name?: string; permissions?: PlanPermissionQuota[] },
) {
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: 'PATCH',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to update plan');
  }

  revalidatePath('/dashboard/plans');
  return res.json();
}

export async function deletePlan(id: string) {
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: 'DELETE',
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to delete plan');
  }

  revalidatePath('/dashboard/plans');
}

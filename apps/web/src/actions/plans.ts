'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { vars } from '@/vars';

const API_URL = vars.API_GATEWAY_URL;

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get('accessToken')?.value;
  return token
    ? { Cookie: `accessToken=${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

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
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
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
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to update plan');
  }

  revalidatePath('/dashboard/plans');
  return res.json();
}

export async function deletePlan(id: string) {
  const res = await fetch(`${API_URL}/plans/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to delete plan');
  }

  revalidatePath('/dashboard/plans');
}

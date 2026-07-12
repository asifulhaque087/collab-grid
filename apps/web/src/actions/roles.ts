'use server';

import { revalidatePath } from 'next/cache';
import { bffFetch } from '@/lib/api';

type ApiError = { message?: string };

export async function createRole(data: {
  name: string;
  permissionIds: string[];
}) {
  const res = await bffFetch('/roles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to create role');
  }

  revalidatePath('/dashboard/roles');
  return res.json();
}

export async function updateRole(
  id: string,
  data: { name?: string; permissionIds?: string[] },
) {
  const res = await bffFetch(`/roles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to update role');
  }

  revalidatePath('/dashboard/roles');
  return res.json();
}

export async function deleteRole(id: string) {
  const res = await bffFetch(`/roles/${id}`, { method: 'DELETE' });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to delete role');
  }

  revalidatePath('/dashboard/roles');
}

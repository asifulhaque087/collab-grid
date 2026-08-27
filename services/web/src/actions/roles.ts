'use server';

import { revalidatePath } from 'next/cache';
import { jsonHeaders, privateApi } from '@/lib/api';

type ApiError = { message?: string };

export async function createRole(data: {
  name: string;
  permissionIds: string[];
}) {
  const res = await privateApi('/roles', {
    method: 'POST',
    headers: await jsonHeaders(),
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
  const res = await privateApi(`/roles/${id}`, {
    method: 'PATCH',
    headers: await jsonHeaders(),
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
  const res = await privateApi(`/roles/${id}`, {
    method: 'DELETE',
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to delete role');
  }

  revalidatePath('/dashboard/roles');
}
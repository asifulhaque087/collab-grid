'use server';

import { revalidatePath } from 'next/cache';
import { jsonHeaders, privateApi } from '@/lib/api';

type ApiError = { message?: string };

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  roleIds: string[];
}) {
  const res = await privateApi('/users', {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to create user');
  }

  revalidatePath('/dashboard/users');
  return res.json();
}

export async function updateUser(
  id: string,
  data: { name?: string; email?: string; password?: string; roleIds?: string[] },
) {
  const res = await privateApi(`/users/${id}`, {
    method: 'PATCH',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to update user');
  }

  revalidatePath('/dashboard/users');
  return res.json();
}

export async function deleteUser(id: string) {
  const res = await privateApi(`/users/${id}`, {
    method: 'DELETE',
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to delete user');
  }

  revalidatePath('/dashboard/users');
}

'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get('accessToken')?.value;
  return token
    ? { Cookie: `accessToken=${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function createRole(data: {
  name: string;
  permissionIds: string[];
}) {
  const res = await fetch(`${API_URL}/roles`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to create role');
  }

  revalidatePath('/dashboard/roles');
  return res.json();
}

export async function updateRole(
  id: string,
  data: { name?: string; permissionIds?: string[] },
) {
  const res = await fetch(`${API_URL}/roles/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to update role');
  }

  revalidatePath('/dashboard/roles');
  return res.json();
}

export async function deleteRole(id: string) {
  const res = await fetch(`${API_URL}/roles/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to delete role');
  }

  revalidatePath('/dashboard/roles');
}

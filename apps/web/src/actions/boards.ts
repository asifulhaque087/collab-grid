'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { ApiBoard } from '@/types';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

async function authHeaders(): Promise<HeadersInit> {
  const store = await cookies();
  const token = store.get('accessToken')?.value;
  return token
    ? { Cookie: `accessToken=${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export async function getBoards(): Promise<ApiBoard[]> {
  const store = await cookies();
  const token = store.get('accessToken')?.value;
  const res = await fetch(`${API_URL}/boards`, {
    headers: token ? { Cookie: `accessToken=${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return res.json();
}

export async function getBoardBySlug(slug: string): Promise<ApiBoard | null> {
  const store = await cookies();
  const token = store.get('accessToken')?.value;
  const res = await fetch(`${API_URL}/boards/by-slug/${slug}`, {
    headers: token ? { Cookie: `accessToken=${token}` } : {},
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export interface BoardInput {
  name: string;
  access: 'restricted' | 'public';
  maxWidth: number;
  maxHeight: number;
}

export async function createBoard(data: BoardInput) {
  const res = await fetch(`${API_URL}/boards`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to create board');
  }

  revalidatePath('/dashboard/boards');
  return res.json();
}

export async function updateBoard(id: string, data: Partial<BoardInput>) {
  const res = await fetch(`${API_URL}/boards/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to update board');
  }

  revalidatePath('/dashboard/boards');
  return res.json();
}

export async function deleteBoard(id: string) {
  const res = await fetch(`${API_URL}/boards/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? 'Failed to delete board');
  }

  revalidatePath('/dashboard/boards');
}

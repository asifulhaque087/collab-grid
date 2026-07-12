'use server';

import { revalidatePath } from 'next/cache';
import type { ApiInventory } from '@/types';
import { API_URL, authHeaders, jsonHeaders } from '@/lib/api';

type ApiError = { message?: string };

export interface InventoryInput {
  name: string;
  sku: string;
  quantity: number;
  price?: string;
  photo?: string;
  boardId?: string | null;
  width?: number;
  height?: number;
}

export async function getInventoryItems(boardId?: string): Promise<ApiInventory[]> {
  const query = boardId ? `?boardId=${boardId}` : '';
  const res = await fetch(`${API_URL}/inventory${query}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createInventory(data: InventoryInput) {
  const res = await fetch(`${API_URL}/inventory`, {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to create inventory item');
  }

  revalidatePath('/dashboard/inventory');
  return res.json();
}

export async function updateInventory(id: string, data: Partial<InventoryInput>) {
  const res = await fetch(`${API_URL}/inventory/${id}`, {
    method: 'PATCH',
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to update inventory item');
  }

  revalidatePath('/dashboard/inventory');
  return res.json();
}

export async function deleteInventory(id: string) {
  const res = await fetch(`${API_URL}/inventory/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to delete inventory item');
  }

  revalidatePath('/dashboard/inventory');
}

// CSV bulk import. Forwards the multipart upload to the API's /inventory/import
// endpoint; a boardId attaches every imported item to that board. No JSON
// content-type here — fetch sets the multipart boundary from the FormData body.
export async function importInventoryCsv(formData: FormData) {
  const boardId = formData.get('boardId');
  const forward = new FormData();
  const file = formData.get('file');
  if (file) forward.append('file', file);
  if (boardId) forward.append('boardId', boardId);

  const res = await fetch(`${API_URL}/inventory/import`, {
    method: 'POST',
    headers: await authHeaders(),
    body: forward,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? 'Failed to import inventory');
  }

  revalidatePath('/dashboard/inventory');
  return res.json() as Promise<{ imported: number }>;
}

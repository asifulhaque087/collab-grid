"use server";

import { revalidatePath } from "next/cache";
import type { ApiBoard } from "@/types";
import { API_URL, authHeaders, jsonHeaders } from "@/lib/api";

type ApiError = { message?: string };

export async function getBoards(): Promise<ApiBoard[]> {
  const res = await fetch(`${API_URL}/boards`, { headers: await authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function getBoardBySlug(slug: string): Promise<ApiBoard | null> {
  const res = await fetch(`${API_URL}/boards/by-slug/${slug}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

// Public, unauthenticated board lookup for the end-user route (/b/[slug]).
// Returns null unless the board exists and is published (access: 'public').
export async function getPublicBoard(slug: string): Promise<ApiBoard | null> {
  const res = await fetch(`${API_URL}/boards/public/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

export interface BoardInput {
  name: string;
  access: "restricted" | "public";
  maxWidth: number;
  maxHeight: number;
}

export async function createBoard(data: BoardInput) {
  // const res = await fetch(`${API_URL}/boards`, {
  const res = await fetch(`http://localhost:3000/api/private/boards`, {
    method: "POST",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to create board");
  }

  revalidatePath("/dashboard/boards");
  return res.json();
}

export async function updateBoard(id: string, data: Partial<BoardInput>) {
  const res = await fetch(`${API_URL}/boards/${id}`, {
    method: "PATCH",
    headers: await jsonHeaders(),
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to update board");
  }

  revalidatePath("/dashboard/boards");
  return res.json();
}

export async function deleteBoard(id: string) {
  const res = await fetch(`${API_URL}/boards/${id}`, {
    method: "DELETE",
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to delete board");
  }

  revalidatePath("/dashboard/boards");
}

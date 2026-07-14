"use server";

import { revalidatePath } from "next/cache";
import type { ApiBoard } from "@/types";
import { authHeaders, jsonHeaders, privateApi, publicApi } from "@/lib/api";

type ApiError = { message?: string };

export async function getBoards(): Promise<ApiBoard[]> {
  const res = await privateApi("/boards", { headers: await authHeaders() });
  if (!res.ok) return [];
  return res.json();
}

export async function getBoardBySlug(slug: string): Promise<ApiBoard | null> {
  const res = await privateApi(`/boards/by-slug/${slug}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  return res.json();
}

// Public, unauthenticated board lookup for the end-user route (/b/[slug]).
export async function getPublicBoard(slug: string): Promise<ApiBoard | null> {
  const res = await publicApi(`/boards/${slug}`);
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
  const res = await privateApi("/boards", {
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
  const res = await privateApi(`/boards/${id}`, {
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
  const res = await privateApi(`/boards/${id}`, {
    method: "DELETE",
    headers: await jsonHeaders(),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body?.message ?? "Failed to delete board");
  }

  revalidatePath("/dashboard/boards");
}

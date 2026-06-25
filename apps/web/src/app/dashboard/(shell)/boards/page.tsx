import { cookies } from "next/headers";
import { LayoutGrid, List } from "lucide-react";
import { getBoardStats } from "@/lib/mock/boards";
import { PageHeader, SectionHeader } from "@/components/dashboard/page-header";
import { StatsRow } from "@/components/dashboard/stat-card";
import { BoardCard } from "@/components/boards/board-card";
import { NewBoardCard } from "@/components/boards/new-board-card";
import { BoardsActions } from "@/components/boards/boards-actions";
import type { ApiBoard } from "@/types";

const API_URL = process.env.API_URL ?? "http://localhost:3001";

async function getBoards(): Promise<ApiBoard[]> {
  const store = await cookies();
  const token = store.get("accessToken")?.value;
  const res = await fetch(`${API_URL}/boards`, {
    headers: token ? { Cookie: `accessToken=${token}` } : {},
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function BoardsPage() {
  const [boards, stats] = await Promise.all([getBoards(), getBoardStats()]);

  return (
    <>
      <PageHeader
        title="Boards"
        subtitle="Manage your collaborative canvas workspaces"
        actions={<BoardsActions />}
      />
      <StatsRow stats={stats} />
      <SectionHeader
        title="All Boards"
        actions={
          <div className="flex gap-1.5">
            <button
              title="Grid view"
              className="grid size-9 place-items-center rounded-sm border border-active bg-surface text-active"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              title="List view"
              className="grid size-9 place-items-center rounded-sm border border-border bg-surface text-text-dim transition-all hover:bg-surface-hover hover:text-text"
            >
              <List className="size-4" />
            </button>
          </div>
        }
      />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
        {boards.map((board) => (
          <BoardCard key={board.id} board={board} />
        ))}
        <NewBoardCard />
      </div>
    </>
  );
}

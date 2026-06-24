"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CreateBoardModal } from "./create-board-modal";

export function NewBoardCard() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex min-h-[260px] flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border transition-all hover:border-active hover:bg-active-dim"
      >
        <div className="grid size-12 place-items-center rounded-md border border-border bg-surface text-active transition-all group-hover:border-active group-hover:bg-active group-hover:text-white">
          <Plus className="size-[22px]" />
        </div>
        <span className="text-[0.9rem] font-semibold text-text-dim">Create New Board</span>
        <span className="text-[0.78rem] text-text-muted">3 of 5 remaining on Free Plan</span>
      </button>
      <CreateBoardModal open={open} onOpenChange={setOpen} />
    </>
  );
}

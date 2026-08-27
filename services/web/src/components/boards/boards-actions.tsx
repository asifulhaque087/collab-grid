"use client";

import { useState } from "react";
import { ListFilter, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateBoardModal } from "./create-board-modal";

export function BoardsActions() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => toast.info("Filtering boards…")}>
        <ListFilter />
        Filter
      </Button>
      <Button onClick={() => setOpen(true)}>
        <Plus />
        New Board
      </Button>
      <CreateBoardModal open={open} onOpenChange={setOpen} />
    </>
  );
}

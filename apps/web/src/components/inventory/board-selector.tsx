"use client";

import { useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, LayoutGrid, Check, CircleSlash } from "lucide-react";
import { toast } from "sonner";
import { updateInventory } from "@/actions/inventory";
import { cn } from "@/lib/utils";

export interface BoardOption {
  id: string;
  name: string;
}

function Option({
  selected,
  icon,
  label,
  onSelect,
}: {
  selected: boolean;
  icon: "board" | "none";
  label: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex w-full cursor-pointer items-center gap-2.5 rounded-sm px-3 py-[9px] text-left text-[0.82rem] font-medium outline-none transition-all",
        selected
          ? "bg-active-dim text-active"
          : "text-text-dim data-[highlighted]:bg-surface-hover data-[highlighted]:text-text"
      )}
    >
      <span
        className={cn(
          "grid size-7 shrink-0 place-items-center rounded-[6px] [&_svg]:size-3.5",
          icon === "board" ? "bg-active-dim text-active" : "bg-text-muted/15 text-text-muted"
        )}
      >
        {icon === "board" ? <LayoutGrid /> : <CircleSlash />}
      </span>
      <span className="flex-1">{label}</span>
      {selected && <Check className="size-4 text-active" />}
    </DropdownMenu.Item>
  );
}

export function BoardSelector({
  itemId,
  boards,
  initialBoardId,
  initialBoardName,
}: {
  itemId: string;
  boards: BoardOption[];
  initialBoardId: string | null;
  initialBoardName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<{ id: string | null; name: string }>({
    id: initialBoardId,
    name: initialBoardName ?? "Not attached",
  });

  const attached = selected.id !== null;

  const pick = (id: string | null, name: string) => {
    if (id === selected.id) return;
    const previous = selected;
    setSelected({ id, name });
    startTransition(async () => {
      try {
        await updateInventory(itemId, { boardId: id });
        toast.success(id ? `Attached to ${name}` : "Detached from board");
      } catch (err) {
        setSelected(previous);
        toast.error(err instanceof Error ? err.message : "Failed to update board");
      }
    });
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={isPending}
          className={cn(
            "inline-flex max-w-[200px] cursor-pointer items-center gap-2 whitespace-nowrap rounded-[20px] px-3 py-1.5 text-[0.8rem] font-semibold outline-none transition-all disabled:opacity-60",
            attached
              ? "border border-active/25 bg-active-dim text-active hover:border-active hover:bg-[rgba(13,148,136,0.22)]"
              : "border border-dashed border-border bg-transparent text-text-muted hover:border-text-muted hover:text-text-dim"
          )}
        >
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              attached
                ? "bg-active shadow-[0_0_6px_rgba(13,148,136,0.4)]"
                : "bg-text-muted opacity-40"
            )}
          />
          <span className="overflow-hidden text-ellipsis">{selected.name}</span>
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 opacity-50 transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-[500] min-w-[220px] rounded-md border border-border bg-surface p-1.5 shadow-[var(--shadow-lg)]"
        >
          <Option
            selected={!attached}
            icon="none"
            label="Not attached"
            onSelect={() => pick(null, "Not attached")}
          />
          <div className="my-1 h-px bg-border" />
          {boards.map((board) => (
            <Option
              key={board.id}
              selected={selected.id === board.id}
              icon="board"
              label={board.name}
              onSelect={() => pick(board.id, board.name)}
            />
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Globe, Lock, Pencil, Share2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { deleteBoard, updateBoard } from "@/actions/boards";
import type { ApiBoard } from "@/types";
import { ShareModal } from "./share-modal";
import { ImportInventoryModal } from "./import-inventory-modal";
import { CreateBoardModal } from "./create-board-modal";

function CardActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-[4px] text-text-muted transition-all hover:bg-surface-hover hover:text-text [&_svg]:size-3.5"
    >
      {children}
    </button>
  );
}

export function BoardCard({ board }: { board: ApiBoard }) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const subtitle =
    board.access === "public"
      ? "Public — anyone with the link"
      : "Restricted — invite only";

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  function togglePublish() {
    const next = board.access === "public" ? "restricted" : "public";
    startTransition(async () => {
      try {
        await updateBoard(board.id, { access: next });
        toast.success(
          next === "public"
            ? `"${board.name}" is now published — anyone with the link can join`
            : `"${board.name}" unpublished`,
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update board");
      }
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteBoard(board.id);
        toast.success(`"${board.name}" deleted`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete board");
      } finally {
        setDeleteOpen(false);
      }
    });
  }

  return (
    <>
      <div
        onClick={() => router.push(`/dashboard/boards/${board.slug}`)}
        className="group cursor-pointer overflow-hidden rounded-md border border-border bg-surface transition-all hover:-translate-y-0.5 hover:border-active hover:shadow-[var(--shadow-md),var(--shadow-glow-teal)]"
      >
        {/* Canvas preview */}
        <div className="relative h-[140px] overflow-hidden bg-bg-deep">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="absolute right-3 top-3 z-[1] inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2 py-0.5 text-[0.68rem] font-medium text-text-muted">
            {board.access === "public" ? (
              <Globe className="size-3" />
            ) : (
              <Lock className="size-3" />
            )}
            {board.access === "public" ? "Public" : "Restricted"}
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-center gap-2 text-[0.95rem] font-semibold text-text">
            {board.name}
          </div>
          <div className="mt-0.5 text-[0.78rem] text-text-muted">{subtitle}</div>
          <div className="mt-2 flex gap-3.5 text-[0.78rem] text-text-muted">
            <span className="flex items-center gap-1.5">
              <Box className="size-[13px]" /> {board.widgetCount} widgets
            </span>
            <span className="font-mono">
              {board.maxWidth}×{board.maxHeight}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-4 py-3">
          <div className="flex gap-1">
            <CardActionButton title="Edit" onClick={stop(() => setEditOpen(true))}>
              <Pencil />
            </CardActionButton>
            <CardActionButton title="Delete" onClick={stop(() => setDeleteOpen(true))}>
              <Trash2 />
            </CardActionButton>
          </div>
          <div className="flex gap-1">
            <CardActionButton title="Share" onClick={stop(() => setShareOpen(true))}>
              <Share2 />
            </CardActionButton>
            <CardActionButton title="Import Inventory" onClick={stop(() => setImportOpen(true))}>
              <Upload />
            </CardActionButton>
            <CardActionButton
              title={board.access === "public" ? "Unpublish" : "Publish"}
              onClick={stop(togglePublish)}
            >
              <Globe />
            </CardActionButton>
          </div>
        </div>
      </div>

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        boardName={board.name}
        boardSlug={board.slug}
      />
      <ImportInventoryModal
        open={importOpen}
        onOpenChange={setImportOpen}
        boardId={board.id}
        boardSlug={board.slug}
      />
      <CreateBoardModal open={editOpen} onOpenChange={setEditOpen} board={board} />

      <AlertDialog open={deleteOpen} onOpenChange={(o) => !o && setDeleteOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete board</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong className="text-text">&ldquo;{board.name}&rdquo;</strong>? This
              will remove the board and all its widgets, and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Delete board"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

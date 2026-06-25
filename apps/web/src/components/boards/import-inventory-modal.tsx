"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { importInventoryCsv } from "@/actions/inventory";

export function ImportInventoryModal({
  open,
  onOpenChange,
  boardId,
  boardSlug,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, imported items attach to this board. */
  boardId?: string;
  /** When set, the user is redirected to the board after a board import. */
  boardSlug?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function close(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function submit() {
    if (!file) {
      toast.error("Select a CSV file first");
      return;
    }
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file", file);
        if (boardId) fd.append("boardId", boardId);

        const { imported } = await importInventoryCsv(fd);
        toast.success(`Inventory imported — ${imported} item${imported === 1 ? "" : "s"} added`);
        close(false);
        if (boardSlug) router.push(`/dashboard/boards/${boardSlug}`);
        else router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to import inventory");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-bg p-3">
              <FileText className="size-6 shrink-0 text-active" strokeWidth={1.5} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[0.85rem] font-semibold text-text">{file.name}</div>
                <div className="text-[0.72rem] text-text-muted">{(file.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                onClick={reset}
                className="grid size-7 place-items-center rounded-sm text-text-muted hover:bg-surface-hover hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="group w-full cursor-pointer rounded-md border-2 border-dashed border-border p-10 text-center transition-all hover:border-active hover:bg-active-dim"
            >
              <Upload className="mx-auto mb-3 size-9 text-text-muted" strokeWidth={1.5} />
              <div className="mb-1 text-[0.9rem] font-semibold text-text">Upload CSV file</div>
              <div className="text-[0.78rem] text-text-muted">Click to browse</div>
            </button>
          )}
          <div className="mt-4 rounded-sm border border-border bg-bg p-3 text-[0.78rem] text-text-muted">
            <strong className="text-text-dim">CSV Format:</strong> name, sku, price, quantity —
            one item per row. {boardId
              ? "Items attach to this board and appear in its sidebar as draggable widgets."
              : "Items are added unattached — link them to a board later."}
          </div>
        </DialogBody>
        <DialogFooter className="justify-end gap-2.5">
          <Button variant="ghost" onClick={() => close(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !file}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { Upload } from "lucide-react";
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

export function ImportInventoryModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <button
            type="button"
            onClick={() => toast.info("File picker would open here")}
            className="group w-full cursor-pointer rounded-md border-2 border-dashed border-border p-10 text-center transition-all hover:border-active hover:bg-active-dim"
          >
            <Upload className="mx-auto mb-3 size-9 text-text-muted" strokeWidth={1.5} />
            <div className="mb-1 text-[0.9rem] font-semibold text-text">Upload CSV file</div>
            <div className="text-[0.78rem] text-text-muted">
              Drag and drop or click to browse
            </div>
          </button>
          <div className="mt-4 rounded-sm border border-border bg-bg p-3 text-[0.78rem] text-text-muted">
            <strong className="text-text-dim">CSV Format:</strong> name, sku, price, quantity —
            one item per row. Items will appear in the board&apos;s right sidebar as draggable
            widgets.
          </div>
        </DialogBody>
        <DialogFooter className="justify-end gap-2.5">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              toast.success("Inventory imported — 12 items added to board sidebar");
            }}
          >
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

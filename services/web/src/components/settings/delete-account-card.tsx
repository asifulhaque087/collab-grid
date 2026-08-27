"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-md border border-danger/30 bg-surface p-[18px]">
      <div className="mb-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-danger">
        Danger Zone
      </div>
      <p className="mb-3.5 text-[0.82rem] text-text-muted">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Delete Account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This permanently deletes your tenant and all boards, inventory, and orders. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter className="justify-end gap-2.5">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setOpen(false);
                toast.success("Account deletion scheduled");
              }}
            >
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

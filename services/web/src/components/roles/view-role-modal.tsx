"use client";

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
import { PermGrid, PermItem } from "@/components/dashboard/perm-item";
import { StatusBadge, TypePill } from "@/components/dashboard/status-badge";
import type { ApiRole } from "@/types";

interface ViewRoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: ApiRole | null;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[0.82rem] text-text-muted">{label}</span>
      <span className="text-[0.85rem] font-semibold text-text">{children}</span>
    </div>
  );
}

export function ViewRoleModal({ open, onOpenChange, role }: ViewRoleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{role?.title ?? "Role"}</DialogTitle>
          <DialogDescription>Read-only view of this role and its permissions.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="divide-y divide-border-subtle rounded-md border border-border bg-bg px-4">
            <MetaRow label="Created by">
              {role?.isSystem ? (
                <StatusBadge variant="active">System</StatusBadge>
              ) : (
                <TypePill>{role?.createdBy}</TypePill>
              )}
            </MetaRow>
            <MetaRow label="Members">
              <span className="font-mono">{role?.memberCount ?? 0}</span>
            </MetaRow>
            <MetaRow label="Permissions">
              <span className="font-mono">{role?.permissions.length ?? 0}</span>
            </MetaRow>
          </div>

          <div className="mb-2 mt-5 text-[0.82rem] font-semibold text-text-dim">
            Permissions
          </div>
          {role && role.permissions.length > 0 ? (
            <PermGrid>
              {role.permissions.map((perm) => (
                <PermItem
                  key={perm.id}
                  name={perm.name}
                  scope={`${perm.action} · ${perm.subject}`}
                >
                  <StatusBadge variant="active">Granted</StatusBadge>
                </PermItem>
              ))}
            </PermGrid>
          ) : (
            <div className="rounded-md border border-border bg-bg px-4 py-6 text-center text-[0.82rem] text-text-muted">
              No permissions assigned.
            </div>
          )}
        </DialogBody>
        <DialogFooter className="justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

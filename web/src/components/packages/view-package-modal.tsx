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
import type { ApiPackage, ApiPackagePermission } from "@/types";

interface ViewPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pkg: ApiPackage | null;
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-[0.82rem] text-text-muted">{label}</span>
      <span className="text-[0.85rem] font-semibold text-text">{children}</span>
    </div>
  );
}

function QuotaPill({ perm }: { perm: ApiPackagePermission }) {
  if (perm.limit === null) {
    return <StatusBadge variant="active">Granted</StatusBadge>;
  }
  return (
    <TypePill>
      <span className="font-mono">
        {perm.limit === -1 ? "∞" : perm.limit}
      </span>
    </TypePill>
  );
}

export function ViewPackageModal({ open, onOpenChange, pkg }: ViewPackageModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px]">
        <DialogHeader>
          <DialogTitle>{pkg?.title ?? "Package"}</DialogTitle>
          <DialogDescription>Read-only view of this package and its quotas.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="divide-y divide-border-subtle rounded-md border border-border bg-bg px-4">
            <MetaRow label="Monthly price">
              <span>{pkg?.price ? `$${pkg.price}` : "Free"}</span>
            </MetaRow>
            <MetaRow label="Subscribers">
              <span className="font-mono">{pkg?.subscriberCount ?? 0}</span>
            </MetaRow>
            <MetaRow label="Permissions">
              <span className="font-mono">{pkg?.permissions.length ?? 0}</span>
            </MetaRow>
          </div>

          <div className="mb-2 mt-5 text-[0.82rem] font-semibold text-text-dim">
            Permissions &amp; quotas
          </div>
          {pkg && pkg.permissions.length > 0 ? (
            <PermGrid>
              {pkg.permissions.map((perm) => (
                <PermItem
                  key={perm.id}
                  name={perm.name}
                  scope={`${perm.action} · ${perm.subject}`}
                >
                  <QuotaPill perm={perm} />
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

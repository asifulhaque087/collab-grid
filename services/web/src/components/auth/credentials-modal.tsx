"use client";

import { useState } from "react";
import { Shield, User, Mail, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const SUPER_ADMIN = { email: "admin@lootboard.com", password: "qwerty1234%" };
const TENANT = { email: "tenant@lootboard.com", password: "qwerty1234%" };
const ETHEREAL = { email: "christy.hackett34@ethereal.email", password: "RevrYqCNX83z9TJ9Nh" };

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* clipboard may be unavailable */
    }
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="grid size-6 shrink-0 place-items-center rounded-sm text-text-muted transition-all hover:bg-surface-hover hover:text-text"
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}

export function CredentialsModal({
  open,
  onOpenChange,
  onFillCredentials,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFillCredentials: (email: string, password: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]" overlayClassName="bg-black/15">
        <DialogHeader>
          <DialogTitle>Quick Login</DialogTitle>
          <DialogDescription>Use these credentials to sign in quickly</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="rounded-md border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-active-dim text-active">
                  <Shield className="size-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-semibold text-text">Super Admin</div>
                  <div className="mt-1 truncate font-mono text-[0.78rem] text-text-dim">{SUPER_ADMIN.email}</div>
                  <div className="truncate font-mono text-[0.78rem] text-text-muted">{SUPER_ADMIN.password}</div>
                </div>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0"
                onClick={() => onFillCredentials(SUPER_ADMIN.email, SUPER_ADMIN.password)}
              >
                Use
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-bg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-active-dim text-active">
                  <User className="size-[18px]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[0.875rem] font-semibold text-text">Tenant</div>
                  <div className="mt-1 truncate font-mono text-[0.78rem] text-text-dim">{TENANT.email}</div>
                  <div className="truncate font-mono text-[0.78rem] text-text-muted">{TENANT.password}</div>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="shrink-0" onClick={() => onFillCredentials(TENANT.email, TENANT.password)}>
                Use
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border bg-bg p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-surface text-text-muted">
                <Mail className="size-[18px]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[0.875rem] font-semibold text-text">Ethereal Test Email</div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-text-dim">{ETHEREAL.email}</span>
                    <CopyButton value={ETHEREAL.email} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[0.78rem] text-text-dim">{ETHEREAL.password}</span>
                    <CopyButton value={ETHEREAL.password} />
                  </div>
                </div>
                <a
                  href="http://ethereal.email/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2.5 inline-flex items-center gap-1 text-[0.78rem] text-active hover:underline"
                >
                  http://ethereal.email/
                  <ExternalLink className="size-3" />
                </a>
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/dashboard/status-badge";

export function UpgradeCards() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => toast.info("Redirecting to bKash payment…")}
        className="cursor-pointer rounded-md border border-border bg-surface p-[18px] text-left transition-colors hover:border-text-muted"
      >
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[1.1rem] font-bold text-text">Pro — Monthly</span>
          <StatusBadge variant="sold">Recommended</StatusBadge>
        </div>
        <div className="mb-2 font-mono text-[1.8rem] font-bold text-text">
          $9<span className="text-[0.8rem] font-medium text-text-muted">/mo</span>
        </div>
        <div className="mb-3.5 text-[0.8rem] leading-[1.8] text-text-dim">
          15 boards · 20 roles · Unlimited widgets
        </div>
        <Button className="w-full">Upgrade Now</Button>
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => toast.info("Redirecting to payment…")}
        className="cursor-pointer rounded-md border border-border bg-surface p-[18px] text-left transition-colors hover:border-text-muted"
      >
        <div className="mb-3.5 flex items-center justify-between">
          <span className="text-[1.1rem] font-bold text-text">Pro — Yearly</span>
          <span className="rounded-[10px] bg-committed-dim px-2 py-0.5 text-[0.72rem] font-bold text-committed">
            Save 20%
          </span>
        </div>
        <div className="mb-2 font-mono text-[1.8rem] font-bold text-text">
          $86<span className="text-[0.8rem] font-medium text-text-muted">/yr</span>
        </div>
        <div className="mb-3.5 text-[0.8rem] leading-[1.8] text-text-dim">
          Everything in Pro · Billed annually
        </div>
        <Button variant="secondary" className="w-full">
          Upgrade Now
        </Button>
      </div>
    </div>
  );
}

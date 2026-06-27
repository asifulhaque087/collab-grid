"use client";

import Link from "next/link";
import { usePermission } from "@/components/providers/permission-provider";
import { cn } from "@/lib/utils";

// Friendly labels + display order for the numeric quotas surfaced in the
// sidebar usage box. Subjects not listed here are still rendered using a
// lowercased fallback label, sorted after the known ones.
const QUOTA_LABELS: Record<string, string> = {
  Board: "boards",
  Group: "roles",
  SmartWidget: "widgets",
  User: "users",
};
const QUOTA_ORDER = ["Board", "Group", "SmartWidget", "User"];

function labelFor(subject: string): string {
  return QUOTA_LABELS[subject] ?? `${subject.toLowerCase()}s`;
}

export function PlanUsageCard() {
  const { quotas, plan } = usePermission();

  // Only numeric quotas (create-style grants) carry a `granted` cap; boolean
  // capability rows have a null cap and aren't usage-tracked.
  const tracked = quotas
    .filter((q) => q.granted !== null)
    .sort((a, b) => {
      const ai = QUOTA_ORDER.indexOf(a.subject);
      const bi = QUOTA_ORDER.indexOf(b.subject);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const isFree = plan.toLowerCase() === "free";

  return (
    <div className="rounded-md border border-brand bg-[linear-gradient(135deg,rgba(30,58,138,0.4),rgba(13,148,136,0.15))] p-3.5">
      <div className="mb-2.5 text-[0.75rem] font-semibold text-text-dim">
        {planLabel} Plan — Usage
      </div>

      {tracked.length === 0 ? (
        <div className="font-mono text-[0.7rem] text-text-muted">
          No tracked quotas
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tracked.map((q) => {
            const granted = q.granted ?? 0;
            const unlimited = granted < 0;
            const remaining = q.remaining ?? 0;
            const used = unlimited ? 0 : Math.max(0, granted - remaining);
            const pct = unlimited
              ? 0
              : granted > 0
                ? Math.min(100, Math.round((used / granted) * 100))
                : 0;

            return (
              <div key={q.id}>
                <div className="mb-1.5 h-1 overflow-hidden rounded-[2px] bg-surface">
                  <div
                    className={cn(
                      "h-full rounded-[2px]",
                      pct >= 100 ? "bg-soft-lock" : "bg-active",
                    )}
                    style={{ width: unlimited ? "100%" : `${pct}%` }}
                  />
                </div>
                <div className="font-mono text-[0.7rem] text-text-muted">
                  {unlimited ? (
                    <>
                      <span className="font-medium text-active">{used}</span> /{" "}
                      ∞ {labelFor(q.subject)}
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-active">{used}</span> /{" "}
                      {granted} {labelFor(q.subject)} used
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isFree && (
        <Link
          href="/dashboard/billing"
          className="mt-3 block w-full rounded-sm border border-active/30 py-[7px] text-center text-[0.75rem] font-semibold text-active transition-all hover:border-active hover:bg-active-dim"
        >
          Upgrade to Pro
        </Link>
      )}
    </div>
  );
}

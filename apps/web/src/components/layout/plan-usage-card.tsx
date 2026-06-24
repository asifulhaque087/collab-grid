import Link from "next/link";

export function PlanUsageCard() {
  return (
    <div className="rounded-md border border-brand bg-[linear-gradient(135deg,rgba(30,58,138,0.4),rgba(13,148,136,0.15))] p-3.5">
      <div className="mb-2 text-[0.75rem] font-semibold text-text-dim">
        Free Plan — Usage
      </div>
      <div className="mb-1.5 h-1 overflow-hidden rounded-[2px] bg-surface">
        <div className="h-full w-2/5 rounded-[2px] bg-active" />
      </div>
      <div className="font-mono text-[0.7rem] text-text-muted">
        <span className="font-medium text-active">2</span> / 5 boards used
      </div>
      <Link
        href="/dashboard/billing"
        className="mt-2.5 block w-full rounded-sm border border-active/30 py-[7px] text-center text-[0.75rem] font-semibold text-active transition-all hover:border-active hover:bg-active-dim"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}

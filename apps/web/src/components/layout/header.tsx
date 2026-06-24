import { LayoutGrid } from "lucide-react";
import { HeaderActions } from "./header-actions";

function TelemetryItem({
  dot,
  children,
}: {
  dot?: "green" | "amber";
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[0.75rem] text-text-muted">
      {dot && (
        <span
          className={
            dot === "green"
              ? "size-1.5 shrink-0 rounded-full bg-committed shadow-[0_0_6px_var(--color-committed)]"
              : "size-1.5 shrink-0 rounded-full bg-soft-lock"
          }
        />
      )}
      {children}
    </div>
  );
}

export function Header() {
  return (
    <header className="z-[100] col-span-2 flex items-center justify-between gap-4 border-b border-border bg-surface px-6">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-sm bg-[linear-gradient(135deg,var(--color-active),var(--color-brand))]">
            <LayoutGrid className="size-[18px] text-white" strokeWidth={2.5} />
          </div>
          <div className="text-[1.15rem] font-bold tracking-tight text-text">
            Collab<span className="text-active">Grid</span>
          </div>
        </div>
        <div className="h-7 w-px shrink-0 bg-border" />
        <div className="truncate text-[0.95rem] font-semibold text-text-dim">
          Aarong — Retail Workspace
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="mr-3 flex items-center gap-4">
          <TelemetryItem dot="green">Socket: Connected</TelemetryItem>
          <TelemetryItem dot="amber">Locks: 3</TelemetryItem>
          <TelemetryItem>Latency: 4ms</TelemetryItem>
        </div>
        <HeaderActions />
      </div>
    </header>
  );
}

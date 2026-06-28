import { LayoutGrid } from "lucide-react";
import { HeaderActions } from "./header-actions";
import { SidebarToggle } from "./sidebar-toggle";
import type { CurrentUser } from "@/lib/auth";

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

export function Header({ user }: { user: CurrentUser }) {
  return (
    <header className="z-[100] flex h-[var(--header-h)] shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3 sm:gap-4">
        <SidebarToggle />
        <div className="flex shrink-0 items-center gap-2.5">
          <div className="grid size-8 place-items-center rounded-sm bg-[linear-gradient(135deg,var(--color-active),var(--color-brand))]">
            <LayoutGrid className="size-[18px] text-white" strokeWidth={2.5} />
          </div>
          <div className="text-[1.15rem] font-bold tracking-tight text-text">
            Collab<span className="text-active">Grid</span>
          </div>
        </div>
        <div className="hidden h-7 w-px shrink-0 bg-border md:block" />
        <div className="hidden truncate text-[0.95rem] font-semibold text-text-dim md:block">
          Aarong — Retail Workspace
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="mr-3 hidden items-center gap-4 lg:flex">
          <TelemetryItem dot="green">Socket: Connected</TelemetryItem>
          <TelemetryItem dot="amber">Locks: 3</TelemetryItem>
          <TelemetryItem>Latency: 4ms</TelemetryItem>
        </div>
        <HeaderActions name={user.name} email={user.email} />
      </div>
    </header>
  );
}

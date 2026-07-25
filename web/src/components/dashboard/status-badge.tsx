import { cn } from "@/lib/utils";

export type BadgeVariant = "active" | "idle" | "sold" | "locked" | "expired";

const variantMap: Record<BadgeVariant, string> = {
  active: "bg-committed-dim text-committed",
  idle: "bg-text-muted/15 text-text-muted",
  sold: "bg-committed-dim text-committed",
  locked: "bg-soft-lock-dim text-soft-lock",
  expired: "bg-danger-dim text-danger",
};

const dotMap: Record<BadgeVariant, string> = {
  active: "bg-committed",
  idle: "bg-text-muted",
  sold: "bg-committed",
  locked: "bg-soft-lock",
  expired: "bg-danger",
};

export function StatusBadge({
  variant,
  children,
}: {
  variant: BadgeVariant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-[20px] px-2.5 py-[3px] text-[0.75rem] font-semibold",
        variantMap[variant]
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", dotMap[variant])} />
      {children}
    </span>
  );
}

export function TypePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[5px] rounded-sm border border-border bg-bg px-2.5 py-[3px] text-[0.75rem] font-semibold text-text-dim">
      {children}
    </span>
  );
}

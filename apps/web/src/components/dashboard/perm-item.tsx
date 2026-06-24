import { cn } from "@/lib/utils";

export function PermGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid max-h-[320px] grid-cols-2 overflow-y-auto rounded-md border border-border bg-bg",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PermItem({
  name,
  scope,
  disabled,
  children,
}: {
  name: string;
  scope: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 border-b border-r border-border-subtle px-4 py-3.5 transition-colors hover:bg-surface-hover [&:nth-child(2n)]:border-r-0 [&:nth-last-child(-n+2)]:border-b-0",
        disabled && "pointer-events-none opacity-40"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.85rem] font-semibold text-text">{name}</span>
        <span className="font-mono text-[0.72rem] text-text-muted">{scope}</span>
      </div>
      {children}
    </label>
  );
}

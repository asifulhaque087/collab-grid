import { cn } from "@/lib/utils";

export function DataTable({
  head,
  children,
  footer,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="relative z-[1] overflow-hidden rounded-md border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-collapse">
          <thead className="border-b border-border bg-bg-deep">
            <tr>{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

export function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "sticky top-0 whitespace-nowrap bg-bg-deep px-4 py-[11px] text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-text-muted",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

export function Tr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="transition-colors first:[&>td]:border-t-0 hover:bg-surface-hover">
      {children}
    </tr>
  );
}

export function Td({
  children,
  variant,
  tone,
  align = "left",
}: {
  children?: React.ReactNode;
  variant?: "primary" | "mono";
  tone?: "committed" | "soft-lock" | "danger";
  align?: "left" | "right";
}) {
  const toneClass =
    tone === "committed"
      ? "text-committed"
      : tone === "soft-lock"
        ? "text-soft-lock"
        : tone === "danger"
          ? "text-danger"
          : undefined;
  return (
    <td
      className={cn(
        "whitespace-nowrap border-t border-border-subtle px-4 py-[13px] text-[0.85rem] text-text-dim",
        variant === "primary" && "font-semibold text-text",
        variant === "mono" && "font-mono text-[0.78rem] text-text-muted",
        align === "right" && "text-right",
        toneClass
      )}
    >
      {children}
    </td>
  );
}

export function TableFooter({
  info,
  pages = ["1"],
}: {
  info: string;
  pages?: string[];
}) {
  return (
    <div className="flex items-center justify-between border-t border-border bg-bg-deep px-4 py-3">
      <div className="text-[0.78rem] text-text-muted">{info}</div>
      <div className="flex gap-1">
        {pages.map((page, i) => (
          <button
            key={`${page}-${i}`}
            className={cn(
              "grid size-[30px] place-items-center rounded-sm text-[0.8rem] font-semibold transition-all",
              i === 0
                ? "bg-active-dim text-active"
                : "text-text-muted hover:bg-surface hover:text-text"
            )}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-1">{children}</div>;
}

"use client";

export function RowActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid size-[30px] place-items-center rounded-sm text-text-muted transition-all hover:bg-surface hover:text-text [&_svg]:size-[15px]"
    >
      {children}
    </button>
  );
}

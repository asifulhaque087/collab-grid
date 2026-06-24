"use client";

import { Search, Bell, Settings } from "lucide-react";
import { toast } from "sonner";

function IconButton({
  label,
  badge,
  onClick,
  children,
}: {
  label: string;
  badge?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className="relative grid size-9 place-items-center rounded-sm text-text-dim transition-colors hover:bg-surface-hover hover:text-text [&_svg]:size-[18px]"
    >
      {children}
      {badge && (
        <span className="absolute right-[5px] top-[5px] size-2 rounded-full border-2 border-surface bg-danger" />
      )}
    </button>
  );
}

export function HeaderActions() {
  return (
    <>
      <IconButton label="Search" onClick={() => toast.info("Search panel coming soon")}>
        <Search />
      </IconButton>
      <IconButton label="Notifications" badge onClick={() => toast.info("No new notifications")}>
        <Bell />
      </IconButton>
      <IconButton label="Settings" onClick={() => toast.info("Navigating to settings…")}>
        <Settings />
      </IconButton>
      <button
        title="Asiful Haque Mridul"
        onClick={() => toast.info("Profile menu coming soon")}
        className="ml-1.5 grid size-8 cursor-pointer place-items-center rounded-full bg-[linear-gradient(135deg,var(--color-brand-light),var(--color-active))] text-[0.8rem] font-semibold text-white transition-shadow hover:shadow-[0_0_0_2px_var(--color-active)]"
      >
        AM
      </button>
    </>
  );
}

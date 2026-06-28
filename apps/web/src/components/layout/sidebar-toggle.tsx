"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./sidebar-context";

export function SidebarToggle() {
  const { toggle } = useSidebar();
  return (
    <button
      type="button"
      aria-label="Toggle navigation"
      onClick={toggle}
      className="grid size-9 shrink-0 place-items-center rounded-sm text-text-dim transition-colors hover:bg-surface-hover hover:text-text md:hidden [&_svg]:size-[20px]"
    >
      <Menu />
    </button>
  );
}

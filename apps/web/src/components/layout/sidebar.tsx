"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { getRequiredPermissionForPath, canAccess } from "@/lib/route-permissions";
import { usePermission } from "@/components/providers/permission-provider";
import { useSidebar } from "./sidebar-context";
import { PlanUsageCard } from "./plan-usage-card";

export function Sidebar() {
  const pathname = usePathname();
  const { ability } = usePermission();
  const { open, setOpen } = useSidebar();

  // Auto-dismiss the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [pathname, setOpen]);

  // Hide nav items the user can't access; sections with no visible items drop
  // out entirely. Items whose route has no permission requirement always show.
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const req = getRequiredPermissionForPath(item.href);
        return !req || canAccess(ability, req);
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {/* Backdrop — mobile only, dismisses the drawer on tap */}
      <div
        aria-hidden
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-x-0 bottom-0 top-[var(--header-h)] z-[90] bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-[var(--header-h)] z-[95] flex w-[var(--sidebar-w)] shrink-0 flex-col overflow-y-auto border-r border-border bg-bg-deep py-4 transition-transform",
          "md:static md:top-0 md:z-auto md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {visibleSections.map((section) => (
        <div key={section.label} className="mb-2 px-3">
          <div className="px-3 pb-1.5 pt-2 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
            {section.label}
          </div>
          <ul>
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <li key={item.href} className="mb-px">
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-sm px-3 py-[9px] text-[0.875rem] font-medium transition-all",
                      active
                        ? "bg-active-dim text-active"
                        : "text-text-dim hover:bg-surface hover:text-text"
                    )}
                  >
                    <Icon
                      className={cn("size-[18px] shrink-0", active ? "opacity-100" : "opacity-70")}
                    />
                    {item.label}
                    {item.badge && (
                      <span
                        className={cn(
                          "ml-auto rounded-[10px] px-[7px] py-0.5 font-mono text-[0.7rem]",
                          active
                            ? "bg-active-dim text-active"
                            : "bg-surface text-text-muted"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="mt-auto border-t border-border p-3">
        <PlanUsageCard />
      </div>
      </aside>
    </>
  );
}

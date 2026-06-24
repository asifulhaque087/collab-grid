"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navSections } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { PlanUsageCard } from "./plan-usage-card";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col overflow-y-auto border-r border-border bg-bg-deep py-4">
      {navSections.map((section) => (
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
  );
}

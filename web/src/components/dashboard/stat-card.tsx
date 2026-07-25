import {
  LayoutGrid,
  Users,
  Lock,
  ShieldCheck,
  Box,
  Boxes,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Stat } from "@/types";
import { cn } from "@/lib/utils";

const iconMap: Record<Stat["icon"], LucideIcon> = {
  boards: LayoutGrid,
  users: Users,
  lock: Lock,
  checkout: ShieldCheck,
  box: Boxes,
  units: Box,
  alert: TriangleAlert,
};

const toneMap: Record<Stat["iconTone"], string> = {
  teal: "bg-active-dim text-active",
  amber: "bg-soft-lock-dim text-soft-lock",
  emerald: "bg-committed-dim text-committed",
  brand: "bg-brand/30 text-[#60a5fa]",
};

export function StatCard({ stat }: { stat: Stat }) {
  const Icon = iconMap[stat.icon];
  return (
    <div className="rounded-md border border-border bg-surface p-[18px] transition-colors hover:border-text-muted">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[0.78rem] font-medium text-text-muted">{stat.label}</span>
        <div className={cn("grid size-8 place-items-center rounded-sm [&_svg]:size-4", toneMap[stat.iconTone])}>
          <Icon />
        </div>
      </div>
      <div className="font-mono text-[1.65rem] font-bold tracking-tight text-text">
        {stat.value}
      </div>
      {stat.change && (
        <div
          className={cn(
            "mt-1 font-mono text-[0.72rem]",
            stat.changeTone === "down" ? "text-danger" : "text-committed"
          )}
        >
          {stat.change}
        </div>
      )}
    </div>
  );
}

export function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <div className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} stat={stat} />
      ))}
    </div>
  );
}

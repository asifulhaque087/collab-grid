import type { Board, Stat } from "@/types";

// Replace the bodies of these loaders with `fetch` calls to `@apps/api`
// once the boards endpoints exist; the component layer stays unchanged.

const boards: Board[] = [
  {
    id: "b1",
    slug: "friday-flash-sale",
    name: "Friday Flash Sale",
    subtitle: "Public board — 500 limited items",
    access: "public",
    live: true,
    widgetCount: 24,
    lockCount: 3,
    onlineCount: 32,
    users: [
      { initials: "RK", gradient: "linear-gradient(135deg,#7c3aed,#6366f1)" },
      { initials: "SA", gradient: "linear-gradient(135deg,#0d9488,#14b8a6)" },
      { initials: "MH", gradient: "linear-gradient(135deg,#d97706,#f59e0b)" },
      { initials: "+29", gradient: "linear-gradient(135deg,#1e3a8a,#3b82f6)" },
    ],
    preview: [
      { width: 60, height: 40, top: 20, left: 30, state: "active" },
      { width: 45, height: 45, top: 60, left: 120, state: "soft-lock" },
      { width: 70, height: 35, top: 30, left: 200, state: "committed" },
      { width: 50, height: 50, top: 80, left: 55, state: "active" },
    ],
  },
  {
    id: "b2",
    slug: "retail-manager-competition",
    name: "Retail Manager Competition",
    subtitle: "Restricted — Internal retail teams",
    access: "restricted",
    live: false,
    widgetCount: 18,
    lockCount: 0,
    onlineCount: 5,
    users: [
      { initials: "NK", gradient: "linear-gradient(135deg,#e11d48,#f43f5e)" },
      { initials: "TA", gradient: "linear-gradient(135deg,#0ea5e9,#38bdf8)" },
      { initials: "JR", gradient: "linear-gradient(135deg,#8b5cf6,#a78bfa)" },
    ],
    preview: [
      { width: 55, height: 55, top: 15, left: 40, state: "committed" },
      { width: 80, height: 30, top: 70, left: 150, state: "active" },
      { width: 40, height: 60, top: 40, left: 250, state: "committed" },
    ],
  },
  {
    id: "b3",
    slug: "summer-collection-preview",
    name: "Summer Collection Preview",
    subtitle: "Restricted — Design team only",
    access: "restricted",
    live: false,
    widgetCount: 12,
    lockCount: 1,
    onlineCount: 3,
    users: [
      { initials: "AM", gradient: "linear-gradient(135deg,#059669,#34d399)" },
      { initials: "FI", gradient: "linear-gradient(135deg,#d97706,#fbbf24)" },
    ],
    preview: [
      { width: 50, height: 35, top: 30, left: 60, state: "soft-lock" },
      { width: 65, height: 45, top: 70, left: 180, state: "active" },
    ],
  },
];

const stats: Stat[] = [
  { label: "Active Boards", value: "4", icon: "boards", iconTone: "teal", change: "↑ 2 this week", changeTone: "up" },
  { label: "Live Connections", value: "47", icon: "users", iconTone: "brand", change: "↑ 12 in 1h", changeTone: "up" },
  { label: "Active Locks", value: "3", icon: "lock", iconTone: "amber", change: "↓ 1 expired", changeTone: "down" },
  { label: "Checkouts Today", value: "18", icon: "checkout", iconTone: "emerald", change: "↑ 64% conversion", changeTone: "up" },
];

export async function getBoards(): Promise<Board[]> {
  return boards;
}

export async function getBoardStats(): Promise<Stat[]> {
  return stats;
}

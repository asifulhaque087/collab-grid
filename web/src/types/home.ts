// Content model for the marketing homepage. Static config (driven by
// `lib/home-content.ts`) plus the in-browser types used by the board demo.

export type LockColor = "active" | "soft" | "hard" | "committed";

/** A bento stat cell in the hero. */
export interface BentoStat {
  /** numeric/short value, e.g. "60", "5:00", "0" */
  value: string;
  /** trailing unit shown smaller, e.g. "s" */
  unit?: string;
  /** bold lead word in the caption, e.g. "Soft lock" */
  lead: string;
  /** rest of the caption */
  caption: string;
}

/** One of the four lock-lifecycle states (Open / Soft / Hard / Committed). */
export interface LifecycleState {
  id: LockColor;
  tab: string;
  /** CSS color var the panel themes itself with, e.g. "var(--active)" */
  color: string;
  stateTag: string;
  heading: string;
  body: string;
  /** e.g. "available", "60 second hold" */
  durationLead: string;
  /** e.g. "/ no timer" */
  durationNote: string;
  /** demo widget footer */
  demoQty: number;
  demoState: string;
  demoMeta: string;
}

/** An architecture / "problem solved" card. */
export interface ArchCard {
  /** lucide icon name resolved in the component */
  icon: "viewport" | "lock" | "queue" | "socket" | "shield";
  iconColor: string;
  title: string;
  body: string;
  tech: string;
}

export interface LegendItem {
  color: string;
  label: string;
  sold?: boolean;
}

// ---- board demo (client-only) ----

export type WidgetState = "open" | "soft" | "hard" | "committed";

export interface DemoProduct {
  name: string;
  price: number;
  img: string;
}

export interface DemoWidget {
  id: string;
  name: string;
  price: number;
  img: string;
  stock: number;
  x: number;
  y: number;
  state: WidgetState;
  /** name of the peer holding it, if locked by someone else */
  peer: string | null;
}

export interface DemoPeer {
  name: string;
  color: string;
}

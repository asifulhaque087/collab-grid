// Typed content for the marketing homepage. Keeping copy/data here (rendered
// via `.map`) keeps the section components DRY and free of duplicated markup.

import type {
  ArchCard,
  BentoStat,
  DemoPeer,
  DemoProduct,
  HomePlan,
  LegendItem,
  LifecycleState,
} from "@/types/home";

/** Entry point into the app. No auth yet — repoint at a real sign-up flow later. */
export const APP_ENTRY = "/dashboard";
export const BILLING_HREF = "/dashboard/billing";

export const NAV_LINKS = [
  { label: "Live board", href: "#board" },
  { label: "Lock lifecycle", href: "#lifecycle" },
  { label: "Architecture", href: "#arch" },
  { label: "Plans", href: "#plans" },
];

export const BENTO_STATS: BentoStat[] = [
  { value: "60", unit: "s", lead: "Soft lock", caption: "the moment a widget is clicked" },
  { value: "5:00", lead: "Hard lock", caption: "while it waits in the checkout queue" },
  { value: "0", lead: "Double-spends", caption: "— one commit per reservation" },
];

export const LIFECYCLE_STATES: LifecycleState[] = [
  {
    id: "active",
    tab: "Open",
    color: "var(--active)",
    stateTag: "State 01 · Teal",
    heading: "Open and for sale",
    body: "The default state. The tenant positions the widget on the board and any shopper inside the viewport can claim it. Editable, streamable, and the only state a buyer can act on first.",
    durationLead: "available",
    durationNote: "/ no timer",
    demoQty: 1,
    demoState: "open",
    demoMeta: "•",
  },
  {
    id: "soft",
    tab: "Soft lock",
    color: "var(--soft)",
    stateTag: "State 02 · Amber",
    heading: "Soft locked for 60 seconds",
    body: "One click holds the item for you for 60 seconds and turns it amber for every other user on the canvas — an atomic Redis lock means no one else can take it. Walk away and it quietly returns to open.",
    durationLead: "60 second hold",
    durationNote: "/ auto-releases",
    demoQty: 1,
    demoState: "soft lock",
    demoMeta: "0:54",
  },
  {
    id: "hard",
    tab: "Hard lock",
    color: "var(--hard)",
    stateTag: "State 03 · Red",
    heading: "Hard locked in the checkout queue",
    body: "Starting checkout moves the item into a distributed queue and reserves it for five minutes, turning it red for everyone. No payment in time and the lock expires, the item returns to the canvas, and a real-time event repaints it for all connected clients.",
    durationLead: "5:00 reservation",
    durationNote: "/ queue-backed",
    demoQty: 1,
    demoState: "hard lock",
    demoMeta: "4:38",
  },
  {
    id: "committed",
    tab: "Committed",
    color: "var(--committed)",
    stateTag: "State 04 · Emerald",
    heading: "Committed — and gone from the board",
    body: "Payment clears exactly once. The widget flashes emerald, an invoice goes out by email, and because the stock is spent the item disappears from the canvas for every shopper. Zero double-spend, by construction.",
    durationLead: "sold",
    durationNote: "/ leaves the board",
    demoQty: 0,
    demoState: "sold ✓",
    demoMeta: "invoice sent",
  },
];

export const ARCH_CARDS: ArchCard[] = [
  {
    icon: "viewport",
    iconColor: "#0d9488",
    title: "Viewport-filtered streams",
    body: "The backend tracks each client's bounding box and pushes updates only for widgets you can actually see. Pan away and the stream follows you, not the whole board.",
    tech: "redis geo · bounding-box lookups",
  },
  {
    icon: "lock",
    iconColor: "#d97706",
    title: "Atomic distributed locks",
    body: "The moment a widget is clicked, an atomic Redis lock claims it. No two shoppers ever hold the same item — the race condition simply can't form.",
    tech: "redis · atomic ownership",
  },
  {
    icon: "queue",
    iconColor: "#059669",
    title: "Queued checkout, zero double-spend",
    body: "Checkout decouples into a message queue that commits a single order per reservation. Flash-sale bursts drain through the queue instead of fighting over row locks.",
    tech: "rabbitmq · async commitment",
  },
  {
    icon: "socket",
    iconColor: "#94a3b8",
    title: "Lifecycle-aware sockets",
    body: "Background a tab and its socket drops to a heartbeat-only state to free up resources. Refocus and CollabGrid fast-syncs the exact delta you missed — no full reload.",
    tech: "heartbeat · delta fast-sync",
  },
  {
    icon: "shield",
    iconColor: "#dc2626",
    title: "Bot & teleport detection",
    body: "Movements faster than humanly possible across the grid coordinate system get flagged and throttled, so scripted buyers can't sweep limited drops.",
    tech: "coordinate-velocity heuristics",
  },
];

export const HOME_PLANS: HomePlan[] = [
  {
    name: "Free",
    price: "$0",
    priceUnit: "/forever",
    blurb: "For your first drop and a small crew.",
    featured: false,
    cta: { label: "Start free", href: APP_ENTRY },
    features: [
      { value: "2", text: "boards" },
      { value: "3", text: "custom roles per tenant" },
      { value: "25", text: "widgets per board" },
      { text: "Real-time canvas & checkout queue" },
    ],
  },
  {
    name: "Pro",
    price: "$9",
    priceUnit: "/month",
    blurb: "For tenants running live, high-volume drops.",
    featured: true,
    tag: "POPULAR",
    cta: { label: "Upgrade to Pro", href: BILLING_HREF },
    features: [
      { value: "15", text: "boards" },
      { value: "20", text: "custom roles per tenant" },
      { value: "Unlimited", text: "widgets per board" },
      { text: "bKash · Nagad · SSLCommerz · Manual" },
    ],
  },
];

export const LEGEND_ITEMS: LegendItem[] = [
  { color: "var(--active)", label: "open / for sale" },
  { color: "var(--soft)", label: "soft lock — 60s" },
  { color: "var(--hard)", label: "hard lock — checkout" },
  { color: "var(--committed)", label: "sold → leaves the board", sold: true },
];

// ---- board demo data ----

const IMG_PARAMS = "&w=320&h=200&fit=crop&q=70&auto=format";

/** Build a usable Unsplash thumbnail URL from a base photo URL. */
export function demoImage(base: string): string {
  return base + IMG_PARAMS;
}

export const DEMO_CATALOG: DemoProduct[] = [
  { name: "Air Zephyr 270", price: 189, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?" },
  { name: "Chrono Diver GMT", price: 640, img: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?" },
  { name: "Field Jacket M-65", price: 230, img: "https://images.unsplash.com/photo-1551028719-00167b16eac5?" },
  { name: "Mech Keyboard TKL", price: 165, img: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?" },
  { name: "Polaroid SX-70", price: 310, img: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?" },
  { name: "Vinyl — First Press", price: 75, img: "https://images.unsplash.com/photo-1603048588665-791ca8aea617?" },
  { name: "Studio Headphones", price: 140, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?" },
  { name: "Courtside '98", price: 120, img: "https://images.unsplash.com/photo-1600185365926-3a2ce3cdb9eb?" },
  { name: "Roller Sunglasses", price: 95, img: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?" },
  { name: "Trail Backpack 30L", price: 110, img: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?" },
  { name: "Cassette Deck DR-7", price: 95, img: "https://images.unsplash.com/photo-1558537348-c0f8e733989d?" },
  { name: "Riso Print 04/30", price: 48, img: "https://images.unsplash.com/photo-1561997968-aa846c2bc88c?" },
];

export const DEMO_INITIAL_COORDS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 60, y: 48 }, { x: 300, y: 96 }, { x: 560, y: 54 }, { x: 790, y: 120 },
  { x: 110, y: 300 }, { x: 380, y: 330 }, { x: 650, y: 300 }, { x: 300, y: 520 },
];

export const DEMO_PEERS: DemoPeer[] = [
  { name: "rumi", color: "#a78bfa" },
  { name: "tania", color: "#38bdf8" },
];

export const SOFT_MS = 60 * 1000;
export const HARD_MS = 5 * 60 * 1000;
export const CELL = 44;

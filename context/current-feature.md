# Current Feature: Dashboard Design

## Status

In Progress

## Goals

- Translate the static mockup (`prototypes/dashboard.html`) into the real Next.js 16 dashboard in `apps/web`, pixel-perfect against the prototype.
- Build a persistent shell: header + 240px sidebar grid layout under a `(dashboard)` route group; `/` redirects to `/boards` (main page).
- One route per sidebar menu: Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings.
- Server components by default; push interactivity into small `'use client'` leaves (modals, dropdowns, tabs, toggles, sidebar active state).
- Style with Tailwind v4 (`@theme` tokens, no JS config) + ShadCN UI; port design tokens, Inter + JetBrains Mono fonts, dark mode default.
- All modal forms use react-hook-form + Zod with inline validation; submit closes modal + sonner toast (Server Action seam for later).
- DRY shared components: StatCard, PageHeader, DataTable, StatusBadge, TypePill, Modal/Dialog shell, Button variants.
- Wire all buttons/links to correct routes or modals — no dead `href="#"` links.
- `pnpm build` and `pnpm lint` (--max-warnings 0) pass clean.

## Notes

- Full spec: `context/features/dashboard-design.spec.md` (source of truth).
- **Out of scope:** the canvas board editor (`#page-canvas` — viewport, widgets, peer cursors, minimap, lock timers, drag-drop inventory panel). `/boards/[slug]` is a placeholder route this iteration.
- **Data:** API has no endpoints/schemas wired yet. Use typed mock loaders per feature (`src/lib/mock/*`) returning async functions so swap to real `fetch` from `@apps/api` is a one-line change. Define entity interfaces in `src/types/*`. Mutations toast for now.
- Render full tenant nav (no super-admin role gating yet) — flagged as role-filterable later.
- ShadCN: init in CSS-vars mode mapped to prototype tokens; add button, dialog, input, select, table, switch, checkbox, dropdown-menu, tabs, badge, label, sonner.
- Design tokens, font setup, and per-page/per-modal breakdowns are detailed in the spec (§5–§8).

## History

# Dashboard Design — Implementation Spec

> Build the real CollabGrid tenant dashboard in `apps/web` from the static mockup at
> [prototypes/dashboard.html](../../prototypes/dashboard.html). The mockup is the **source of truth for
> visual design** — the implementation must be pixel-perfect against it.

---

## 1. Goal

Translate the single-file HTML prototype into a real Next.js 16 (App Router) application:

- One route per sidebar menu item, all sharing a persistent shell (header + sidebar).
- Split each page into **server components** (layout, static markup, data fetch) and **client
  components** (anything interactive: modals, dropdowns, tabs, toggles, search inputs).
- Style with **Tailwind v4 + ShadCN UI**, matching the prototype's design tokens exactly.
- All forms (the modals) use **react-hook-form + Zod**.
- Wire every button/link to the correct route or modal.

**In scope:** the dashboard shell and all 9 list/detail pages + their modals.

**Out of scope (separate feature):** the canvas board editor (`#page-canvas` in the prototype — the
infinite-canvas viewport, widgets, peer cursors, minimap, lock timers, drag-and-drop inventory panel,
widget detail panel). This spec covers everything *except* the live canvas. Note the routing seam for it
(§4) but do not build it here.

---

## 2. Guidelines (apply throughout)

- **One page per sidebar menu** — Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing,
  Settings.
- **Server/client split** — pages are server components by default; push interactivity into the smallest
  possible `'use client'` leaf components (per `context/coding-standards.md`).
- **Tailwind v4 + ShadCN** — match the rest of the project. No `tailwind.config.*`; theme via `@theme` in
  `globals.css`.
- **Forms** — react-hook-form + Zod resolver for every modal form, with inline validation errors.
- **Clean & DRY** — extract shared pieces (stat card, data table, page header, modal shell, status badge,
  type pill) into reusable components. No copy-paste between pages.
- **Correct navigation** — buttons and links go to the right place (routes for nav, modal open/close for
  dialogs). No dead `href="#"`.
- **Pixel-perfect** — spacing, colors, radii, fonts, and sizes must match the prototype. Port the design
  tokens verbatim (§5).

---

## 3. Data strategy (this iteration)

The API (`apps/api`) has no endpoints/schemas wired for these entities yet. For this iteration:

- Render from **typed mock data** colocated per feature (e.g. `src/lib/mock/boards.ts`) exposing
  async functions (`getBoards()`, `getInventory()`, …) so the swap to real `fetch` from `@apps/api` later
  is a one-line change inside the loader, not a component rewrite.
- Define a TypeScript interface for every entity in `src/types/[feature].ts` (Board, InventoryItem, User,
  Role, Plan, Order, Transaction). These mirror the eventual API responses.
- Server components call the loaders directly; client components that mutate will (later) call Server
  Actions returning `{ success, data, error }`. For now mutations close the modal and fire a `sonner` toast,
  mirroring the prototype's `showToast(...)` behavior.

---

## 4. Routing & file structure

All dashboard pages share the header+sidebar shell, so group them under a layout route group. The canvas
editor is a separate full-screen route outside this group.

```
apps/web/src/
  app/
    (dashboard)/
      layout.tsx                # server: <Header/> + <Sidebar/> + <main>{children}</main> grid shell
      boards/page.tsx           # Boards — default dashboard (see note below)
      inventory/page.tsx
      users/page.tsx
      roles/page.tsx
      plans/page.tsx
      orders/page.tsx
      transactions/page.tsx
      billing/page.tsx
      settings/page.tsx
    boards/[slug]/page.tsx      # canvas editor — OUT OF SCOPE here (placeholder ok)
    page.tsx                    # redirect('/boards')
    globals.css                 # @theme tokens (§5)
    layout.tsx                  # root: fonts, <html class="dark">, metadata, <Toaster/>
  components/
    layout/                     # header.tsx, sidebar.tsx, plan-usage-card.tsx
    dashboard/                  # stat-card.tsx, page-header.tsx, data-table.tsx, status-badge.tsx,
                                # type-pill.tsx, table-footer.tsx, section-header.tsx
    boards/                     # board-card.tsx, board-grid.tsx, create-board-modal.tsx,
                                # share-modal.tsx, import-inventory-modal.tsx
    inventory/                  # inventory-table.tsx, add-inventory-modal.tsx, board-selector.tsx
    users/                      # users-table.tsx, add-user-modal.tsx
    roles/                      # roles-table.tsx, add-role-modal.tsx
    plans/                      # plan-card.tsx, add-plan-modal.tsx
    ui/                         # ShadCN primitives (button, dialog, input, select, table, switch, ...)
  lib/
    mock/                       # boards.ts, inventory.ts, users.ts, ...
    nav.ts                      # sidebar nav config (single source of truth)
    utils.ts                    # cn() helper (ShadCN)
  types/                        # board.ts, inventory.ts, user.ts, role.ts, plan.ts, order.ts, transaction.ts
```

**Default page:** the prototype opens on **Boards** ("This is the main dashboard page" per project-overview).
Root `/` redirects to `/boards`.

**ShadCN setup:** initialize ShadCN (CSS-vars mode, matching tokens) and generate the primitives used below.
Map ShadCN's theme variables onto the prototype tokens so generated components inherit the look. Components
to add: `button, dialog, input, select, table, switch, checkbox, dropdown-menu, tabs, badge, label, sonner`.

---

## 5. Design system — port verbatim

Add these to `globals.css` under `@theme` (Tailwind v4, CSS-based config — **no JS config file**). Values
copied from the prototype `:root`:

| Token | Value | Usage |
|---|---|---|
| `--color-brand` | `#1e3a8a` | structure, frames |
| `--color-brand-light` | `#2548a8` | avatar gradient |
| `--color-active` | `#0d9488` | active state, primary action (teal) |
| `--color-active-dim` | `rgba(13,148,136,0.15)` | active backgrounds |
| `--color-soft-lock` | `#d97706` | amber soft-lock |
| `--color-committed` | `#059669` | emerald success/paid |
| `--color-bg` | `#0f172a` | page background |
| `--color-bg-deep` | `#0a1020` | sidebar, table head, canvas |
| `--color-surface` | `#1e293b` | cards, panels |
| `--color-surface-hover` | `#263548` | hover |
| `--color-border` | `#334155` | borders/dividers |
| `--color-border-subtle` | `#1e293b` | row dividers |
| `--color-text` | `#e2e8f0` | primary text |
| `--color-text-dim` | `#94a3b8` | secondary text |
| `--color-text-muted` | `#64748b` | muted/labels |
| `--color-danger` | `#ef4444` | destructive |

Other tokens to carry over: radii (`sm 6px`, `md 10px`, `lg 14px`, `xl 20px`), shadows
(`sm/md/lg`, `glow-teal: 0 0 20px rgba(13,148,136,0.2)`), `--transition: 180ms cubic-bezier(0.4,0,0.2,1)`,
`--sidebar-w: 240px`, `--header-h: 60px`.

**Fonts** (via `next/font/google` in root layout, exposed as CSS vars):
- `--font-ui`: **Inter** (weights 400/500/600/700) — all UI text.
- `--font-mono`: **JetBrains Mono** (400/500) — coordinates, SKUs, prices, IDs, telemetry, numeric stats.

**Dark mode is the default** — root `<html class="dark">`; base `html { font-size: 14px }` (prototype uses
14px root; all `rem` sizes depend on it).

**Keyframes to port:** `pulse-dot` (live dots), `amber-glow` (soft-lock), toast in/out.

---

## 6. Shared shell

### Layout grid (`(dashboard)/layout.tsx`, server)
CSS grid: `grid-template-columns: var(--sidebar-w) 1fr; grid-template-rows: var(--header-h) 1fr; height:
100vh`. Header spans both columns; sidebar left; `<main>` scrolls (`overflow-y:auto; padding:28px 32px`) and
shows the faint radial dot-grid background (`.main::before`).

### Header (`components/layout/header.tsx`)
Mostly static (server) with small client bits. Left: logo mark (gradient square + grid icon) + "Collab**Grid**"
wordmark + divider + active workspace name. Right: telemetry strip (`Socket: Connected` green dot, `Locks: N`
amber dot, `Latency`), icon buttons (search, notifications w/ badge, settings), avatar. Icon buttons that only
toast in the prototype → client component firing `sonner` toasts (placeholder behavior preserved).

### Sidebar (`components/layout/sidebar.tsx`, client for active-state)
Driven by `lib/nav.ts`:
- **Workspace:** Boards (`/boards`, badge 4), Inventory (`/inventory`, badge 128)
- **Administration:** Users (`/users`), Roles (`/roles`), Plans (`/plans`), Orders (`/orders`, badge 18),
  Transactions (`/transactions`)
- **System:** Billing (`/billing`), Settings (`/settings`)

Active link computed from `usePathname()` → `.active` style (`--color-active-dim` bg, teal text). Bottom:
**plan usage card** (gradient border, "Free Plan — Usage", meter bar, "2 / 5 boards used", "Upgrade to Pro"
button → `/billing`).

> Super-admin vs tenant role gating (e.g. super-admin hides Orders) is **not** built here — render the full
> tenant nav. Leave a comment noting nav is role-filterable later.

---

## 7. Pages

Each page = server component composing `<PageHeader>` + body. Reusable building blocks:

- **`PageHeader`** — title (1.6rem/700), subtitle, right-aligned `actions` slot.
- **`StatCard`** — label, colored icon chip (teal/amber/emerald/brand variants), mono value, up/down change.
- **`DataTable`** — wrapper (`.table-wrap` + horizontal `.table-scroll`), sticky `thead` on `--color-bg-deep`,
  hover rows, mono/primary cell variants, right-aligned action-button column, footer (count + pagination).
- **`StatusBadge`** (active/idle/sold/locked/expired dot variants) and **`TypePill`**.
- **`Button`** variants: primary (teal), secondary, ghost, danger, icon, sm — map to ShadCN `Button`.

### 7.1 Boards (`/boards`) — main dashboard
- PageHeader "Boards" / "Manage your collaborative canvas workspaces"; actions: **Filter** (secondary),
  **New Board** (primary → opens Create Board modal).
- Stats row (4): Active Boards, Live Connections, Active Locks, Checkouts Today.
- Section header "All Boards" + grid/list view toggle (visual only).
- **Board grid** (`repeat(auto-fill,minmax(300px,1fr))`): `BoardCard` (client — has hover + action buttons)
  = mini canvas preview (positioned `mini-widget` blocks), name (+ live pulse dot if public/live), subtitle,
  meta (widgets/locks/online), footer with stacked mini-avatars + actions: **Share** (→ Share modal),
  **Import Inventory** (→ Import modal), **Publish** (toggles state + toast). Card click → `/boards/[slug]`
  (canvas, out of scope — route may be a placeholder). Plus a dashed **"Create New Board"** card → Create modal.

### 7.2 Inventory (`/inventory`)
- PageHeader actions: search input, **Export** (secondary, toast), **Add Item** (primary → Add Inventory modal).
- Stats row (4): Total SKUs, Total Units, Reserved, Low Stock.
- `DataTable`: SKU (mono) · Item Name (primary) · Total Qty (mono) · **Board** (the `BoardSelector` dropdown:
  attached/not-attached pill that opens a menu of boards with check marks — client) · Created · Actions
  (edit, view locks). Footer pagination.

### 7.3 Users (`/users`)
- PageHeader: search, **Add User** (→ Add User modal). `DataTable`: Name · Email · Role (`TypePill`) ·
  Status (`StatusBadge` active/idle) · Joined · Actions (edit, activate/deactivate). Footer "Showing N users".

### 7.4 Roles (`/roles`)
- PageHeader: **Create Role** (→ Add Role modal). `DataTable`: Role Name · Members (mono) · Permissions ·
  Created By (badge/pill) · Created · Actions (view for system roles; edit/delete for custom). System roles
  (Tenant Admin) are non-deletable — render view-only action. Footer "2 of 3 custom roles used (Free Plan)".

### 7.5 Plans (`/plans`)
- PageHeader: **Create Plan** (→ Add Plan modal). Card grid (`minmax(260px,1fr)`) of plan cards: name +
  status badge (Active/Popular), mono price `/mo`, quota summary line, "N tenants subscribed". Free card has
  teal border.

### 7.6 Orders (`/orders`)
- PageHeader: search, **Export** (toast). `DataTable`: Order ID (mono) · Customer (primary, truncated) ·
  Widget · Board · Amount (mono, colored by status) · Payment (bKash/Nagad/SSLCommerz/—) · Status (badge:
  Paid/Pending/Expired) · Date. Footer with multi-page pagination ("Showing 5 of 18").

### 7.7 Transactions (`/transactions`)
- PageHeader: **filter tabs** (All / Success / Pending / Failed — client, active state) + **Export**.
  `DataTable`: TXN ID · Order · Method · Amount (mono, colored) · Gateway Ref (mono) · Status (badge) ·
  Timestamp (mono).

### 7.8 Billing (`/billing`)
- PageHeader title only. Current-plan card (teal border): "Current Plan / Free Plan" + Active badge; 3-col
  usage grid (Boards 2/2, Custom Roles 2/3, Widgets/Board 24/25) with teal current values; renews line.
- "Upgrade" section: two upgrade cards (Pro Monthly — Recommended badge, Upgrade Now primary; Pro Yearly —
  "Save 20%", secondary). Footer: payment methods line. Cards toast on click (placeholder for gateway).

### 7.9 Settings (`/settings`)
- Max-width 560px column of cards:
  - **Profile** form: Tenant Name, Tenant Slug (mono), Contact Email → Save Changes.
  - **Security** form: Current Password, New Password → Update Password.
  - **Danger Zone** (red border): Delete Account (danger button → confirm dialog).
- Profile and Security are real rhf+Zod forms (client); see §8.

---

## 8. Modals & forms (react-hook-form + Zod)

Build a shared `Modal`/`Dialog` shell (ShadCN `Dialog`) matching the prototype: overlay with blur, surface
card, header (title + optional subtitle + close X), body, footer (left meta slot + right actions). Port the
scale/translate open animation. Each form is a `'use client'` component using
`useForm` + `zodResolver`, showing inline field errors and disabling submit while pending. On submit
(this iteration): close modal + `sonner` toast (matching prototype copy); structure the handler so a Server
Action call drops in later.

| Modal | Fields → Zod schema |
|---|---|
| **Create Board** | name (req), slug (auto from name, mono), maxCanvasWidth (number, default 10000), maxCanvasHeight (number, default 10000), access (enum: `restricted` \| `public`). Footer shows quota remaining. |
| **Share Board** | invite email (email), role select; "people with access" list with per-person role select + remove; general-access mode (Restricted/Public) select with dynamic description; **Copy link** button (writes to clipboard, shows "Copied" state). |
| **Import Inventory** | CSV dropzone (drag/drop + click), format hint (`name, sku, price, quantity`). Import → toast. |
| **Add Inventory Item** | sku (req, mono), name (req), initialQuantity (number ≥0), lowStockThreshold (number ≥0), description (optional). |
| **Add Widget** | type (enum: product/info/media, card selector), name (req), linkedSku (optional select), posX, posY, width, height (numbers, mono). *(Used by canvas — include schema; UI lives with canvas feature.)* |
| **Add User** | fullName (req), email (req email), roles (multi-select via toggle list, ≥1). |
| **Add Role** | name (req), permissions (set of toggles: create/read/update/delete/manage across Board/Inventory/Order/User/Role/Transaction). |
| **Add Plan** | name (req), pricePerMonth (number ≥0), quotas (numbers ≥0: maxBoards, widgetsPerBoard, customRoles, maxUsers, inventoryItems, maxConcurrentUsers, snapshotHistory, csvImportsPerMonth). |

Reusable form bits: `FormField` (label + control + error), `ToggleSwitch` (ShadCN `Switch` styled to the
prototype's `.toggle-switch`), `QuotaInput`, `PermItem` row.

Modal open/close state: use URL search params or a small client store/context so server pages stay server
components and only the trigger/modal are client. Keep triggers next to their content (e.g. New Board button
and Create Board modal in the boards feature folder).

---

## 9. Navigation / link map

| Trigger | Action |
|---|---|
| Sidebar links | route to `/boards`, `/inventory`, `/users`, `/roles`, `/plans`, `/orders`, `/transactions`, `/billing`, `/settings` |
| "Upgrade to Pro" (sidebar plan card), Billing upgrade cards | `/billing` / payment toast |
| New Board / Create New Board card | open Create Board modal |
| Board card click | `/boards/[slug]` (canvas — placeholder route this iteration) |
| Board card: Share / Import / Publish | open Share modal / Import modal / toggle + toast |
| Add Item / Add User / Create Role / Create Plan | open respective modal |
| Table row Edit/Delete/View, Export, search, Filter | wire to handlers; placeholders fire toasts (no dead `#` links) |
| Header search/notifications/settings/avatar | client buttons → toast placeholders (preserve prototype behavior) |

---

## 10. Acceptance criteria

- Visiting `/` redirects to `/boards`; all 9 routes render with the shared shell.
- Sidebar highlights the active route; badges and plan-usage card present.
- Every page matches the prototype: tokens, fonts, spacing, radii, hover/active states, stat cards, tables,
  badges, pills, and the boards grid.
- All modals open/close, validate via Zod, show inline errors, and toast on submit.
- No `any` types; entities typed in `src/types`; no dead links; no duplicated card/table/modal markup.
- `pnpm build` and `pnpm lint` pass clean (lint runs with `--max-warnings 0`).
- Canvas board editor is explicitly deferred (placeholder route only).
```

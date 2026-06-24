# Homepage Design — Implementation Spec

> Build the real CollabGrid public landing page in `apps/web` from the static mockup at
> [prototypes/homepage.html](../../prototypes/homepage.html). The mockup is the **source of truth for
> visual design** — the implementation must be pixel-perfect against it.

---

## 1. Goal

Translate the single-file HTML prototype into the real Next.js 16 (App Router) marketing homepage served at
`/`:

- One scrollable landing page split into **server components** (all the static marketing sections) and a few
  small **client components** (anything interactive: the live board demo, lifecycle tabs, sticky nav).
- Style with **Tailwind v4 + ShadCN UI**, reusing the design tokens already in `globals.css` and adding only
  what the homepage needs (display font, marketing-only keyframes).
- Keep it **clean and DRY** — extract repeated markup (bento cells, section header, plan card, arch card,
  legend, lifecycle panel) into reusable components instead of copy-pasting the prototype.
- Wire every button/link to the correct destination (in-page anchors for nav, real routes for CTAs).

**In scope:** the entire homepage — nav, hero bento, live board demo, lock-lifecycle tabs, architecture grid,
plans, footer.

**Out of scope:** authentication/sign-up pages (none exist yet) and the real tenant dashboard (already built
under `(dashboard)`). The board demo here is a **self-contained marketing simulation**, not the real canvas
editor — do not wire it to the API or reuse `canvas-editor.tsx`.

---

## 2. Routing change

Today `app/page.tsx` redirects `/ → /boards`. Replace it: **`/` becomes the homepage**; the dashboard keeps
its existing `(dashboard)` routes. Update the redirect-only `page.tsx` into the composed homepage (§4).

> `globals.css` header comment and root `metadata.title` ("CollabGrid — Dashboard") predate having a public
> page — set page-specific metadata on the homepage (title/description from the prototype `<title>` and hero
> copy) so the landing page has its own SEO.

---

## 3. Guidelines (apply throughout)

- **Server-first** — every static section is a server component. Push interactivity into the smallest possible
  `'use client'` leaf (per `context/coding-standards.md`).
- **Tailwind v4 + ShadCN** — match the rest of the project. No `tailwind.config.*`; theme via `@theme` in
  `globals.css`. Reuse existing tokens; only add the display font + 3 keyframes (§5).
- **Clean & DRY** — one component per repeated pattern; data (stats, arch cards, plans, lifecycle states)
  lives in typed config arrays, rendered by `.map`, not hand-duplicated.
- **Correct navigation** — no dead `href="#"`. Map every link/button to its real target (§7).
- **Pixel-perfect** — spacing, colors, radii, fonts, grid spans, and hover/animation states must match the
  prototype.

---

## 4. File structure

```
apps/web/src/
  app/
    page.tsx                       # server: homepage — composes the section components in order
    globals.css                    # add display font var + marketing keyframes (§5)
    layout.tsx                     # add Space Grotesk via next/font; broaden default metadata
  components/
    home/
      site-nav.tsx                 # client: sticky nav (blur on scroll), mobile link collapse
      hero-bento.tsx               # server: hero copy + bento stat cells (+ <LiveCounter/> island)
      live-counter.tsx             # client: the "Live now" animated shopper count
      board-demo.tsx               # client: the interactive canvas/lock/cart simulation (the big island)
      lock-lifecycle.tsx           # client: tabbed Open/Soft/Hard/Committed state explainer
      architecture-section.tsx     # server: 5-card "problems solved" grid
      plans-section.tsx            # server: Free / Pro pricing cards
      site-footer.tsx              # server: footer logo + links
      logo-mark.tsx                # server: shared gradient grid logo (nav + footer)
      section-head.tsx             # server: eyebrow + heading block used by every section
  lib/
    home-content.ts                # typed config: bento stats, arch cards, plans, lifecycle states, legend
  types/
    home.ts                        # interfaces for the above content (ArchCard, Plan, LifecycleState, …)
```

Keep the demo's product catalog/coordinates in `lib/home-content.ts` too (typed), so `board-demo.tsx` holds
behavior, not data.

---

## 5. Design system — what to add

The homepage shares the existing palette (brand/active/soft-lock/committed/bg/surface/border/text), already in
`globals.css`. The prototype renames a few (`--soft`→soft-lock, `--hard`→a new **danger-red `#dc2626`**,
`--committed`, `--surface-2 #172033`, `--border-soft #243049`) — reuse existing tokens where they match and add
the small set that's genuinely new:

- **`--color-hard #dc2626`** (hard-lock red) and **`--color-surface-2 #172033`**, **`--color-border-soft
  #243049`** if not already present.
- **Display font:** **Space Grotesk** (400/500/600/700) via `next/font/google` in root layout, exposed as
  `--font-display`. Used for the logo wordmark, all section headings (`h1/h2/h3`), and big numerics. Inter and
  JetBrains Mono are already wired.

**Keyframes to port** (homepage-specific, add to `globals.css`): `blink` (live dot), `softpulse` +
`hardpulse` (widget lock glows), `pop` (commit scale-pop), `toastin/toastout`. Guard the pulse/pop animations
behind `@media (prefers-reduced-motion: no-preference)` as the prototype does.

The fixed dotted grid backdrop (`body::before` masked radial) is homepage-only — scope it to a wrapper class,
not global `body`, so it doesn't bleed into the dashboard.

---

## 6. Sections

Render in this order inside `app/page.tsx`. Each maps to one component in §4.

1. **Site nav** (`site-nav.tsx`, client) — sticky, `backdrop-blur` over translucent bg, bottom border. Left:
   `<LogoMark/>` + "CollabGrid" wordmark. Center: anchor links — Live board (`#board`), Lock lifecycle
   (`#lifecycle`), Architecture (`#arch`), Plans (`#plans`) — hidden under 680px. Right: **Sign in** (ghost)
   and **Sign up** (primary). Smooth-scroll to anchors.

2. **Hero bento** (`hero-bento.tsx`, server) — 6-col bento grid:
   - Copy cell (span 4×2): eyebrow, headline with teal/amber highlighted words, subhead, two CTAs
     (**Get started — it's free** primary, **See how it works** ghost → `#arch`).
   - Live cell (span 2): "Live now" label + pulse dot + `<LiveCounter/>` (client) + "shoppers on this board".
   - Four stat cells from config: Soft lock `60s`, Hard lock `5:00`, Double-spends `0`, `~1 viewport` (the
     last with the mini-grid viewport graphic). Build one `BentoStat` and map the config array.

3. **Board demo** (`board-demo.tsx`, client) — §7. Wrapped in a `<section id="board">` with a `<SectionHead/>`
   ("Live demo" / "Drag the canvas. Click a widget to lock it."), the console frame, and the color legend.

4. **Lock lifecycle** (`lock-lifecycle.tsx`, client) — `<SectionHead/>` + tablist (Open/Soft/Hard/Committed,
   each with its swatch color) switching a panel (text + demo-widget visual). States come from config; one
   panel component rendered for the active tab. Use the color per state via a CSS var (`--c`).

5. **Architecture** (`architecture-section.tsx`, server) — `<SectionHead/>` + 5 cards (3 + 2 layout) from
   config: icon, title, body, mono tech line. One `ArchCard` component, mapped.

6. **Plans** (`plans-section.tsx`, server) — `<SectionHead/>` + Free / Pro cards from config. Pro is the
   featured card (teal glow + "POPULAR" tag). Feature rows render from a `features: string[]` (bolded
   quota numbers). CTA buttons → `/boards` (start) / `/billing` (upgrade). One `PlanCard` component.

7. **Footer** (`site-footer.tsx`, server) — `<LogoMark/>` + wordmark, the same anchor links, tagline.

---

## 7. Board demo (the one complex client island)

A faithful but self-contained port of the prototype `<script>` — **no API, no sockets, all simulated.** Keep
it isolated in `board-demo.tsx` (plus small children if it helps) so the rest of the page stays server-rendered.

Behavior to preserve:
- **Canvas grid** drawn on `<canvas>` with DPR scaling, panned by dragging empty space; coordinate readout +
  peer count in the console bar; `requestAnimationFrame` + `resize` handling.
- **Smart widgets** (photo / name / qty / price) positioned in world space, repositioned on pan. Click an
  **open** (teal) widget → **soft-lock** (amber, 60s, pulse glow) and add to the cart tray.
- **Cart tray** (right rail; off-canvas drawer under 920px with toggle + backdrop): list of held items with
  live countdown timers, subtotal, **Checkout → hard lock (5:00)** (turns items red), then **Complete
  payment** → committed (emerald pop) → item leaves the board and a fresh one respawns.
- **Simulated peers** — two animated peer cursors that periodically soft-lock or buy open widgets, turning
  them amber/red for "other users".
- **Toasts** — reuse the project's existing **sonner** `<Toaster/>` (already in root layout) instead of the
  prototype's bespoke toast box, for the lock/expire/commit/payment messages. Match the copy.
- Respect `prefers-reduced-motion` for the glow/pop animations.

Implement timers/peers in `useEffect` with proper cleanup (clear intervals/RAF on unmount). React-render the
widgets and tray rows from state; keep direct canvas drawing imperative inside the effect. No `any` — type
widgets, peers, and lock state.

---

## 8. Navigation / link map

| Trigger | Action |
|---|---|
| Nav links: Live board / Lock lifecycle / Architecture / Plans | smooth-scroll to `#board` / `#lifecycle` / `#arch` / `#plans` |
| Nav **Sign in** / **Sign up**, hero **Get started**, Free plan **Start free** | `/boards` (no auth yet — entry into the app; leave a comment to repoint at real auth later) |
| Hero **See how it works** | `#arch` |
| Pro plan **Upgrade to Pro** | `/billing` |
| Footer links | same anchors as nav |
| Board-demo widget / checkout / pay / cart toggle | internal demo state handlers (+ sonner toasts) — no navigation |

No `href="#"` placeholders anywhere.

---

## 9. Acceptance criteria

- Visiting `/` renders the homepage (no longer redirects to `/boards`); the dashboard routes are unaffected.
- All seven sections match the prototype: tokens, Space Grotesk headings, bento grid spans, hover/animation
  states, responsive breakpoints (980 / 920 / 680 / 420px).
- The board demo works end-to-end: pan, soft-lock, checkout hard-lock, payment-commit + respawn, peer
  activity, countdown timers, and sonner toasts — with no console errors and effects cleaned up on unmount.
- Lifecycle tabs switch panels; nav/footer anchors smooth-scroll; every CTA routes per §8.
- Static sections are server components; only nav, live counter, lifecycle tabs, and board demo are
  `'use client'`. No duplicated section/card/plan markup; content driven by typed config in `lib/home-content.ts`.
- No `any` types; new entities typed in `src/types/home.ts`.
- `pnpm build` and `pnpm lint` pass clean (lint runs with `--max-warnings 0`).
```

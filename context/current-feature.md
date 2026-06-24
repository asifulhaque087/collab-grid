# Current Feature: Homepage Design

## Status

In Progress

## Goals

- Build the public landing page at `/` from `prototypes/homepage.html` (pixel-perfect), replacing the current `/ → /boards` redirect; dashboard routes stay untouched.
- Compose seven sections in `app/page.tsx`: sticky nav, hero bento, live board demo, lock-lifecycle tabs, architecture grid, plans, footer.
- Server-first: only nav, live counter, lifecycle tabs, and the board demo are `'use client'`; every static section is a server component.
- Reuse existing Tailwind v4 tokens + ShadCN; add only Space Grotesk display font, hard-lock red, surface-2/border-soft, and homepage-only keyframes.
- Keep it DRY: one component per repeated pattern (bento stat, section head, logo mark, arch card, plan card, lifecycle panel), driven by typed config in `lib/home-content.ts`.
- Wire every link correctly per the §8 map; no dead `href="#"`. Reuse the project's sonner Toaster for demo toasts.
- `pnpm build` and `pnpm lint` pass clean.

## Notes

- Spec: `context/features/homepage-design.spec.md` (source of truth; mockup `prototypes/homepage.html` is the visual source of truth).
- Board demo is a **self-contained simulation** — no API, no sockets, do NOT reuse `canvas-editor.tsx`. Behavior: pan, soft-lock (60s amber), checkout hard-lock (5:00 red), payment-commit (emerald pop + respawn), simulated peer cursors, countdown timers, sonner toasts. Effects must clean up on unmount; respect `prefers-reduced-motion`.
- Routing: turn `app/page.tsx` from a redirect into the composed homepage; set page-specific metadata (broaden root metadata which currently says "Dashboard").
- Dashboard pages moved under `/dashboard`: the shell group is now `app/dashboard/(shell)/*` (header+sidebar, 9 list pages at `/dashboard/boards` … `/dashboard/settings`), the canvas is `app/dashboard/boards/[slug]` (full-screen, no shell), and `app/dashboard/page.tsx` redirects `/dashboard → /dashboard/boards`. Updated all links (nav.ts, plan-usage-card, board-card, canvas back button, home-content APP_ENTRY/BILLING_HREF).
- Sign in / Sign up / Get started / Start free → `/dashboard` (no auth yet, comment to repoint later). See how it works → `#arch`. Upgrade to Pro → `/dashboard/billing`. Nav/footer anchors smooth-scroll.
- Scope the dotted grid backdrop to a wrapper class (not global `body`) so it doesn't bleed into the dashboard.
- Out of scope: auth pages, real dashboard wiring.

## History

- **Dashboard Design** — Built the full Next.js 16 dashboard from `prototypes/dashboard.html`: shared header+sidebar shell, 9 routed pages (Boards, Inventory, Users, Roles, Plans, Orders, Transactions, Billing, Settings) with rhf+zod modals, Tailwind v4 tokens + ShadCN, and the live `/boards/[slug]` canvas editor (pan/zoom, soft-lock, drag-drop, checkout). Mock loaders stand in for the API.

# CollabGrid — Project Overview

> A unified, ultra-fast collaborative workspace platform combining real-time visual canvas management with high-throughput transactional inventory booking.

---


## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Users](#users)
3. [Tech Stack](#tech-stack)
4. [Roles](#roles)
5. [Functional Requirements](#functional-requirements)
6. [Non Functional Requirements](#non-functional-requirements)
7. [Product Workflows](#product-workflows)
8. [Database Schema](#database-schema)
9. [Monetization & Plans](#monetization--plans)
10. [UI/UX Spec](#uiux-spec)


---

## Problem Statement

Standard tooling fails at the intersection of real-time spatial collaboration and high-frequency transactional operations:

| Pain Point                                       | Root Cause                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------- |
| Jerky canvas updates or crashes under load       | REST frameworks cannot sync high-frequency spatial mutations                    |
| Race conditions on shared canvas assets          | No atomic ownership model for concurrent widget interactions                    |
| Wasted server bandwidth                          | Updates broadcast to all users, including those who can't see the affected area |
| DB lock contention during flash sales            | Row-level SQL locks cannot handle burst transaction velocity                    |
| Idle resource consumption from backgrounded tabs | No lifecycle-aware socket management                                            |

CollabGrid solves all five with a single platform: a hardware-accelerated collaborative canvas backed by Redis atomic locks, viewport-filtered WebSocket streams, and a decoupled RabbitMQ checkout pipeline.

---

## Users

### Tenant Administrator (Corporate Client)
Needs isolated, high-performance canvas environments to position, configure, and monitor high-value interactive widgets tied to physical or digital inventory assets.

**Primary actions:** Create/manage boards, organize widgets on board, manage roles.

### Concurrent End-User (Collaborator / Shopper)
Needs lag-free visual updates, localized canvas changes, and an instant, dependable lock-to-checkout flow for limited items.

**Primary actions:** Pan/zoom canvas, interact with widgets, lock and buy item.

---

## Tech Stack

| Layer                     | Technology                  | Purpose                                                       |
| ------------------------- | --------------------------- | ------------------------------------------------------------- |
| Monorepo Orchestration    | Turborepo                   | Build caching, workspace management, shared internal packages |
| **Frontend Framework**    | Next.js 16 (React 19)       | Dashboards, SSR, routing                                      |
| **Backend Framework**     | NestJS                      | WebSocket and business logic, modular architecture            |
| **Primary Database**      | PostgreSQL + Drizzle ORM    | Type-safe relational storage, declarative migrations          |
| **In-Memory / Geo Store** | Redis + Redis GEO           | Viewport bounding-box lookups, atomic distributed locks       |
| **Message Broker**        | RabbitMQ                    | Async checkout queue, distributed commitment, debounce update |
| **Canvas Rendering**      | HTML5 Canvas API (2D)       | Hardware-accelerated, high-framerate widget rendering         |
| **Styling**               | Tailwind CSS v4 + ShadCN UI | Modular, performance-optimized component system               |
| **Forms & Validation**    | React Hook Form + Zod       | Widget configuration forms, coordinate validation             |

### Suggested Libraries & Icons

| Purpose             | Package                                               |
| ------------------- | ----------------------------------------------------- |
| Icons               | [`lucide-react`](https://lucide.dev)                  |
| WebSocket client    | [`socket.io-client`](https://socket.io)               |
| Canvas utilities    | [`konva`](https://konvajs.org) or native Canvas 2D    |
| State management    | [`zustand`](https://zustand-demo.pmnd.rs)             |
| Toast notifications | [`sonner`](https://sonner.emilkowal.ski)              |
| Date utilities      | [`date-fns`](https://date-fns.org)                    |
| Data tables         | [`@tanstack/react-table`](https://tanstack.com/table) |
| Animations          | [`framer-motion`](https://www.framer.com/motion/)     |
| Permission checks   | [`@casl/react`](https://casl.js.org)                  |

---


## Roles

This application will have 2 system roles. Those are unremovable or can't be deleted.

- super-admin - manage the sass or the developers who are building this sass for his first startup
- tenant - subscribe to plan


Super- admin can create multiple roles with permissions to manage the sass. Also tenant can create multiple roles with permissions to manage his business.



## Functional requirements


Here are listed all the requirements (stories) categorized by the roles

### Super admin


- As a super admin I want to have all permissions to mange users, roles, plans, transactions


### Tenant


- As a tenant, I want to register & login
- As a tenant, I want to edit my profile information
- As a tenant, I want to subscribe to a plan
- As a tenant, I want to create multiple boards
- As a tenant, I want to create multiple smart widgets per board.
- As a tenant, I want to organize widgets by dragging widget on the boards
- As a tenant, i want to create multiple users
- As a tenant, I want to create multiple roles assigning permissions
- As a tenant, I want to share the board using a url
- As a tenant, I want to publish the board so end user can join


### End user

There are no official role for end user because they not have to register to buy a widget. They will click on the link shared by the admin to a maybe public group and join the board.


- As an end user, I want to join a board with url without registration
- As an end user, I want to click on a widget to buy it
- As an end user, I want to checkout to give address
- As an end user, I want to pay using card
- As an end user, I want to have a email confirmation with order invoice
- As an end user, I want to pan over the board


## Non Functional requirements



- Distinct item:  Every widget is different record in database. Suppose tenant have created a sneaker with 3 quantity. End user have to buy the whole stock. If tenant want to sell 3 sneaker separately then he have to create those 3 sneaker as Distinct record in database with quantity 1.

- Live View Rate-Limiting: If a user scrolls or pans across the canvas, you need to track what area they are looking at (bounding boxes). The backend must only stream updates for widgets inside their current viewport to save bandwidth.

- Muted/Active Connection States: Track active vs. idle tabs. If a user backgrounds their browser tab, drop their WebSocket connection down to a "heartbeat-only" low-resource state. If they reopen it or when the tab turns inactive to active, fast-sync the missing delta changes immediately.

- Soft Lock: Clicking an inventory widget on the canvas locks it for 60 seconds. It turns amber for all other users looking at that canvas.

- Hard Lock: If the user initiates checkout, items moves to a distributed queue and locks them for 5 minutes and they turns red for all the other user looking at that canvas. If they don't pay within 5 minutes, the lock expires,  items returns to the canvas, and a real-time event updates all connected clients.

- Abuse Prevention: Detect "mouse-teleportation" bots (users moving items faster than humanly possible across the grid coordinate system).

- Zero Double-Spend: Make sure for a single order not double payment happen


## Product workflows


Here are listed all the workflows categorized by the roles.


### Super admin


- As an super admin, I want to access all the menu under Administration level of left sidebar except Order menu and its page.


### Tenant


- As a tenant, I want to access Boards, Inventory, User, Role, Order, Settings menu of left sidebar

- As a tenant, clicking Boards should show all the board list. every board should include share, import inventory, publish action.

- As a tenant, clicking on import inventory should open a file picker to select csv file. After selecting file I should redirect to the board. Then there should a right sidebar that should show all the inventory as smart widget cart but in small size like a thumbnail. Then I can drag those item to the board. Immediately widget gets its x,y coordinate.

- As a tenant, I want to  create inventory from the left sidebar inventory menu also. In that case, no inventory record will be attach to a board. I should be able to attach an inventory to a board. After attaching, this inventory item should be shown in the right sidebar of the board. Again user can drag it to the board.

- As a tenant, clicking on share action of board card A modal should open to copy the url.

- As a tenant, clicking no publish action of board card The board should be in online so any user can in join with the link that we copied when clicking on share action.

- As a tenant, clicking on orders button of left sidebar all the orders I should see in a table.

- As a tenant, clicking on Billing I should see all the plans  card so I can upgrade or downgrade.

- As a tenant, clicking on Setting, I want to remove my account change my password.



### End user


- As an end user, I want a dedicated right sidebar that displays all widgets I have currently locked along with an active countdown timer for each, so I can keep track of my items even if I pan away from them on the canvas. This sidebar also should include checkout action



## Database Schema

Refer @apps/api/src/schemas directory for all the drizzle scheams of our application

---

## Monetization & Plans

| Feature | Free Plan | Pro Plan ($9/month) |
|---|---|---|
| Max Boards | 2 | 15 |
| Custom Roles | 3 per tenant | 20 per tenant |
| Widgets per Board | 25 | Unlimited |

**Plan enforcement** is handled at the database level via `userPlanSnapshot` and `groupPermission.totalOperation`. During development, restrictions are bypassable for evaluation purposes.

**Payment methods** (Bangladeshi market): bKash, Nagad, SSLCommerz, Manual.

**Billing durations:** 1, 6, 12, or 24 months.

---

## UI/UX


### Specification

- 240px left sidebar. Here under workspace label there should be two menu - Boards, Inventory. Under Administration level there should be 4 menu - User, Roles, Plans, Orders, Transactions. Under System level there should  be Billing, Settings menu.

- Boards page should show all the board list. every board should include share, import inventory, publish action. This is the main dashboard page.

- Inventory should show all the inventory items in a table. There should be filter option to filter inventory using board, name/title, stock, price. Table should be scrollable horizontally in small screen. Every row should an action column to delete, edit the inventory. Also there should a button to create a new inventory or bulk import from csv file. Creating a inventory a modal should open. 

- User page should list all the users. Should be filtered by name, roles, plans. Also need a button a add a new user assigning a role through a modal.

- Role page should list all the roles.  Need a button to create a new role assigning permissions through a modal.

- Plan page should list all the plans. Need a button to create a new plan assigning permissions through a modal.

- By default dark mode should be enabled.


### Design System

| Token               | Value                          | Usage                                    |
| ------------------- | ------------------------------ | ---------------------------------------- |
| `--color-brand`     | `#1e3a8a` (Deep Navy)          | Structure, frames, sidebar background    |
| `--color-active`    | `#0d9488` (Clinical Teal)      | Open / editable / active widget state    |
| `--color-soft-lock` | `#d97706` (Amber)              | Soft-locked (Line A) widget state        |
| `--color-committed` | `#059669` (Emerald)            | Finalized / purchased / secure state     |
| `--color-bg`        | `#0f172a`                      | Dark canvas background                   |
| `--color-surface`   | `#1e293b`                      | Card / panel background                  |
| `--color-border`    | `#334155`                      | Dividers, widget borders                 |
| `--font-mono`       | `JetBrains Mono` / `Fira Code` | Coordinates, system variables, telemetry |
| `--font-ui`         | `Inter`                        | All interface labels and body copy       |


### Micro-interactions

| Trigger                       | Behaviour                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- |
| Widget enters soft-lock state | Ambient amber radial glow pulse (CSS `@keyframes`)                                                   |
| Widget moved by peer          | Smooth CSS `translate` transition to new position                                                    |
| Hard-commit failure           | Sonner toast: "Reservation expired — item returned to canvas."                                       |
| Checkout success              | Widget transitions from Amber → Emerald with a brief scale pop                                       |
| Quota limit reached           | Relevant UI control grays out with tooltip: "Upgrade to Pro"                                         |
| Tab backgrounded              | WebSocket silently downgrades to heartbeat; banner on re-focus: "Syncing changes…"                   |
| Mouse position                | Cursor coordinates update live in sticky header and control deck, mapped via canvas transform matrix |


---

## Useful Reference Links

- [Next.js 15 Docs](https://nextjs.org/docs)
- [NestJS Docs](https://docs.nestjs.com)
- [Drizzle ORM Docs](https://orm.drizzle.team)
- [Redis GEO Commands](https://redis.io/docs/latest/commands/?group=geo)
- [RabbitMQ Tutorials](https://www.rabbitmq.com/tutorials)
- [CASL Docs](https://casl.js.org/v6/en)
- [ShadCN UI](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [Lucide Icons](https://lucide.dev/icons)
- [Sonner (toasts)](https://sonner.emilkowal.ski)
- [TanStack Table](https://tanstack.com/table/latest)
- [Recharts](https://recharts.org)


# Jira-Style Kanban App — Design Spec

**Date:** 2026-06-13
**Status:** Approved
**Purpose:** Learning + portfolio piece. Optimized for demonstrating modern full-stack Next.js patterns, polished enough to demo to employers, single-developer scope.

## 1. Overview

A Jira-style project tracker: multiple boards, each with fixed To Do / In Progress / Done columns, drag-and-drop tickets with optimistic UI, rich ticket details (assignee, priority, comments, labels, epics), credential-based auth with seeded demo users, Storybook-driven UI components, and a CI pipeline that tests against a real Postgres database.

## 2. Tech Stack

| Concern     | Choice                                         | Notes                                                          |
| ----------- | ---------------------------------------------- | -------------------------------------------------------------- |
| Framework   | Next.js 15 (App Router), latest stable         | React 19; all target patterns identical to the Next 14 brief   |
| Language    | TypeScript (strict)                            |                                                                |
| Styling     | Tailwind CSS + next-themes                     | `darkMode: 'class'`; every component themed from day one       |
| Components  | Storybook                                      | All `components/ui` primitives built in isolation first        |
| Database    | PostgreSQL via Docker Compose (local dev + CI) | Production database deferred to deploy phase (likely Neon)     |
| ORM         | Prisma                                         |                                                                |
| Auth        | Auth.js (NextAuth) v5, Credentials provider    | JWT session cookies; bcrypt password hashing                   |
| Drag & drop | @hello-pangea/dnd                              | Maintained React 18/19 fork; react-beautiful-dnd is archived   |
| Validation  | Zod                                            | Single schema source shared by client forms and Server Actions |
| Testing     | Jest + React Testing Library                   | Unit + component tests only; no E2E runner                     |
| CI/CD       | GitHub Actions; Vercel at deploy phase         |                                                                |

## 3. Architecture: Server-First + Server Actions

No REST API routes. No client fetching library. No client cache.

- **Reads:** Server Components call `lib/dal/` functions, which query Prisma directly. `loading.tsx` files with skeleton components handle Suspense states.
- **Writes:** Every mutation is a Server Action: check session → parse input with shared Zod schema → Prisma write → `revalidatePath()`. Forms use `useActionState` for per-field validation errors.
- **Optimistic UI:** Drag-and-drop uses `useOptimistic` — UI updates instantly, the Server Action persists in the background inside `startTransition`, and optimistic state auto-reverts on failure with a toast.

```
Browser (Client Component)
  │  drag ticket → useOptimistic updates UI instantly
  │  form submit → calls Server Action directly
  ▼
Server Action ("use server")
  │  auth check via Auth.js session
  │  Zod-validates payload
  ▼
Data layer (lib/dal) → Prisma → PostgreSQL
  │
  ▼
revalidatePath() → Server Components re-render
```

## 4. Data Model

```prisma
enum Status   { TODO  IN_PROGRESS  DONE }
enum Priority { LOW  MEDIUM  HIGH  URGENT }

User    id, name, email (unique), passwordHash, avatarColor,
        assignedTickets[], reportedTickets[], comments[]

Board   id, name, slug (unique, used in URLs), description?,
        ticketCounter (for keys like "WEB-12"), tickets[], epics[]

Ticket  id, key ("WEB-12"), title, description?, status, priority,
        position (Int — ordering within a column),
        boardId, assigneeId?, reporterId, epicId?,
        labels[] (many-to-many), comments[],
        createdAt, updatedAt

Comment id, body, ticketId, authorId, createdAt

Label   id, name (unique), color   — shared across boards

Epic    id, name, color, boardId   — scoped to one board
```

**Ticket keys:** each board stores an explicit uppercase `prefix` (2–5 chars, unique), defaulted at creation from the first letters of the board name and editable in seed data; `ticketCounter` increments atomically on ticket creation to produce keys like `WEB-12`.

**Ordering:** `position` is an integer. The `moveTicket(ticketId, newStatus, newIndex)` action rewrites positions for the affected column(s) inside a single Prisma transaction. Chosen over fractional ranking for simplicity at portfolio scale (tens of tickets per column).

**Seed data:** ~5 users including a well-known demo login (`demo@example.com` / `demo1234`), 2–3 boards, a handful of labels and epics, 20–30 tickets across columns, with comments.

## 5. Routing & Project Structure

```
/login                      (auth) group — no app shell
/boards                     board list; landing page after login
/boards/[slug]              the Kanban board
/boards/[slug]/[ticketKey]  ticket detail
```

**Ticket detail uses parallel + intercepting routes:** clicking a ticket on the board opens a modal overlay (board visible behind it, URL updates); a direct visit or refresh of the same URL renders a full standalone page.

```
src/
  app/
    (auth)/login/
    (app)/                  layout.tsx = Navbar + Sidenav shell
      boards/
        [slug]/
          @modal/(.)[ticketKey]/   intercepted modal
          [ticketKey]/             full-page fallback
  components/
    ui/         Storybook-driven primitives: Avatar, Badge, Button,
                Dropdown, ThemeToggle, Modal, Skeleton…
    layout/     Navbar, Sidenav — rendered from config
    board/      BoardView, Column, TicketCard, DndProvider
    tickets/    TicketForm, TicketDetail, CommentThread
  config/
    navigation.ts   typed nav-item arrays (label, href, icon)
  lib/
    prisma.ts, auth.ts
    dal/        ALL Prisma queries (boards.ts, tickets.ts, users.ts)
  actions/      Server Actions only (tickets.ts, comments.ts, auth.ts)
  schemas/      Zod schemas — shared by client forms and actions
prisma/         schema.prisma, migrations/, seed.ts
.storybook/
```

**Boundary rules:**

- `components/` never imports Prisma; only Server Components in `app/` and `lib/dal/` touch the database.
- Zod schemas live only in `schemas/` and validate on both client and server.
- `config/` is data, not JSX — adding a nav item is a one-line config change.

## 6. Authentication

- Auth.js v5 Credentials provider: login form Zod-validates, provider looks up the user by email in Prisma and verifies the password with bcrypt.
- Sessions are JWT cookies — no session table.
- `middleware.ts` protects all routes except `/login`, redirecting unauthenticated visitors.
- **Every Server Action re-checks the session as its first statement.** Middleware is convenience, not the security boundary.
- Registration is out of scope; users come from the seed script.

## 7. Error Handling

Three layers:

1. **Zod at the boundary** — malformed input rejected with field-level messages, surfaced via `useActionState`.
2. **Typed action results** — Server Actions return `{ ok: true, data } | { ok: false, error }` rather than throwing (thrown action errors leak poorly to the client).
3. **Route-level `error.tsx`** boundaries catch anything unexpected, with a retry button.

Optimistic drag-and-drop failures auto-revert to the last confirmed server state and show a toast.

## 8. Theming & Storybook

- next-themes with class strategy; `ThemeToggle` in the Navbar; all components carry `dark:` variants from creation.
- Storybook has a theme-toggle decorator so every story is verified in both modes.
- Rule: anything in `components/ui` exists in Storybook before it is used in the app.

## 9. Testing

Jest + React Testing Library, chosen for value-per-test:

- **Zod schemas** — pure, fast, catch contract drift between forms and actions.
- **UI primitives** — render + interaction tests.
- **Optimistic board reducer** — a pure function and the most logic-dense code in the app; thoroughly unit-tested (move within column, across columns, revert).
- **Form components** — with mocked Server Actions, asserting validation-error rendering.

DAL functions and Server Actions stay thin enough to be covered by typechecking plus schema tests. No E2E runner.

## 10. CI/CD

One GitHub Actions workflow on every push/PR, from phase 1:

```
lint → typecheck → test → build
```

plus a Postgres service container against which `prisma migrate deploy` and the seed script run — proving migrations and seeds never break. Vercel deployment (and the production-database decision, likely Neon) lands in the final phase.

## 11. Build Phases

Each phase ends demoable:

1. **Foundation** — Next 15 scaffold, Tailwind, ESLint/Prettier, Docker Compose Postgres, Jest, CI pipeline green
2. **Database** — Prisma schema, migrations, seed script, DAL
3. **Auth** — Auth.js, login page, middleware protection
4. **App shell** — Storybook + UI primitives, config-driven Navbar/Sidenav, theme toggle
5. **Kanban board** — read-only board, then drag-and-drop with optimistic moves
6. **Ticket management** — create/edit forms, assignment, intercepting-route detail modal
7. **Rich features** — comments, labels, epics (isolated; core app works without them)
8. **Deploy** — Vercel + production database

## 12. Out of Scope

- User registration / password reset (seeded users only)
- Custom or reorderable columns
- Real-time multi-user sync (websockets)
- E2E testing (Playwright)
- Notifications, search, filtering beyond what the board view provides
- Billing, teams/permissions beyond "any logged-in user can do anything"

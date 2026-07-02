# Phase 5: Kanban Board — Design Spec

**Date:** 2026-07-02
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-13-jira-kanban-design.md` (§3 optimistic architecture, §4 ordering, §7 error handling, §9 testing)
**Builds on:** Phases 1–4 (schema/seed/DAL, auth, app shell + UI primitives).

## 1. Purpose

Turn the `/boards` placeholder into the working product: a board list and a per-board Kanban with three fixed columns (To Do / In Progress / Done). Read-only first, then drag-and-drop with optimistic moves that persist via a Server Action and revert-with-toast on failure. Ends demoable.

## 2. Platform reality (verified mid-2026)

- **`@hello-pangea/dnd` 18.0.1** (react-beautiful-dnd fork) officially supports React 19 (`peer: ^18 || ^19`). **Gotcha:** Next App Router runs Strict Mode in dev, double-invoking effects and racing `Droppable` registration → a small **`StrictModeDroppable`** wrapper (delays `isDropDisabled`/enabled via `useEffect` + `requestAnimationFrame`) is required. All drag components are `'use client'`.
- **`useOptimistic`** (React 19): base state must be replaced on success (via `revalidatePath`/refresh) or the optimistic value snaps back when the transition ends.
- **`sonner` 2.0.7** for toasts (React 19 compatible); one `<Toaster/>` in the root layout.
- Dense integer `position` reindex inside a Prisma `$transaction` is the right ordering strategy at portfolio scale (tens of tickets/column); no LexoRank.

## 3. Scope

**In scope:**

- Board list page (`/boards`) — cards from `getBoards()`, linking to each board.
- Board page (`/boards/[slug]`) — three columns rendered from `getBoardWithTickets()`.
- `components/board/`: `TicketCard`, `Column`, `BoardView`, `StrictModeDroppable`.
- Pure reorder logic `lib/board/move.ts` (`moveTicketInColumns`), exhaustively unit-tested.
- `moveTicket` Server Action with a position-reindexing transaction.
- Optimistic drag-and-drop (`useOptimistic` + `startTransition`) with `sonner` revert toast.

**Deferred:** ticket create/edit + the intercepting-route detail modal (Phase 6); comments/labels/epics management (Phase 7). Columns are fixed (parent §12). No reordering of columns.

## 4. Components & interfaces

### 4.1 Reads (already built — Phase 2 DAL)

- `getBoards(): Board[]` (name asc).
- `getBoardWithTickets(slug)` → `BoardWithTickets` = `{ …board, columns: { TODO, IN_PROGRESS, DONE } }`, each a `BoardTicket[]` (ticket + `assignee{id,name,avatarColor}` + `labels` + `epic`), ordered by `position`. Reuse the exported `BoardWithTickets` / `BoardTicket` types.

### 4.2 Pure reorder logic — `src/lib/board/move.ts`

The logic-dense core, framework-free and unit-tested independently of React/dnd.

- `type Columns = Record<Status, BoardTicket[]>`.
- `moveTicketInColumns(columns: Columns, move: { ticketId: string; toStatus: Status; toIndex: number }): Columns` — removes the ticket from its current column, inserts it into `toStatus` at `toIndex`, returns NEW column arrays (immutable). Handles: same-position no-op, empty destination, end-of-column (`toIndex === length`), same-column up vs down, cross-column (removal shifts source, insertion opens dest).

### 4.3 Server Action — `src/actions/tickets.ts` (`'use server'`)

- `type MoveResult = { ok: true } | { ok: false; error: string }`.
- `moveTicket(ticketId: string, toStatus: Status, toIndex: number): Promise<MoveResult>`:
  1. `verifySession()` first (security boundary).
  2. Validate inputs with a Zod schema (`moveTicketSchema` in `src/schemas/ticket.ts`): `ticketId` non-empty, `toStatus` a `Status` enum, `toIndex` int ≥ 0.
  3. Load the ticket (its `boardId`, current `status`); if missing → `{ ok: false }`.
  4. In a single `prisma.$transaction`: read the destination column's tickets (by `boardId` + `toStatus`, ordered by `position`, excluding the moved ticket), splice the moved ticket in at `toIndex`, and write gapless positions `0..n` to that column (updating the moved ticket's `status` too). If the move crosses columns, also **reindex the source column** `0..n` to close the gap left behind. (The source-column reindex is the classic bug if omitted.)
  5. `revalidatePath` the board's path so the server state updates (the plan pins the exact call).
  6. Return `{ ok: true }`; on any thrown error return `{ ok: false, error }` (parent §7 — actions return typed results, don't throw across the boundary).

### 4.4 Board components (`src/components/board/`)

- **`TicketCard`** (presentational): shows `key`, `title`, a priority `Badge`, the assignee `Avatar` (if any), and label `Badge`s. No Prisma.
- **`Column`**: a titled column (label + ticket count) that is a dnd `Droppable`; renders its `BoardTicket[]` as `Draggable` `TicketCard`s.
- **`StrictModeDroppable`**: wraps `@hello-pangea/dnd`'s `Droppable`, enabling it only after mount (`useEffect` + `requestAnimationFrame`) to survive App-Router Strict Mode.
- **`BoardView`** (`'use client'`): receives the initial `BoardWithTickets`; holds `useOptimistic` over the three columns; renders `DragDropContext` + three `Column`s; implements `onDragEnd`.

### 4.5 Optimistic flow

```
BoardView(initial):
  const [columns, setOptimistic] = useOptimistic(initial.columns)
  onDragEnd(result):
    if !result.destination or no-op: return
    const next = moveTicketInColumns(columns, { ticketId, toStatus, toIndex })
    startTransition(async () => {
      setOptimistic(next)                              // instant UI
      const res = await moveTicket(ticketId, toStatus, toIndex)
      if (!res.ok) toast.error('Move failed — reverted')  // base unchanged → auto-revert
    })
  // on success, revalidatePath re-renders the server component with committed data
```

### 4.6 Pages

- `src/app/(app)/boards/page.tsx` — server component: `getBoards()` → a responsive grid of board cards (name, prefix, description) linking to `/boards/[slug]`.
- `src/app/(app)/boards/[slug]/page.tsx` — server component: `getBoardWithTickets(slug)`; `notFound()` if null; render `<BoardView board={board} />`.
- Root layout gains `<Toaster />` (sonner).

## 5. Data flow

```
/boards (server) → getBoards() → board cards
/boards/[slug] (server) → getBoardWithTickets() → <BoardView/> (client, useOptimistic)
drag → onDragEnd → moveTicketInColumns (pure) → startTransition:
  setOptimistic (instant) → moveTicket action → $transaction reindex → revalidatePath
  fail → sonner toast + auto-revert
```

## 6. Testing (spec §9)

- **`moveTicketInColumns`** — the priority: exhaustive pure-function tests (same-position no-op, into empty column, to end, same-column upward and downward, cross-column with source+dest reindex, moving a column's last ticket). No React/DOM.
- **`Column` / `TicketCard`** — light render tests (renders its tickets; card shows key + title + assignee). Wrap dnd components in the minimal context they require, or test `TicketCard` in isolation.
- **`moveTicket`** — thin; covered by typecheck + the reducer tests. The drag gesture itself is not E2E-tested (no E2E runner per parent §12).

## 7. Done criteria

- `lint`, `format:check`, `typecheck`, `test`, `build`, `build-storybook` all green.
- `/boards` lists the seeded boards; each links to its Kanban.
- `/boards/[slug]` shows tickets in the correct columns/order; dragging a ticket moves it instantly, persists (survives reload), and a failed move reverts with a toast.
- `moveTicketInColumns` is exhaustively unit-tested; no component imports Prisma; every Server Action re-checks the session.

**Next plan:** Phase 6 (ticket create/edit forms + the intercepting-route detail modal that consumes the `Modal` primitive).

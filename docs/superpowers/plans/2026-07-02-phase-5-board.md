# Phase 5: Kanban Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the board list and per-board Kanban (To Do / In Progress / Done) — read-only first, then drag-and-drop with optimistic moves that persist via a Server Action and revert-with-toast on failure.

**Architecture:** Server components read via the existing DAL. A pure `moveTicketInColumns` reducer computes reorders (unit-tested). `BoardView` (`'use client'`) wraps the columns in `useOptimistic` and drives `@hello-pangea/dnd`; `onDragEnd` runs the reducer then `startTransition(setOptimistic → moveTicket action → toast on failure)`. `moveTicket` reindexes positions in a Prisma `$transaction` and `revalidatePath`s.

**Tech Stack:** Next.js 16, React 19, `@hello-pangea/dnd` 18, `sonner` 2, Prisma, Zod 4, Jest.

**Spec:** `docs/superpowers/specs/2026-07-02-phase-5-board-design.md`.

## Global Constraints

- All drag-and-drop components are `'use client'`. `@hello-pangea/dnd`'s `Droppable` must be wrapped in a **`StrictModeDroppable`** (enable after mount via `useEffect` + `requestAnimationFrame`) to survive Next App-Router Strict Mode.
- `useOptimistic(base, (_, next) => next)`: the base is the server prop; on a successful move the action `revalidatePath`s so the base updates, otherwise the optimistic value auto-reverts.
- `moveTicket` re-checks the session (`verifySession()`) first, Zod-validates, and returns a typed `{ ok }` result (never throws across the boundary).
- Position is a dense integer per (board, status); a move reindexes **both** the source and destination columns to gapless `0..n` inside one `$transaction`.
- Next 16: route `params` is a Promise — `const { slug } = await params`.
- `components/` never imports Prisma. App/component code uses the `@/` alias.
- Reuse the existing DAL types `BoardWithTickets` / `BoardTicket` from `@/lib/dal/boards`. Prettier: single quotes, no semicolons, 2-space.

---

### Task 1: Dependencies and the toast host

**Files:**

- Modify: `package.json`/`package-lock.json`, `src/app/layout.tsx`

**Interfaces:**

- Produces: `@hello-pangea/dnd` + `sonner` installed; a `<Toaster />` mounted app-wide.

- [ ] **Step 1: Install**

```bash
npm install @hello-pangea/dnd sonner
```

- [ ] **Step 2: Mount the Toaster** — `src/app/layout.tsx`

Import sonner's `Toaster` and render it inside `<ThemeProvider>`, after `{children}`:

```tsx
import { Toaster } from 'sonner'
// ...existing imports...

// inside <body> → <ThemeProvider>:
;<ThemeProvider>
  {children}
  <Toaster richColors position="bottom-right" />
</ThemeProvider>
```

- [ ] **Step 3: Verify and commit**

```bash
npm run typecheck && npm run build
git add package.json package-lock.json src/app/layout.tsx
git commit -m "chore: add @hello-pangea/dnd and sonner with a Toaster host"
```

---

### Task 2: Pure reorder reducer (TDD)

**Files:**

- Test: `src/lib/board/__tests__/move.test.ts`
- Create: `src/lib/board/move.ts`

**Interfaces:**

- Produces: `type Columns = Record<Status, BoardTicket[]>`; `moveTicketInColumns(columns: Columns, move: { ticketId: string; toStatus: Status; toIndex: number }): Columns`.

- [ ] **Step 1: Write the failing tests** — `src/lib/board/__tests__/move.test.ts`

```ts
import { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'
import { moveTicketInColumns, type Columns } from '../move'

const t = (id: string, status: Status): BoardTicket =>
  ({ id, status }) as unknown as BoardTicket

function cols(todo: string[], inProgress: string[], done: string[]): Columns {
  return {
    TODO: todo.map((id) => t(id, Status.TODO)),
    IN_PROGRESS: inProgress.map((id) => t(id, Status.IN_PROGRESS)),
    DONE: done.map((id) => t(id, Status.DONE)),
  }
}

const ids = (list: BoardTicket[]) => list.map((x) => x.id)

test('moves a ticket down within its column', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'a',
    toStatus: Status.TODO,
    toIndex: 2,
  })
  expect(ids(next.TODO)).toEqual(['b', 'c', 'a'])
})

test('moves a ticket up within its column', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'c',
    toStatus: Status.TODO,
    toIndex: 0,
  })
  expect(ids(next.TODO)).toEqual(['c', 'a', 'b'])
})

test('same-position move is a no-op ordering', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'b',
    toStatus: Status.TODO,
    toIndex: 1,
  })
  expect(ids(next.TODO)).toEqual(['a', 'b', 'c'])
})

test('moves across columns, reindexing both', () => {
  const next = moveTicketInColumns(cols(['a', 'b'], ['x', 'y'], []), {
    ticketId: 'a',
    toStatus: Status.IN_PROGRESS,
    toIndex: 1,
  })
  expect(ids(next.TODO)).toEqual(['b'])
  expect(ids(next.IN_PROGRESS)).toEqual(['x', 'a', 'y'])
  expect(next.IN_PROGRESS.find((c) => c.id === 'a')?.status).toBe(
    Status.IN_PROGRESS,
  )
})

test('moves into an empty column', () => {
  const next = moveTicketInColumns(cols(['a'], [], []), {
    ticketId: 'a',
    toStatus: Status.DONE,
    toIndex: 0,
  })
  expect(ids(next.TODO)).toEqual([])
  expect(ids(next.DONE)).toEqual(['a'])
})

test('moves to the end of a column (index === length)', () => {
  const next = moveTicketInColumns(cols(['a'], ['x', 'y'], []), {
    ticketId: 'a',
    toStatus: Status.IN_PROGRESS,
    toIndex: 2,
  })
  expect(ids(next.IN_PROGRESS)).toEqual(['x', 'y', 'a'])
})

test('returns the input unchanged for an unknown ticket', () => {
  const input = cols(['a'], [], [])
  const next = moveTicketInColumns(input, {
    ticketId: 'zzz',
    toStatus: Status.DONE,
    toIndex: 0,
  })
  expect(next).toBe(input)
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- board/__tests__/move` (or `npm test -- move`)
Expected: FAIL — cannot find module '../move'.

- [ ] **Step 3: Implement** — `src/lib/board/move.ts`

```ts
import type { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'

export type Columns = Record<Status, BoardTicket[]>

export function moveTicketInColumns(
  columns: Columns,
  move: { ticketId: string; toStatus: Status; toIndex: number },
): Columns {
  const { ticketId, toStatus, toIndex } = move

  let fromStatus: Status | undefined
  let ticket: BoardTicket | undefined
  for (const status of Object.keys(columns) as Status[]) {
    const found = columns[status].find((c) => c.id === ticketId)
    if (found) {
      fromStatus = status
      ticket = found
      break
    }
  }
  if (!ticket || !fromStatus) return columns

  // Remove from the source column.
  const result: Columns = {
    ...columns,
    [fromStatus]: columns[fromStatus].filter((c) => c.id !== ticketId),
  }

  // Insert into the destination column at a clamped index.
  const dest = [...result[toStatus]]
  const index = Math.max(0, Math.min(toIndex, dest.length))
  dest.splice(index, 0, { ...ticket, status: toStatus })
  result[toStatus] = dest

  return result
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- move`
Expected: PASS, 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/board/move.ts src/lib/board/__tests__/move.test.ts
git commit -m "feat: add pure moveTicketInColumns reorder reducer"
```

---

### Task 3: Move schema and Server Action

**Files:**

- Create: `src/schemas/ticket.ts`, `src/actions/tickets.ts`

**Interfaces:**

- Consumes: `verifySession` (`@/lib/dal/auth`), `prisma` (`@/lib/prisma`).
- Produces: `moveTicketSchema`; `type MoveResult = { ok: true } | { ok: false; error: string }`; `moveTicket(ticketId: string, toStatus: Status, toIndex: number): Promise<MoveResult>`.

- [ ] **Step 1: Create the schema** — `src/schemas/ticket.ts`

```ts
import { z } from 'zod'

export const moveTicketSchema = z.object({
  ticketId: z.string().min(1),
  toStatus: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  toIndex: z.number().int().min(0),
})
```

- [ ] **Step 2: Implement the action** — `src/actions/tickets.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import type { Status } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { verifySession } from '@/lib/dal/auth'
import { moveTicketSchema } from '@/schemas/ticket'

export type MoveResult = { ok: true } | { ok: false; error: string }

export async function moveTicket(
  ticketId: string,
  toStatus: Status,
  toIndex: number,
): Promise<MoveResult> {
  await verifySession()

  const parsed = moveTicketSchema.safeParse({ ticketId, toStatus, toIndex })
  if (!parsed.success) return { ok: false, error: 'Invalid move.' }
  const toStatusVal: Status = parsed.data.toStatus

  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: parsed.data.ticketId },
      select: {
        id: true,
        boardId: true,
        status: true,
        board: { select: { slug: true } },
      },
    })
    if (!ticket) return { ok: false, error: 'Ticket not found.' }
    const fromStatus = ticket.status

    await prisma.$transaction(async (tx) => {
      // Destination column without the moved ticket, in order.
      const dest = await tx.ticket.findMany({
        where: {
          boardId: ticket.boardId,
          status: toStatusVal,
          id: { not: ticket.id },
        },
        orderBy: { position: 'asc' },
        select: { id: true },
      })
      const destIds = dest.map((d) => d.id)
      const index = Math.max(0, Math.min(parsed.data.toIndex, destIds.length))
      destIds.splice(index, 0, ticket.id)

      for (let position = 0; position < destIds.length; position++) {
        await tx.ticket.update({
          where: { id: destIds[position] },
          data: { position, status: toStatusVal },
        })
      }

      // Cross-column move: close the gap in the source column.
      if (fromStatus !== toStatusVal) {
        const source = await tx.ticket.findMany({
          where: { boardId: ticket.boardId, status: fromStatus },
          orderBy: { position: 'asc' },
          select: { id: true },
        })
        for (let position = 0; position < source.length; position++) {
          await tx.ticket.update({
            where: { id: source[position].id },
            data: { position },
          })
        }
      }
    })

    revalidatePath(`/boards/${ticket.board.slug}`)
    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not move the ticket.' }
  }
}
```

- [ ] **Step 3: Verify typecheck** (thin action; covered by typecheck + the reducer tests per spec §9)

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/schemas/ticket.ts src/actions/tickets.ts
git commit -m "feat: add moveTicket action with position-reindexing transaction"
```

---

### Task 4: TicketCard (TDD)

**Files:**

- Test: `src/components/board/__tests__/ticket-card.test.tsx`
- Create: `src/components/board/ticket-card.tsx`

**Interfaces:**

- Consumes: `Avatar`, `Badge` (`@/components/ui/*`), `BoardTicket` (`@/lib/dal/boards`).
- Produces: `TicketCard` (`{ ticket: BoardTicket }`).

- [ ] **Step 1: Write the failing test** — `src/components/board/__tests__/ticket-card.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import type { BoardTicket } from '@/lib/dal/boards'
import { TicketCard } from '../ticket-card'

const ticket = {
  id: 't1',
  key: 'WR-3',
  title: 'Build hero section',
  priority: 'HIGH',
  labels: [{ id: 'l1', name: 'feature', color: '#22c55e' }],
  assignee: { id: 'u1', name: 'Ava Patel', avatarColor: '#f59e0b' },
} as unknown as BoardTicket

test('renders the key, title, label and assignee', () => {
  render(<TicketCard ticket={ticket} />)
  expect(screen.getByText('WR-3')).toBeInTheDocument()
  expect(screen.getByText('Build hero section')).toBeInTheDocument()
  expect(screen.getByText('feature')).toBeInTheDocument()
  expect(screen.getByLabelText('Ava Patel')).toBeInTheDocument()
})

test('renders without an assignee', () => {
  const unassigned = { ...ticket, assignee: null } as unknown as BoardTicket
  render(<TicketCard ticket={unassigned} />)
  expect(screen.getByText('WR-3')).toBeInTheDocument()
  expect(screen.queryByLabelText('Ava Patel')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ticket-card`
Expected: FAIL — cannot find module '../ticket-card'.

- [ ] **Step 3: Implement** — `src/components/board/ticket-card.tsx`

```tsx
import type { BoardTicket } from '@/lib/dal/boards'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const priorityColor: Record<string, string> = {
  LOW: '#64748b',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

export function TicketCard({ ticket }: { ticket: BoardTicket }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {ticket.key}
        </span>
        <Badge color={priorityColor[ticket.priority]}>{ticket.priority}</Badge>
      </div>
      <p className="text-sm text-gray-900 dark:text-gray-100">{ticket.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {ticket.labels.map((label) => (
            <Badge key={label.id} color={label.color}>
              {label.name}
            </Badge>
          ))}
        </div>
        {ticket.assignee && (
          <Avatar
            name={ticket.assignee.name}
            color={ticket.assignee.avatarColor}
            size="sm"
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ticket-card`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/ticket-card.tsx src/components/board/__tests__/ticket-card.test.tsx
git commit -m "feat: add TicketCard"
```

---

### Task 5: StrictModeDroppable and Column

**Files:**

- Create: `src/components/board/strict-mode-droppable.tsx`, `src/components/board/column.tsx`

**Interfaces:**

- Consumes: `Droppable`/`Draggable` (`@hello-pangea/dnd`), `TicketCard`, `BoardTicket`, `Status`.
- Produces: `StrictModeDroppable` (drop-in for `Droppable`); `Column` (`{ status: Status; tickets: BoardTicket[] }`).

- [ ] **Step 1: Implement `StrictModeDroppable`** — `src/components/board/strict-mode-droppable.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Droppable, type DroppableProps } from '@hello-pangea/dnd'

export function StrictModeDroppable({ children, ...props }: DroppableProps) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEnabled(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!enabled) return null
  return <Droppable {...props}>{children}</Droppable>
}
```

> The `setEnabled(true)` runs inside `requestAnimationFrame` (deferred), so the `react-hooks/set-state-in-effect` rule should not flag it. If `npm run lint` does flag it, add `// eslint-disable-next-line react-hooks/set-state-in-effect` above the `setEnabled` call (as done for the next-themes mount guard in `ThemeToggle`).

- [ ] **Step 2: Implement `Column`** — `src/components/board/column.tsx`

```tsx
'use client'

import { Draggable } from '@hello-pangea/dnd'
import type { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'
import { StrictModeDroppable } from './strict-mode-droppable'
import { TicketCard } from './ticket-card'

const titles: Record<Status, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
}

export function Column({
  status,
  tickets,
}: {
  status: Status
  tickets: BoardTicket[]
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-gray-100 p-3 dark:bg-gray-900/40">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {titles[status]}
        <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-400">
          {tickets.length}
        </span>
      </h2>
      <StrictModeDroppable droppableId={status}>
        {(provided) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="flex min-h-8 flex-1 flex-col gap-2"
          >
            {tickets.map((ticket, index) => (
              <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                {(prov) => (
                  <div
                    ref={prov.innerRef}
                    {...prov.draggableProps}
                    {...prov.dragHandleProps}
                  >
                    <TicketCard ticket={ticket} />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </div>
        )}
      </StrictModeDroppable>
    </div>
  )
}
```

- [ ] **Step 3: Verify typecheck** (these render only inside `DragDropContext`, so they're covered by typecheck + the `BoardView` integration; no isolated unit test)

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/board/strict-mode-droppable.tsx src/components/board/column.tsx
git commit -m "feat: add StrictModeDroppable and Column"
```

---

### Task 6: BoardView (optimistic drag-and-drop)

**Files:**

- Create: `src/components/board/board-view.tsx`

**Interfaces:**

- Consumes: `useOptimistic`/`useTransition` (react), `DragDropContext`/`DropResult` (`@hello-pangea/dnd`), `toast` (sonner), `Status`, `BoardWithTickets`, `Columns`+`moveTicketInColumns` (`@/lib/board/move`), `moveTicket` (`@/actions/tickets`), `Column`.
- Produces: `BoardView` (`{ board: BoardWithTickets }`).

- [ ] **Step 1: Implement** — `src/components/board/board-view.tsx`

```tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { DragDropContext, type DropResult } from '@hello-pangea/dnd'
import { toast } from 'sonner'
import { Status } from '@prisma/client'
import type { BoardWithTickets } from '@/lib/dal/boards'
import { moveTicketInColumns, type Columns } from '@/lib/board/move'
import { moveTicket } from '@/actions/tickets'
import { Column } from './column'

const ORDER: Status[] = [Status.TODO, Status.IN_PROGRESS, Status.DONE]

export function BoardView({ board }: { board: BoardWithTickets }) {
  const [, startTransition] = useTransition()
  const [columns, setOptimistic] = useOptimistic(
    board.columns,
    (_current: Columns, next: Columns) => next,
  )

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const toStatus = destination.droppableId as Status
    const toIndex = destination.index
    const next = moveTicketInColumns(columns, {
      ticketId: draggableId,
      toStatus,
      toIndex,
    })

    startTransition(async () => {
      setOptimistic(next)
      const res = await moveTicket(draggableId, toStatus, toIndex)
      if (!res.ok) toast.error('Move failed — reverted')
    })
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        {board.name}
      </h1>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ORDER.map((status) => (
            <Column key={status} status={status} tickets={columns[status]} />
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/board/board-view.tsx
git commit -m "feat: add optimistic BoardView with drag-and-drop"
```

---

### Task 7: Board list and board detail pages

**Files:**

- Modify: `src/app/(app)/boards/page.tsx`
- Create: `src/app/(app)/boards/[slug]/page.tsx`

**Interfaces:**

- Consumes: `getBoards`, `getBoardWithTickets` (`@/lib/dal/boards`), `BoardView`, `notFound` (`next/navigation`).

- [ ] **Step 1: Replace the board list page** — `src/app/(app)/boards/page.tsx`

```tsx
import Link from 'next/link'
import { getBoards } from '@/lib/dal/boards'

export default async function BoardsPage() {
  const boards = await getBoards()

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Boards
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.slug}`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {board.prefix}
              </span>
              <h2 className="font-medium text-gray-900 dark:text-gray-100">
                {board.name}
              </h2>
            </div>
            {board.description && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {board.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the board detail page** — `src/app/(app)/boards/[slug]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { getBoardWithTickets } from '@/lib/dal/boards'
import { BoardView } from '@/components/board/board-view'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const board = await getBoardWithTickets(slug)
  if (!board) notFound()

  return <BoardView board={board} />
}
```

- [ ] **Step 3: Verify**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0; build lists `/boards` and `/boards/[slug]` routes.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/boards/page.tsx" "src/app/(app)/boards/[slug]/page.tsx"
git commit -m "feat: add board list and Kanban board pages"
```

---

### Task 8: Full gate and manual smoke test

**Files:** none (verification).

- [ ] **Step 1: Full gate**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run build-storybook
```

Expected: all exit 0. (`format:check` flags only the git-ignored `.superpowers/` scratch dir locally — confirm no tracked file is flagged; run `npm run format` if any source file is.)

- [ ] **Step 2: Manual smoke test**

```bash
npm run db:up && npx prisma migrate deploy && npx prisma db seed
npm run dev
```

- Log in (`demo@example.com` / `demo1234`) → `/boards` lists the seeded boards (Website Redesign, Mobile App, Marketing).
- Open a board → tickets appear in the correct columns (e.g. Website Redesign: To Do 4, In Progress 2, Done 2).
- Drag a ticket to another column → it moves instantly; **reload** → the move persisted.
- Drag within a column to reorder → persists on reload.

Stop the dev server. If anything fails, STOP and report.

- [ ] **Step 3: Commit** (only if the gate required a formatting fixup; otherwise nothing to commit)

```bash
git status --short
```

---

## Done Criteria (Phase 5)

- `lint`, `format:check`, `typecheck`, `test`, `build`, `build-storybook` all green.
- `/boards` lists boards; `/boards/[slug]` shows tickets in the right columns/order.
- Dragging a ticket moves it instantly, persists across reload, and a failed move reverts with a toast.
- `moveTicketInColumns` is exhaustively unit-tested; no component imports Prisma; `moveTicket` re-checks the session.

**Next plan:** Phase 6 (ticket create/edit forms + the intercepting-route detail modal consuming the `Modal` primitive).

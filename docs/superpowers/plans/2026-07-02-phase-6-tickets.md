# Phase 6: Ticket Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create tickets (auto-keyed), edit them (title/description/status/priority/assignee/epic/labels), and open a ticket as a modal overlay on click (URL updates, board behind) or a full page on direct visit/refresh, via Next 16 parallel + intercepting routes.

**Architecture:** All Prisma stays in `lib/dal/tickets.ts` (reads + create/update, with an atomic `ticketCounter` transaction for keys). `createTicket`/`updateTicket` Server Actions parse `FormData` with a shared `ticketFormSchema` and revalidate. Create uses a client `Modal`; the detail uses a `@modal` parallel slot + a `(.)[ticketKey]` intercepted route, with a `[ticketKey]/page.tsx` full-page fallback and a mandatory `@modal/default.tsx`.

**Tech Stack:** Next.js 16 (parallel/intercepting routes), React 19, Prisma, Zod 4, Jest.

**Spec:** `docs/superpowers/specs/2026-07-02-phase-6-tickets-design.md`.

## Global Constraints

- **Next 16 requires `default.tsx` for parallel slots at build time** — `@modal/default.tsx` MUST exist and return `null`; if `npm run build` complains the `children` slot needs one, add `src/app/(app)/boards/[slug]/default.tsx`. Interception matcher is **`(.)`** (a `@slot` isn't a route segment): `@modal/(.)[ticketKey]/page.tsx`. Route `params` is a Promise — `await params`.
- The modal closes via `useRouter().back()` (`next/navigation`) in a `'use client'` wrapper.
- All Prisma access lives in `lib/dal/` (relative imports there); `dal/tickets.ts` is consumed by a `tsx` script, so use relative imports (`../prisma`, `../ticket-key`, and `import type` for schema types). App/component code uses `@/`.
- Every Server Action calls `verifySession()` first, Zod-validates, and returns a typed result. Keys are unique via an atomic `ticketCounter: { increment: 1 }` in a `$transaction`.
- `components/` never imports Prisma. Prettier: single quotes, no semicolons, 2-space.

---

### Task 1: DAL — ticket reads and create/update persistence

**Files:**

- Modify: `src/lib/dal/tickets.ts`

**Interfaces:**

- Consumes: `prisma` (`../prisma`), `formatTicketKey` (`../ticket-key`), `TicketFormInput` (`../../schemas/ticket`, type-only — defined in Task 2; write Task 2's schema first if implementing in order, or use the shape `{ title; description?; status; priority; assigneeId; epicId; labelIds }`).
- Produces:
  - `getTicketByKey(slug: string, key: string)` → the ticket with `assignee`/`reporter`/`epic`/`labels` and `board { id, slug, name, prefix }`, or `null`. Export `type TicketWithRelations = NonNullable<Awaited<ReturnType<typeof getTicketByKey>>>`.
  - `getTicketFormOptions(slug: string)` → `{ users; epics; labels } | null`.
  - `createTicketRecord(boardId, reporterId, input): Promise<{ key: string; slug: string } | null>`.
  - `updateTicketRecord(ticketId, input): Promise<{ slug: string } | null>`.

- [ ] **Step 1: Append the four functions** — `src/lib/dal/tickets.ts` (keep the existing `moveTicketPositions`)

```ts
import type { TicketFormInput } from '../../schemas/ticket'
import { formatTicketKey } from '../ticket-key'
// (existing imports: Status from '@prisma/client', prisma from '../prisma')

export async function getTicketByKey(slug: string, key: string) {
  return prisma.ticket.findFirst({
    where: { key, board: { slug } },
    include: {
      assignee: { select: { id: true, name: true, avatarColor: true } },
      reporter: { select: { id: true, name: true, avatarColor: true } },
      epic: true,
      labels: true,
      board: { select: { id: true, slug: true, name: true, prefix: true } },
    },
  })
}

export type TicketWithRelations = NonNullable<
  Awaited<ReturnType<typeof getTicketByKey>>
>

export async function getTicketFormOptions(slug: string) {
  const board = await prisma.board.findUnique({
    where: { slug },
    select: {
      id: true,
      epics: { select: { id: true, name: true, color: true } },
    },
  })
  if (!board) return null
  const [users, labels] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, avatarColor: true },
    }),
    prisma.label.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ])
  return { users, epics: board.epics, labels }
}

export type TicketFormOptions = NonNullable<
  Awaited<ReturnType<typeof getTicketFormOptions>>
>

export async function createTicketRecord(
  boardId: string,
  reporterId: string,
  input: TicketFormInput,
): Promise<{ key: string; slug: string } | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const board = await tx.board.update({
        where: { id: boardId },
        data: { ticketCounter: { increment: 1 } },
        select: { prefix: true, slug: true, ticketCounter: true },
      })
      const key = formatTicketKey(board.prefix, board.ticketCounter)
      const position = await tx.ticket.count({
        where: { boardId, status: input.status },
      })
      await tx.ticket.create({
        data: {
          key,
          title: input.title,
          description: input.description,
          status: input.status,
          priority: input.priority,
          position,
          boardId,
          reporterId,
          assigneeId: input.assigneeId,
          epicId: input.epicId,
          labels: { connect: input.labelIds.map((id) => ({ id })) },
        },
      })
      return { key, slug: board.slug }
    })
  } catch {
    return null
  }
}

export async function updateTicketRecord(
  ticketId: string,
  input: TicketFormInput,
): Promise<{ slug: string } | null> {
  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { status: true, boardId: true, board: { select: { slug: true } } },
  })
  if (!current) return null

  // If the edit moves the ticket to a different column, append it there.
  const position =
    input.status !== current.status
      ? await prisma.ticket.count({
          where: { boardId: current.boardId, status: input.status },
        })
      : undefined

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      title: input.title,
      description: input.description,
      status: input.status,
      priority: input.priority,
      ...(position !== undefined ? { position } : {}),
      assigneeId: input.assigneeId,
      epicId: input.epicId,
      labels: { set: input.labelIds.map((id) => ({ id })) },
    },
  })
  return { slug: current.board.slug }
}
```

- [ ] **Step 2: Verify** (Task 2's schema must exist for the type import; if doing Task 1 first, temporarily inline the input type, then swap to the import after Task 2)

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/dal/tickets.ts
git commit -m "feat: add ticket read + create/update DAL with atomic key generation"
```

---

### Task 2: Ticket form schema (TDD)

**Files:**

- Test: `src/schemas/__tests__/ticket.test.ts`
- Modify: `src/schemas/ticket.ts`

**Interfaces:**

- Produces: `ticketFormSchema`; `type TicketFormInput = z.infer<typeof ticketFormSchema>`.

- [ ] **Step 1: Write the failing test** — `src/schemas/__tests__/ticket.test.ts`

```ts
import { ticketFormSchema } from '../ticket'

const valid = {
  title: 'Build the thing',
  description: 'details',
  status: 'TODO',
  priority: 'HIGH',
  assigneeId: null,
  epicId: null,
  labelIds: [],
}

test('accepts a valid ticket', () => {
  expect(ticketFormSchema.safeParse(valid).success).toBe(true)
})

test('rejects an empty title', () => {
  const result = ticketFormSchema.safeParse({ ...valid, title: '' })
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.flatten().fieldErrors.title).toContain(
      'Title is required.',
    )
  }
})

test('accepts a null assignee and epic and a list of label ids', () => {
  const result = ticketFormSchema.safeParse({
    ...valid,
    assigneeId: 'u1',
    epicId: null,
    labelIds: ['l1', 'l2'],
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.labelIds).toEqual(['l1', 'l2'])
  }
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- schemas/__tests__/ticket`
Expected: FAIL — `ticketFormSchema` is not exported.

- [ ] **Step 3: Implement** — append to `src/schemas/ticket.ts` (keep `moveTicketSchema`)

```ts
export const ticketFormSchema = z.object({
  title: z.string().min(1, { error: 'Title is required.' }),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  assigneeId: z.string().nullable(),
  epicId: z.string().nullable(),
  labelIds: z.array(z.string()),
})

export type TicketFormInput = z.infer<typeof ticketFormSchema>
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- schemas/__tests__/ticket`
Expected: PASS, 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/ticket.ts src/schemas/__tests__/ticket.test.ts
git commit -m "feat: add ticket form schema"
```

---

### Task 3: create/update Server Actions

**Files:**

- Modify: `src/actions/tickets.ts`

**Interfaces:**

- Consumes: `verifySession` (`@/lib/dal/auth`), `createTicketRecord`/`updateTicketRecord` (`@/lib/dal/tickets`), `ticketFormSchema` (`@/schemas/ticket`).
- Produces: `type TicketFormState`; `createTicket(boardId, prevState, formData)`; `updateTicket(ticketId, prevState, formData)`.

- [ ] **Step 1: Append the actions** — `src/actions/tickets.ts` (keep `moveTicket`)

```ts
import { createTicketRecord, updateTicketRecord } from '@/lib/dal/tickets'
import { ticketFormSchema } from '@/schemas/ticket'
// existing: 'use server', revalidatePath, Status, verifySession, moveTicketSchema, moveTicketPositions

export type TicketFormState =
  | { ok?: boolean; error?: string; fieldErrors?: Record<string, string[]> }
  | undefined

function parseForm(formData: FormData) {
  return ticketFormSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    status: formData.get('status'),
    priority: formData.get('priority'),
    assigneeId: formData.get('assigneeId') || null,
    epicId: formData.get('epicId') || null,
    labelIds: formData.getAll('labelIds'),
  })
}

export async function createTicket(
  boardId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  const session = await verifySession()
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const result = await createTicketRecord(
      boardId,
      session.userId,
      parsed.data,
    )
    if (!result) return { error: 'Could not create the ticket.' }
    revalidatePath(`/boards/${result.slug}`)
    return { ok: true }
  } catch {
    return { error: 'Could not create the ticket.' }
  }
}

export async function updateTicket(
  ticketId: string,
  _prev: TicketFormState,
  formData: FormData,
): Promise<TicketFormState> {
  await verifySession()
  const parsed = parseForm(formData)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }
  try {
    const result = await updateTicketRecord(ticketId, parsed.data)
    if (!result) return { error: 'Ticket not found.' }
    revalidatePath(`/boards/${result.slug}`)
    return { ok: true }
  } catch {
    return { error: 'Could not save the ticket.' }
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/actions/tickets.ts
git commit -m "feat: add createTicket and updateTicket actions"
```

---

### Task 4: TicketForm (TDD)

**Files:**

- Test: `src/components/tickets/__tests__/ticket-form.test.tsx`
- Create: `src/components/tickets/ticket-form.tsx`

**Interfaces:**

- Consumes: `useActionState` (react), `TicketFormState` (`@/actions/tickets`), `TicketFormOptions` (`@/lib/dal/tickets`), `Button` (`@/components/ui/button`).
- Produces: `TicketForm` (`'use client'`) — props `action`, `options: TicketFormOptions`, `defaultValues?`, `onSuccess?`, `submitLabel`.

- [ ] **Step 1: Write the failing test** — `src/components/tickets/__tests__/ticket-form.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketForm } from '../ticket-form'

const options = {
  users: [{ id: 'u1', name: 'Ava Patel', avatarColor: '#f59e0b' }],
  epics: [{ id: 'e1', name: 'Landing page', color: '#6366f1' }],
  labels: [{ id: 'l1', name: 'bug', color: '#ef4444' }],
}

test('renders the title field and a submit button', () => {
  render(
    <TicketForm
      action={jest.fn(async () => undefined)}
      options={options}
      submitLabel="Create"
    />,
  )
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
})

test('shows a field error returned by the action', async () => {
  const user = userEvent.setup()
  const action = jest.fn(async () => ({
    fieldErrors: { title: ['Title is required.'] },
  }))
  render(<TicketForm action={action} options={options} submitLabel="Create" />)
  await user.click(screen.getByRole('button', { name: /create/i }))
  expect(await screen.findByText('Title is required.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ticket-form`
Expected: FAIL — cannot find module '../ticket-form'.

- [ ] **Step 3: Implement** — `src/components/tickets/ticket-form.tsx`

```tsx
'use client'

import { useActionState, useEffect } from 'react'
import type { TicketFormState } from '@/actions/tickets'
import type { TicketFormOptions } from '@/lib/dal/tickets'
import { Button } from '@/components/ui/button'

type Action = (
  state: TicketFormState,
  formData: FormData,
) => Promise<TicketFormState>

export type TicketFormDefaults = {
  title: string
  description: string
  status: string
  priority: string
  assigneeId: string
  epicId: string
  labelIds: string[]
}

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

const field =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800'
const labelCls =
  'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'

export function TicketForm({
  action,
  options,
  defaultValues,
  onSuccess,
  submitLabel,
}: {
  action: Action
  options: TicketFormOptions
  defaultValues?: TicketFormDefaults
  onSuccess?: () => void
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState<
    TicketFormState,
    FormData
  >(action, undefined)
  const d = defaultValues

  useEffect(() => {
    if (state?.ok) onSuccess?.()
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className={labelCls}>
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={d?.title}
          className={field}
        />
        {state?.fieldErrors?.title && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={d?.description}
          className={field}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="status" className={labelCls}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={d?.status ?? 'TODO'}
            className={field}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="priority" className={labelCls}>
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={d?.priority ?? 'MEDIUM'}
            className={field}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="assigneeId" className={labelCls}>
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={d?.assigneeId ?? ''}
            className={field}
          >
            <option value="">Unassigned</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="epicId" className={labelCls}>
            Epic
          </label>
          <select
            id="epicId"
            name="epicId"
            defaultValue={d?.epicId ?? ''}
            className={field}
          >
            <option value="">None</option>
            {options.epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelCls}>Labels</legend>
        <div className="flex flex-wrap gap-3">
          {options.labels.map((label) => (
            <label key={label.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="labelIds"
                value={label.id}
                defaultChecked={d?.labelIds.includes(label.id)}
              />
              {label.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- ticket-form`
Expected: PASS, 2 passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/tickets/ticket-form.tsx src/components/tickets/__tests__/ticket-form.test.tsx
git commit -m "feat: add TicketForm"
```

---

### Task 5: TicketDetail, TicketModal, NewTicketButton

**Files:**

- Create: `src/components/tickets/ticket-detail.tsx`, `src/components/tickets/ticket-modal.tsx`, `src/components/tickets/new-ticket-button.tsx`

**Interfaces:**

- Consumes: `TicketWithRelations`, `TicketFormOptions` (`@/lib/dal/tickets`); `updateTicket`, `createTicket` (`@/actions/tickets`); `TicketForm`; `Modal`, `Button`, `Avatar`, `Badge` (`@/components/ui/*`); `useRouter` (`next/navigation`).
- Produces: `TicketDetail` (`{ ticket, options }`), `TicketModal` (`{ children }`), `NewTicketButton` (`{ boardId, options }`).

- [ ] **Step 1: Implement `TicketModal`** — `src/components/tickets/ticket-modal.tsx`

```tsx
'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'

export function TicketModal({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <Modal open onClose={() => router.back()}>
      {children}
    </Modal>
  )
}
```

- [ ] **Step 2: Implement `TicketDetail`** — `src/components/tickets/ticket-detail.tsx`

```tsx
'use client'

import { useState } from 'react'
import { updateTicket } from '@/actions/tickets'
import type { TicketFormOptions, TicketWithRelations } from '@/lib/dal/tickets'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TicketForm } from './ticket-form'

export function TicketDetail({
  ticket,
  options,
}: {
  ticket: TicketWithRelations
  options: TicketFormOptions
}) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <TicketForm
        action={updateTicket.bind(null, ticket.id)}
        options={options}
        submitLabel="Save"
        onSuccess={() => setEditing(false)}
        defaultValues={{
          title: ticket.title,
          description: ticket.description ?? '',
          status: ticket.status,
          priority: ticket.priority,
          assigneeId: ticket.assigneeId ?? '',
          epicId: ticket.epicId ?? '',
          labelIds: ticket.labels.map((l) => l.id),
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {ticket.key}
        </span>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {ticket.title}
      </h2>
      {ticket.description && (
        <p className="text-sm whitespace-pre-wrap text-gray-600 dark:text-gray-300">
          {ticket.description}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{ticket.status}</Badge>
        <Badge>{ticket.priority}</Badge>
        {ticket.epic && (
          <Badge color={ticket.epic.color}>{ticket.epic.name}</Badge>
        )}
        {ticket.labels.map((l) => (
          <Badge key={l.id} color={l.color}>
            {l.name}
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-300">
        <span className="flex items-center gap-2">
          Assignee:
          {ticket.assignee ? (
            <>
              <Avatar
                name={ticket.assignee.name}
                color={ticket.assignee.avatarColor}
                size="sm"
              />
              {ticket.assignee.name}
            </>
          ) : (
            'Unassigned'
          )}
        </span>
        <span>Reporter: {ticket.reporter.name}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement `NewTicketButton`** — `src/components/tickets/new-ticket-button.tsx`

```tsx
'use client'

import { useState } from 'react'
import { createTicket } from '@/actions/tickets'
import type { TicketFormOptions } from '@/lib/dal/tickets'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { TicketForm } from './ticket-form'

export function NewTicketButton({
  boardId,
  options,
}: {
  boardId: string
  options: TicketFormOptions
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>New ticket</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New ticket">
        <TicketForm
          action={createTicket.bind(null, boardId)}
          options={options}
          submitLabel="Create"
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
```

- [ ] **Step 4: Verify typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/tickets/ticket-detail.tsx src/components/tickets/ticket-modal.tsx src/components/tickets/new-ticket-button.tsx
git commit -m "feat: add TicketDetail, TicketModal and NewTicketButton"
```

---

### Task 6: Make ticket cards clickable

**Files:**

- Modify: `src/components/board/ticket-card.tsx`, `src/components/board/column.tsx`, `src/components/board/board-view.tsx`

**Interfaces:**

- Produces: `TicketCard` and `Column` gain a `slug: string` prop; `TicketCard` wraps its body in a `<Link>` to `/boards/[slug]/[key]`.

- [ ] **Step 1: Make `TicketCard` a link** — `src/components/board/ticket-card.tsx`

Add `import Link from 'next/link'`, add `slug` to the props, and wrap the existing card `<div>` in a `<Link>`:

```tsx
import Link from 'next/link'
import type { BoardTicket } from '@/lib/dal/boards'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

const priorityColor: Record<string, string> = {
  LOW: '#64748b',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

export function TicketCard({
  ticket,
  slug,
}: {
  ticket: BoardTicket
  slug: string
}) {
  return (
    <Link
      href={`/boards/${slug}/${ticket.key}`}
      className="block rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:border-indigo-400 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-indigo-500"
    >
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
    </Link>
  )
}
```

Update the existing test `src/components/board/__tests__/ticket-card.test.tsx` to pass `slug="website-redesign"` in both `render(<TicketCard ticket={...} slug="website-redesign" />)` calls (add the prop; the assertions are unchanged).

- [ ] **Step 2: Thread `slug` through `Column`** — `src/components/board/column.tsx`

Add `slug: string` to the props and pass it to `TicketCard`:

```tsx
export function Column({
  status,
  tickets,
  slug,
}: {
  status: Status
  tickets: BoardTicket[]
  slug: string
}) {
  // ...unchanged until the TicketCard render:
  //   <TicketCard ticket={ticket} slug={slug} />
}
```

Change the `<TicketCard ticket={ticket} />` line to `<TicketCard ticket={ticket} slug={slug} />`.

- [ ] **Step 3: Pass `slug` from `BoardView`** — `src/components/board/board-view.tsx`

Change the `Column` render to pass the slug:

```tsx
{
  ORDER.map((status) => (
    <Column
      key={status}
      status={status}
      tickets={columns[status]}
      slug={board.slug}
    />
  ))
}
```

- [ ] **Step 4: Verify**

```bash
npm run typecheck && npm test -- ticket-card
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/board/ticket-card.tsx src/components/board/column.tsx src/components/board/board-view.tsx src/components/board/__tests__/ticket-card.test.tsx
git commit -m "feat: link ticket cards to the ticket detail route"
```

---

### Task 7: Routes — modal slot, intercepted route, full page

**Files:**

- Create: `src/app/(app)/boards/[slug]/layout.tsx`, `src/app/(app)/boards/[slug]/@modal/default.tsx`, `src/app/(app)/boards/[slug]/@modal/(.)[ticketKey]/page.tsx`, `src/app/(app)/boards/[slug]/[ticketKey]/page.tsx`
- Modify: `src/app/(app)/boards/[slug]/page.tsx` (add the New-ticket button)

**Interfaces:**

- Consumes: `getTicketByKey`, `getTicketFormOptions`, `getBoardWithTickets` (`@/lib/dal/*`); `TicketDetail`, `TicketModal`, `NewTicketButton`; `notFound` (`next/navigation`).

- [ ] **Step 1: Board layout with the `@modal` slot** — `src/app/(app)/boards/[slug]/layout.tsx`

```tsx
export default function BoardLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
```

- [ ] **Step 2: The required modal-slot default** — `src/app/(app)/boards/[slug]/@modal/default.tsx`

```tsx
export default function Default() {
  return null
}
```

- [ ] **Step 3: A shared detail loader** — reuse in both routes. Create the full-page route `src/app/(app)/boards/[slug]/[ticketKey]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { getTicketByKey, getTicketFormOptions } from '@/lib/dal/tickets'
import { TicketDetail } from '@/components/tickets/ticket-detail'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ slug: string; ticketKey: string }>
}) {
  const { slug, ticketKey } = await params
  const [ticket, options] = await Promise.all([
    getTicketByKey(slug, ticketKey),
    getTicketFormOptions(slug),
  ])
  if (!ticket || !options) notFound()

  return (
    <div className="mx-auto max-w-2xl p-6">
      <TicketDetail ticket={ticket} options={options} />
    </div>
  )
}
```

- [ ] **Step 4: The intercepted modal route** — `src/app/(app)/boards/[slug]/@modal/(.)[ticketKey]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { getTicketByKey, getTicketFormOptions } from '@/lib/dal/tickets'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { TicketModal } from '@/components/tickets/ticket-modal'

export default async function TicketModalPage({
  params,
}: {
  params: Promise<{ slug: string; ticketKey: string }>
}) {
  const { slug, ticketKey } = await params
  const [ticket, options] = await Promise.all([
    getTicketByKey(slug, ticketKey),
    getTicketFormOptions(slug),
  ])
  if (!ticket || !options) notFound()

  return (
    <TicketModal>
      <TicketDetail ticket={ticket} options={options} />
    </TicketModal>
  )
}
```

- [ ] **Step 5: Add the New-ticket button to the board page** — `src/app/(app)/boards/[slug]/page.tsx`

```tsx
import { notFound } from 'next/navigation'
import { getBoardWithTickets } from '@/lib/dal/boards'
import { getTicketFormOptions } from '@/lib/dal/tickets'
import { NewTicketButton } from '@/components/tickets/new-ticket-button'
import { BoardView } from '@/components/board/board-view'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const board = await getBoardWithTickets(slug)
  if (!board) notFound()
  const options = await getTicketFormOptions(slug)

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {board.name}
        </h1>
        {options && <NewTicketButton boardId={board.id} options={options} />}
      </div>
      <BoardView board={board} />
    </div>
  )
}
```

Then remove the now-duplicated title/wrapper from `BoardView` — `src/components/board/board-view.tsx`: change the outer `<div className="p-6">` + `<h1>{board.name}</h1>` so `BoardView` renders only the drag context (the page now owns the header):

```tsx
return (
  <DragDropContext onDragEnd={onDragEnd}>
    <div className="flex flex-1 gap-4 overflow-x-auto pb-4">
      {ORDER.map((status) => (
        <Column
          key={status}
          status={status}
          tickets={columns[status]}
          slug={board.slug}
        />
      ))}
    </div>
  </DragDropContext>
)
```

- [ ] **Step 6: Verify the build handles the parallel slot**

```bash
npm run typecheck && npm run build
```

Expected: exits 0. **If the build fails demanding a `default.js` for the `children` slot**, create `src/app/(app)/boards/[slug]/default.tsx`:

```tsx
import { notFound } from 'next/navigation'

export default function Default() {
  notFound()
}
```

and rebuild. (This renders only on an unrecoverable `children` state, which shouldn't happen in normal use.)

- [ ] **Step 7: Commit**

```bash
git add "src/app/(app)/boards/[slug]" src/components/board/board-view.tsx
git commit -m "feat: add ticket detail full-page and intercepting-route modal"
```

---

### Task 8: Full gate and manual smoke test

**Files:** none (verification).

- [ ] **Step 1: Full gate**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run build-storybook
```

Expected: all exit 0. (`format:check` flags only the git-ignored `.superpowers/` dir locally.)

- [ ] **Step 2: Manual smoke test**

```bash
npm run db:up && npx prisma migrate deploy && npx prisma db seed
npm run dev
```

- Log in → open a board → click **New ticket**, fill the title, Create → the ticket appears with the next key (e.g. `WR-9`).
- Click a ticket card → a modal opens over the board, URL becomes `/boards/[slug]/[key]`. Press browser Back → modal closes, board intact.
- Refresh the `/boards/[slug]/[key]` URL directly → the full standalone page renders (no modal).
- In the detail, click **Edit**, change the title/status/assignee, Save → the change persists on the board.

Stop the dev server. If anything fails, STOP and report.

---

## Done Criteria (Phase 6)

- `lint`, `format:check`, `typecheck`, `test`, `build`, `build-storybook` all green (the build proves the `@modal` slot + `default.tsx`).
- Creating a ticket assigns the next per-board key and shows it on the board.
- Clicking a ticket opens a modal (URL updates, board behind); refresh shows the full page; Back closes the modal.
- Editing persists title/description/status/priority/assignee/epic/labels.
- No component imports Prisma; every action re-checks the session; keys stay unique via the atomic counter.

**Next plan:** Phase 7 (comments thread; label/epic management), then Phase 8 (Vercel deploy).

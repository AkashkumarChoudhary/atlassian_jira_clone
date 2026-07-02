# Phase 6: Ticket Management — Design Spec

**Date:** 2026-07-02
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-13-jira-kanban-design.md` (§4 keys, §5 routing/intercepting, §7 error handling, §9 testing)
**Builds on:** Phases 1–5 (schema/seed/DAL, auth, shell + UI primitives incl. `Modal`, Kanban board).

## 1. Purpose

Let users create, edit, and inspect tickets. Creating a ticket auto-generates its key (`WR-9`, …) via an atomic counter. Opening a ticket shows a **modal overlay** when clicked from the board (board visible behind, URL updates to `/boards/[slug]/[ticketKey]`), and a **full standalone page** on direct visit or refresh — using Next 16 parallel + intercepting routes. Ends demoable.

## 2. Platform reality (Next 16 intercepting/parallel routes)

Verified against the bundled docs:

- A **parallel-route slot** `@modal` is passed to `[slug]/layout.tsx` as a prop alongside `children`.
- **`default.tsx` is mandatory at build time in Next 16** — "Builds will fail without them" (hard break from 15). `@modal/default.tsx` must exist and return `null`. The `children` slot may also need a `default.tsx`; confirm via `npm run build` and add `[slug]/default.tsx` if the build demands it.
- **Interception matcher is `(.)`**: a `@slot` is not a route segment, so `[ticketKey]` sits at the same segment level — the intercepted route is `@modal/(.)[ticketKey]/page.tsx`.
- The modal closes with `useRouter().back()` (`next/navigation`) from a `'use client'` wrapper.
- Route `params` is a `Promise` (`const { slug, ticketKey } = await params`).

## 3. Scope

**In scope:**

- Create a ticket (auto-keyed) via a `Modal`-hosted form opened by a "New ticket" button.
- Edit a ticket (title, description, status, priority, assignee, epic, labels).
- Ticket detail: full-page route + intercepting-route modal overlay.
- Assignment (assignee select), epic select, label multi-select.

**Deferred:** comments (Phase 7); label/epic _management_ CRUD (Phase 7 — this phase only assigns from existing labels/epics); deploy (Phase 8). Deleting tickets is out of scope. Create uses a client `Modal` (no route); only the _detail_ uses the intercepting route.

## 4. Components & interfaces

### 4.1 DAL (`src/lib/dal/tickets.ts`, `boards.ts`) — relative imports

- `getTicketByKey(slug: string, key: string)` → the ticket with `assignee`/`reporter`/`epic`/`labels` and its `board { id, slug, name, prefix }`, or `null`. (New in `boards.ts` or `tickets.ts`.)
- `getTicketFormOptions(slug: string)` → `{ users: {id,name,avatarColor}[]; epics: {id,name,color}[]; labels: {id,name,color}[] }` — assignable users (all), the board's epics, and all labels. `null` if the board is missing.
- `createTicketRecord(boardId, input)` → `{ key: string }`: in a `$transaction`, atomically `board.update({ ticketCounter: { increment: 1 } })` to get the new counter, compute `key = formatTicketKey(board.prefix, counter)`, set `position` = count of tickets already in the target `status` column, create the ticket (reporter = the acting user), `connect` labels.
- `updateTicketRecord(ticketId, input)` → updates fields + re-`set`s labels; returns `{ slug }` for revalidation.
- Existing: `getUsers` (Phase 2), `moveTicketPositions` (Phase 5), `formatTicketKey`/`deriveBoardPrefix` (Phase 1).

### 4.2 Schema (`src/schemas/ticket.ts`)

Add `ticketFormSchema` (shared by create + edit):

- `title: z.string().min(1)`, `description: z.string().optional()`, `status: z.enum(['TODO','IN_PROGRESS','DONE'])`, `priority: z.enum(['LOW','MEDIUM','HIGH','URGENT'])`, `assigneeId: z.string().nullable()` (empty select → `null`), `epicId: z.string().nullable()`, `labelIds: z.array(z.string())`.
- `type TicketFormInput = z.infer<typeof ticketFormSchema>`.

### 4.3 Actions (`src/actions/tickets.ts`, `'use server'`)

- `type TicketFormState = { error?: string; fieldErrors?: Record<string,string[]> } | undefined`.
- `createTicket(boardId: string, prevState, formData): Promise<TicketFormState>` — `verifySession()` → parse `formData` with `ticketFormSchema` → `createTicketRecord` (reporter = session user) → `revalidatePath(board)` → `redirect` is NOT used (form stays); return `{}` on success (the client closes the modal). On validation failure return `{ fieldErrors }`.
- `updateTicket(ticketId, prevState, formData)` — same shape; `updateTicketRecord` → revalidate.
- Both return typed results for `useActionState`; `verifySession()` first. (`moveTicket` stays.)

### 4.4 Components (`src/components/tickets/`)

- **`TicketForm`** (`'use client'`): `useActionState`-driven form. Inputs: title, description (textarea), status + priority (selects), assignee (select of users, "Unassigned" → empty), epic (select, "None" → empty), labels (checkbox group). Renders field errors. Props: `mode: 'create' | 'edit'`, `action` (the bound server action), `options` (users/epics/labels), `defaultValues?` (for edit), `onSuccess?` (to close the modal).
- **`TicketDetail`** (`'use client'` — holds the read↔edit toggle): receives the ticket + form `options` as props (fetched by the page/modal server component); shows key, title, description, status/priority `Badge`s, assignee `Avatar`, epic, labels, reporter; an "Edit" button swaps in `TicketForm` (edit mode) and back on success.
- **`TicketModal`** (`'use client'`): renders the `Modal` primitive `open`, `onClose={() => router.back()}`, containing its children (the detail/edit).
- **`NewTicketButton`** (`'use client'`): a button that opens the `Modal` primitive hosting `TicketForm` in create mode (no route).
- **`TicketCard`** (modify): wrap its content in a `<Link href={/boards/${slug}/${ticket.key}}>` so a click opens the detail (drag still works — rbd distinguishes click from drag). Pass the board slug down from `Column`/`BoardView`.

### 4.5 Routes (`src/app/(app)/boards/[slug]/`)

```
layout.tsx                     renders {children} and {modal}
page.tsx                       the board (existing)
[ticketKey]/page.tsx           full-page ticket detail (getTicketByKey → TicketDetail)
@modal/default.tsx             returns null (REQUIRED by Next 16)
@modal/(.)[ticketKey]/page.tsx intercepted: <TicketModal><TicketDetail/></TicketModal>
```

If `npm run build` reports the `children` slot needs a default, add `[slug]/default.tsx` rendering the board (or `null`). Both `[ticketKey]` pages `await params` and `notFound()` on a missing ticket.

## 5. Data flow

```
Board: TicketCard is a <Link> to /boards/[slug]/[key]
  click (soft nav) → @modal/(.)[key] intercepts → TicketModal(open) + TicketDetail; board stays behind; URL updates
  refresh/direct → @modal/default (null) + [key]/page.tsx → full-page TicketDetail
New ticket button → Modal(open) + TicketForm(create) → createTicket action → atomic key → revalidate → close
Edit (in detail) → TicketForm(edit) → updateTicket → revalidate
```

## 6. Testing (spec §9)

- **`ticketFormSchema`** — accepts a valid ticket; rejects an empty title; coerces empty assignee/epic to `null`.
- **`TicketForm`** — renders the fields; shows field errors when the (mocked) action returns them; is populated from `defaultValues` in edit mode.
- Key-generation atomicity is covered by `createTicketRecord`'s transaction + the existing `ticket-key` unit tests; the DAL is otherwise typecheck-covered. Intercepting routes verified by `build` + manual smoke (no E2E per parent §12).

## 7. Done criteria

- `lint`, `format:check`, `typecheck`, `test`, `build`, `build-storybook` all green (build proves the `@modal` slot + `default.tsx` are correct).
- Creating a ticket assigns the next key for its board and it appears on the board.
- Clicking a ticket opens a modal (URL → `/boards/[slug]/[key]`, board behind); refreshing that URL shows the full page; back closes the modal.
- Editing persists (title/status/priority/assignee/epic/labels).
- No component imports Prisma; every action re-checks the session; keys are unique (atomic counter).

**Next plan:** Phase 7 (comments thread; label/epic management) then Phase 8 (Vercel deploy).

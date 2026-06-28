# Phase 1+2: Foundation & Database — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A scaffolded Next.js app with green CI (lint → typecheck → test → build), a Dockerized Postgres, the full Prisma schema migrated and seeded, and a data-access layer — ready for the auth phase.

**Architecture:** Server-first Next.js (App Router). All Prisma access goes through `src/lib/dal/`; the seed script and DAL share pure helpers in `src/lib/ticket-key.ts`. CI runs against a real Postgres service container so migrations and seeds are proven on every push.

**Tech Stack:** Next.js (latest stable via create-next-app), TypeScript strict, Tailwind CSS, Prisma 6 + PostgreSQL 16 (Docker), Jest + React Testing Library, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-06-13-jira-kanban-design.md` (sections 2, 4, 10, 11 — phases 1 & 2). Later phases (auth, shell, board, tickets, rich features, deploy) get their own plans.

**Conventions for this plan:**

- All commands run from the repo root `/home/akashkumarchoudhary/Videos/jira` unless noted.
- Inside `src/`, modules import each other with **relative paths** (not the `@/` alias) when they are also consumed by `tsx`-run scripts (seed, check scripts) — `tsx` does not resolve the alias. App code in `app/` may use `@/`.
- Commit after every task. Never commit `.env`.

---

### Task 1: Scaffold the Next.js app

The repo already contains `docs/` and `.git`. `create-next-app` refuses to scaffold into a directory with unknown files, so move `docs/` aside first.

**Files:**

- Create: entire Next.js scaffold (`package.json`, `src/app/*`, `eslint.config.mjs`, `tsconfig.json`, `next.config.ts`, …)

- [x] **Step 1: Move docs aside and scaffold**

```bash
mv docs /tmp/jira-docs-keep
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
mv /tmp/jira-docs-keep docs
```

If `create-next-app` asks anything the flags didn't cover (e.g. Turbopack), accept the default. Note the Next.js version it prints — latest stable is what the spec wants.

- [x] **Step 2: Verify the dev server boots**

Run: `npm run dev` — open http://localhost:3000, expect the Next.js starter page. Stop with Ctrl-C.

- [x] **Step 3: Verify scaffold scripts pass**

```bash
npm run lint
npm run build
```

Expected: both exit 0.

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript, Tailwind, ESLint"
```

---

### Task 2: Prettier and a typecheck script

**Files:**

- Create: `.prettierrc`, `.prettierignore`
- Modify: `package.json` (scripts)

- [x] **Step 1: Install Prettier with the Tailwind class-sorting plugin**

```bash
npm install -D prettier prettier-plugin-tailwindcss
```

- [x] **Step 2: Create `.prettierrc`**

```json
{
  "semi": false,
  "singleQuote": true,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- [x] **Step 3: Create `.prettierignore`**

```
.next
node_modules
package-lock.json
```

- [x] **Step 4: Add scripts to `package.json`**

Add to the `"scripts"` object (keep existing entries):

```json
"typecheck": "tsc --noEmit",
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [x] **Step 5: Format the scaffold and verify**

```bash
npm run format
npm run typecheck
```

Expected: prettier rewrites scaffold files; `tsc` exits 0.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add prettier and typecheck script"
```

---

### Task 3: Docker Postgres and env files

**Files:**

- Create: `docker-compose.yml`, `.env`, `.env.example`
- Modify: `package.json` (scripts), possibly `.gitignore`

- [x] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    ports:
      - '5434:5432' # host 5434: 5432/5433 occupied by other local projects
    environment:
      POSTGRES_USER: jira
      POSTGRES_PASSWORD: jira
      POSTGRES_DB: jira
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

- [x] **Step 2: Create `.env` and `.env.example`** (identical content for now)

```
DATABASE_URL="postgresql://jira:jira@localhost:5434/jira"
```

- [x] **Step 3: Ensure `.env` is gitignored but `.env.example` is tracked**

```bash
git check-ignore -q .env || echo ".env" >> .gitignore
git check-ignore -q .env.example && echo '!.env.example' >> .gitignore || true
```

Verify: `git status --short` shows `.env.example` as untracked-addable and does NOT show `.env`.

- [x] **Step 4: Add a convenience script to `package.json`**

```json
"db:up": "docker compose up -d"
```

- [x] **Step 5: Start the database and verify**

```bash
npm run db:up
docker compose exec db pg_isready -U jira
```

Expected: `accepting connections`.

- [x] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example .gitignore package.json
git commit -m "chore: add dockerized postgres and env scaffolding"
```

---

### Task 4: Jest + React Testing Library

**Files:**

- Create: `jest.config.mjs`, `jest.setup.ts`, `src/__tests__/toolchain.test.tsx`
- Modify: `package.json` (scripts)

- [x] **Step 1: Install test dependencies**

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest
```

- [x] **Step 2: Create `jest.config.mjs`**

```js
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
}

export default createJestConfig(config)
```

- [x] **Step 3: Create `jest.setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [x] **Step 4: Add test scripts to `package.json`**

```json
"test": "jest",
"test:watch": "jest --watch"
```

- [x] **Step 5: Write a toolchain smoke test** — `src/__tests__/toolchain.test.tsx`

This permanently guards the Jest + jsdom + RTL + jest-dom wiring:

```tsx
import { render, screen } from '@testing-library/react'

function Hello() {
  return <h1>Hello Jira</h1>
}

test('jest, jsdom, RTL and jest-dom are wired up', () => {
  render(<Hello />)
  expect(
    screen.getByRole('heading', { name: 'Hello Jira' }),
  ).toBeInTheDocument()
})
```

- [x] **Step 6: Run the test**

Run: `npm test`
Expected: `PASS src/__tests__/toolchain.test.tsx`, 1 passed.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "test: set up jest and react-testing-library with smoke test"
```

---

### Task 5: CI workflow (no database yet)

The Postgres service is added in Task 11, after the schema exists.

**Files:**

- Create: `.github/workflows/ci.yml`

- [x] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [x] **Step 2: Verify the same gates locally**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: all four exit 0.

- [x] **Step 3 (optional, needs GitHub): push and watch the workflow**

If a GitHub remote is wanted now: `gh repo create` (interactive), push `main`, and check the Actions tab shows a green run. Otherwise skip — the workflow file is verified by Step 2 plus YAML review, and will run on first push.

- [x] **Step 4: Commit**

```bash
git add .github
git commit -m "ci: add lint/typecheck/test/build workflow"
```

---

### Task 6: Prisma schema and first migration

**Files:**

- Create: `prisma/schema.prisma`, `prisma/migrations/*` (generated)
- Modify: `package.json` (postinstall script)

- [ ] **Step 1: Install Prisma 6 (pinned so this plan's instructions stay accurate)**

```bash
npm install -D prisma@6
npm install @prisma/client@6
npx prisma init --datasource-provider postgresql
```

`prisma init` may overwrite `.env` — re-check it still contains the `DATABASE_URL` from Task 3 (same value), and that `.env` is still gitignored.

- [ ] **Step 2: Replace `prisma/schema.prisma` with the full schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Status {
  TODO
  IN_PROGRESS
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model User {
  id              String    @id @default(cuid())
  name            String
  email           String    @unique
  passwordHash    String
  avatarColor     String
  assignedTickets Ticket[]  @relation("TicketAssignee")
  reportedTickets Ticket[]  @relation("TicketReporter")
  comments        Comment[]
}

model Board {
  id            String   @id @default(cuid())
  name          String
  slug          String   @unique
  prefix        String   @unique
  description   String?
  ticketCounter Int      @default(0)
  tickets       Ticket[]
  epics         Epic[]
}

model Ticket {
  id          String    @id @default(cuid())
  key         String    @unique
  title       String
  description String?
  status      Status    @default(TODO)
  priority    Priority  @default(MEDIUM)
  position    Int
  board       Board     @relation(fields: [boardId], references: [id], onDelete: Cascade)
  boardId     String
  assignee    User?     @relation("TicketAssignee", fields: [assigneeId], references: [id])
  assigneeId  String?
  reporter    User      @relation("TicketReporter", fields: [reporterId], references: [id])
  reporterId  String
  epic        Epic?     @relation(fields: [epicId], references: [id])
  epicId      String?
  labels      Label[]
  comments    Comment[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([boardId, status, position])
}

model Comment {
  id        String   @id @default(cuid())
  body      String
  ticket    Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  ticketId  String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
}

model Label {
  id      String   @id @default(cuid())
  name    String   @unique
  color   String
  tickets Ticket[]
}

model Epic {
  id      String   @id @default(cuid())
  name    String
  color   String
  board   Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  boardId String
  tickets Ticket[]
}
```

- [ ] **Step 3: Add a postinstall hook so `prisma generate` runs in CI**

Add to `package.json` scripts:

```json
"postinstall": "prisma generate"
```

- [ ] **Step 4: Run the migration** (database must be up: `npm run db:up`)

Run: `npx prisma migrate dev --name init`
Expected: ends with `Your database is now in sync with your schema.` and generates the client.

- [ ] **Step 5: Verify with typecheck**

Run: `npm run typecheck`
Expected: exits 0 (proves the generated client compiles).

- [ ] **Step 6: Commit**

```bash
git add prisma package.json package-lock.json
git commit -m "feat: add prisma schema and initial migration"
```

---

### Task 7: Prisma client singleton

**Files:**

- Create: `src/lib/prisma.ts`

- [ ] **Step 1: Create `src/lib/prisma.ts`**

The singleton prevents Next.js dev-mode hot reloads from exhausting database connections:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 2: Verify**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/lib/prisma.ts
git commit -m "feat: add prisma client singleton"
```

---

### Task 8: Ticket-key utilities (TDD)

Pure functions used by the seed script now and by the create-ticket Server Action in a later phase. Spec rule: a board's default prefix comes from the first letters of its name (uppercase, max 5 chars); single-word names use the first 3 letters.

**Files:**

- Test: `src/lib/__tests__/ticket-key.test.ts`
- Create: `src/lib/ticket-key.ts`

- [ ] **Step 1: Write the failing tests** — `src/lib/__tests__/ticket-key.test.ts`

```ts
import { deriveBoardPrefix, formatTicketKey } from '../ticket-key'

describe('deriveBoardPrefix', () => {
  test('uses word initials for multi-word names', () => {
    expect(deriveBoardPrefix('Website Redesign')).toBe('WR')
  })

  test('uses first three letters for single-word names', () => {
    expect(deriveBoardPrefix('Marketing')).toBe('MAR')
  })

  test('uppercases lowercase input', () => {
    expect(deriveBoardPrefix('mobile app')).toBe('MA')
  })

  test('caps the prefix at five characters', () => {
    expect(deriveBoardPrefix('Big Hairy Audacious Goal Project X')).toBe(
      'BHAGP',
    )
  })

  test('ignores surrounding and repeated whitespace', () => {
    expect(deriveBoardPrefix('  Website   Redesign  ')).toBe('WR')
  })
})

describe('formatTicketKey', () => {
  test('joins prefix and number with a hyphen', () => {
    expect(formatTicketKey('WR', 12)).toBe('WR-12')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- ticket-key`
Expected: FAIL — `Cannot find module '../ticket-key'`.

- [ ] **Step 3: Implement** — `src/lib/ticket-key.ts`

```ts
export function deriveBoardPrefix(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/).filter(Boolean)
  const prefix =
    words.length >= 2
      ? words.map((w) => w[0]).join('')
      : (words[0] ?? '').slice(0, 3)
  return prefix.slice(0, 5)
}

export function formatTicketKey(prefix: string, number: number): string {
  return `${prefix}-${number}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- ticket-key`
Expected: PASS, 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ticket-key.ts src/lib/__tests__/ticket-key.test.ts
git commit -m "feat: add board prefix and ticket key helpers"
```

---

### Task 9: Seed script

Seeds the spec's demo data: 5 users (including the demo login), 3 boards, 4 labels, epics, ~24 tickets across columns, comments. Idempotent: wipes all rows first, so it can be re-run anytime.

**Files:**

- Create: `prisma/seed.ts`
- Modify: `package.json` (prisma seed config + dependency)

- [ ] **Step 1: Install runtime deps for seeding**

```bash
npm install bcryptjs
npm install -D tsx
```

If `npm run typecheck` later complains about bcryptjs types: `npm install -D @types/bcryptjs` (older bcryptjs versions don't bundle types).

- [ ] **Step 2: Register the seed command in `package.json`** (top-level key, sibling of `"scripts"`)

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 3: Create `prisma/seed.ts`**

```ts
import { PrismaClient, Priority, Status } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { deriveBoardPrefix, formatTicketKey } from '../src/lib/ticket-key'

const prisma = new PrismaClient()

const USERS = [
  { name: 'Demo User', email: 'demo@example.com', avatarColor: '#6366f1' },
  { name: 'Ava Patel', email: 'ava@example.com', avatarColor: '#f59e0b' },
  { name: 'Liam Chen', email: 'liam@example.com', avatarColor: '#10b981' },
  { name: 'Sofia Garcia', email: 'sofia@example.com', avatarColor: '#ef4444' },
  { name: 'Noah Kim', email: 'noah@example.com', avatarColor: '#3b82f6' },
]

const LABELS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#22c55e' },
  { name: 'chore', color: '#64748b' },
  { name: 'design', color: '#a855f7' },
]

// One entry per ticket: [title, status, priority, epicIndex | null]
type TicketSpec = [string, Status, Priority, number | null]

const BOARDS: {
  name: string
  description: string
  epics: { name: string; color: string }[]
  tickets: TicketSpec[]
}[] = [
  {
    name: 'Website Redesign',
    description: 'Marketing site refresh for the Q3 launch',
    epics: [
      { name: 'Landing page', color: '#6366f1' },
      { name: 'Design system', color: '#a855f7' },
    ],
    tickets: [
      ['Audit current page performance', 'DONE', 'MEDIUM', 0],
      ['Define new color tokens', 'DONE', 'HIGH', 1],
      ['Build hero section', 'IN_PROGRESS', 'HIGH', 0],
      ['Implement responsive nav', 'IN_PROGRESS', 'MEDIUM', 1],
      ['Fix CLS regression on mobile', 'TODO', 'URGENT', 0],
      ['Write pricing page copy', 'TODO', 'LOW', null],
      ['Add dark mode support', 'TODO', 'MEDIUM', 1],
      ['Set up A/B test for CTA', 'TODO', 'LOW', null],
    ],
  },
  {
    name: 'Mobile App',
    description: 'iOS and Android client',
    epics: [
      { name: 'Onboarding', color: '#10b981' },
      { name: 'Push notifications', color: '#f59e0b' },
    ],
    tickets: [
      ['Design onboarding flow', 'DONE', 'HIGH', 0],
      ['Crash on login with emoji password', 'IN_PROGRESS', 'URGENT', null],
      ['Implement signup screen', 'IN_PROGRESS', 'HIGH', 0],
      ['Register device tokens', 'TODO', 'MEDIUM', 1],
      ['Notification preferences screen', 'TODO', 'MEDIUM', 1],
      ['Upgrade React Native version', 'TODO', 'LOW', null],
      ['Add biometric unlock', 'TODO', 'LOW', 0],
      ['Deep links open wrong screen', 'TODO', 'HIGH', null],
    ],
  },
  {
    name: 'Marketing',
    description: 'Campaigns, content and analytics',
    epics: [{ name: 'Q3 campaign', color: '#ef4444' }],
    tickets: [
      ['Draft launch announcement', 'DONE', 'MEDIUM', 0],
      ['Book conference booth', 'DONE', 'LOW', null],
      ['Produce demo video', 'IN_PROGRESS', 'HIGH', 0],
      ['Set up UTM dashboard', 'IN_PROGRESS', 'MEDIUM', null],
      ['Write customer case study', 'TODO', 'MEDIUM', 0],
      ['Refresh email templates', 'TODO', 'LOW', null],
      ['Plan webinar series', 'TODO', 'MEDIUM', 0],
      ['Competitor pricing analysis', 'TODO', 'HIGH', null],
    ],
  },
]

const COMMENT_BODIES = [
  'I can pick this up tomorrow.',
  'Blocked on the design review — pinged the channel.',
  'Done on my branch, opening a PR shortly.',
]

async function main() {
  // Delete in FK-dependency order
  await prisma.comment.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.epic.deleteMany()
  await prisma.label.deleteMany()
  await prisma.board.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = bcrypt.hashSync('demo1234', 10)
  const users = []
  for (const u of USERS) {
    users.push(await prisma.user.create({ data: { ...u, passwordHash } }))
  }

  const labels = []
  for (const l of LABELS) {
    labels.push(await prisma.label.create({ data: l }))
  }

  let ticketCount = 0
  let commentCount = 0

  for (const boardSpec of BOARDS) {
    const board = await prisma.board.create({
      data: {
        name: boardSpec.name,
        slug: boardSpec.name.toLowerCase().replace(/\s+/g, '-'),
        prefix: deriveBoardPrefix(boardSpec.name),
        description: boardSpec.description,
      },
    })

    const epics = []
    for (const e of boardSpec.epics) {
      epics.push(
        await prisma.epic.create({ data: { ...e, boardId: board.id } }),
      )
    }

    const positionByStatus: Record<Status, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    }
    let counter = 0

    for (const [title, status, priority, epicIndex] of boardSpec.tickets) {
      counter += 1
      const ticket = await prisma.ticket.create({
        data: {
          key: formatTicketKey(board.prefix, counter),
          title,
          description: `Details for "${title}". Seeded for demo purposes.`,
          status,
          priority,
          position: positionByStatus[status]++,
          boardId: board.id,
          reporterId: users[ticketCount % users.length].id,
          assigneeId:
            ticketCount % 3 === 0
              ? null
              : users[(ticketCount + 1) % users.length].id,
          epicId: epicIndex === null ? null : epics[epicIndex].id,
          labels: { connect: [{ id: labels[ticketCount % labels.length].id }] },
        },
      })
      ticketCount += 1

      if (ticketCount % 2 === 0) {
        await prisma.comment.create({
          data: {
            body: COMMENT_BODIES[commentCount % COMMENT_BODIES.length],
            ticketId: ticket.id,
            authorId: users[commentCount % users.length].id,
          },
        })
        commentCount += 1
      }
    }

    await prisma.board.update({
      where: { id: board.id },
      data: { ticketCounter: counter },
    })
  }

  console.log(
    `Seeded ${users.length} users, ${BOARDS.length} boards, ${labels.length} labels, ${ticketCount} tickets, ${commentCount} comments`,
  )
  console.log('Demo login: demo@example.com / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Run the seed** (database must be up)

Run: `npx prisma db seed`
Expected output:

```
Seeded 5 users, 3 boards, 4 labels, 24 tickets, 12 comments
Demo login: demo@example.com / demo1234
```

- [ ] **Step 5: Spot-check the data**

Run: `npx prisma studio` — confirm boards show prefixes `WR`, `MA`, `MAR` and tickets have keys like `WR-3`. Close it. (Alternative without a browser: `docker compose exec db psql -U jira -c 'SELECT key, title, status, position FROM "Ticket" ORDER BY key LIMIT 10;'`)

- [ ] **Step 6: Re-run the seed to prove idempotency**

Run: `npx prisma db seed`
Expected: same output, no unique-constraint errors.

- [ ] **Step 7: Commit**

```bash
git add prisma/seed.ts package.json package-lock.json
git commit -m "feat: add idempotent seed with demo users, boards and tickets"
```

---

### Task 10: Data-access layer

All Prisma queries live here; nothing else in the app touches the client directly. These functions use relative imports so `tsx` scripts can consume them.

**Files:**

- Create: `src/lib/dal/users.ts`, `src/lib/dal/boards.ts`, `scripts/check-dal.ts`

- [ ] **Step 1: Create `src/lib/dal/users.ts`**

```ts
import { prisma } from '../prisma'

export function getUsers() {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, avatarColor: true },
  })
}

export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}
```

- [ ] **Step 2: Create `src/lib/dal/boards.ts`**

```ts
import { Status } from '@prisma/client'
import { prisma } from '../prisma'

export function getBoards() {
  return prisma.board.findMany({ orderBy: { name: 'asc' } })
}

export async function getBoardWithTickets(slug: string) {
  const board = await prisma.board.findUnique({
    where: { slug },
    include: {
      epics: true,
      tickets: {
        orderBy: { position: 'asc' },
        include: {
          assignee: { select: { id: true, name: true, avatarColor: true } },
          labels: true,
          epic: true,
        },
      },
    },
  })
  if (!board) return null

  const { tickets, ...rest } = board
  return {
    ...rest,
    columns: {
      TODO: tickets.filter((t) => t.status === Status.TODO),
      IN_PROGRESS: tickets.filter((t) => t.status === Status.IN_PROGRESS),
      DONE: tickets.filter((t) => t.status === Status.DONE),
    },
  }
}

export type BoardWithTickets = NonNullable<
  Awaited<ReturnType<typeof getBoardWithTickets>>
>
export type BoardTicket = BoardWithTickets['columns']['TODO'][number]
```

- [ ] **Step 3: Create `scripts/check-dal.ts`** — a live smoke check against the seeded database

```ts
import { getBoards, getBoardWithTickets } from '../src/lib/dal/boards'
import { getUsers } from '../src/lib/dal/users'

async function main() {
  const users = await getUsers()
  const boards = await getBoards()
  console.log(`users: ${users.length}, boards: ${boards.length}`)

  for (const b of boards) {
    const full = await getBoardWithTickets(b.slug)
    if (!full) throw new Error(`board not found by slug: ${b.slug}`)
    const counts = `todo=${full.columns.TODO.length} in_progress=${full.columns.IN_PROGRESS.length} done=${full.columns.DONE.length}`
    console.log(`${full.prefix} ${full.name}: ${counts}`)
  }

  const missing = await getBoardWithTickets('does-not-exist')
  if (missing !== null) throw new Error('expected null for unknown slug')
  console.log('unknown slug returns null: ok')
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)
```

- [ ] **Step 4: Run the check** (database up and seeded)

Run: `npx tsx scripts/check-dal.ts`
Expected output:

```
users: 5, boards: 3
MAR Marketing: todo=4 in_progress=2 done=2
MA Mobile App: todo=5 in_progress=2 done=1
WR Website Redesign: todo=4 in_progress=2 done=2
unknown slug returns null: ok
```

- [ ] **Step 5: Typecheck and full test run**

```bash
npm run typecheck && npm test
```

Expected: both pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/dal scripts
git commit -m "feat: add data-access layer with live smoke check"
```

---

### Task 11: CI runs migrations and seed against real Postgres

**Files:**

- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace `.github/workflows/ci.yml` with the database-backed version**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: jira
          POSTGRES_PASSWORD: jira
          POSTGRES_DB: jira
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://jira:jira@localhost:5432/jira
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npx prisma migrate deploy
      - run: npx prisma db seed
      - run: npx tsx scripts/check-dal.ts
      - run: npm run build
```

- [ ] **Step 2: Verify the new steps locally** (mirrors what CI will do)

```bash
npx prisma migrate deploy && npx prisma db seed && npx tsx scripts/check-dal.ts && npm run build
```

Expected: all exit 0 with the seed and check-dal outputs from Tasks 9–10.

- [ ] **Step 3 (optional, needs GitHub remote): push and confirm a green run**

```bash
git push
```

Check the Actions tab: every step green, including migrate/seed/check-dal.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run migrations, seed and dal check against postgres service"
```

---

## Done Criteria (Phase 1+2)

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` all pass locally and in CI
- `npm run db:up && npx prisma migrate dev && npx prisma db seed` produces the demo dataset from a blank volume
- `npx tsx scripts/check-dal.ts` passes against the seeded database
- CI proves migrations + seed against a disposable Postgres on every push

**Next plan:** Phase 3 (Auth.js credentials, login page, middleware) — written after this plan is executed, against the real state of the code.

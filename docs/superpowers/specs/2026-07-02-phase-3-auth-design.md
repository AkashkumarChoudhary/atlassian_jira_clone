# Phase 3: Authentication — Design Spec

**Date:** 2026-07-02
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-13-jira-kanban-design.md` (§6 Authentication, §5 Routing/Structure, §7 Error Handling, §9 Testing)
**Builds on:** Phase 1+2 (Prisma schema, seed with demo users, DAL). Demo login exists: `demo@example.com` / `demo1234`.

## 1. Purpose

Add credential-based authentication so the app is gated: unauthenticated visitors are redirected to `/login`, a valid login establishes a session and lands on a protected page, and logout clears the session. This is the third build phase and ends demoable.

## 2. Platform reality (why this deviates from parent §6)

The parent spec §6 specified **Auth.js (NextAuth) v5 + `middleware.ts`**. The project runs on **Next.js 16**, whose bundled docs (`node_modules/next/dist/docs/01-app`) establish breaking changes that make that choice unworkable, and AGENTS.md mandates following those docs:

- **`middleware` is deprecated and renamed to `proxy`** (v16.0.0; Node.js runtime by default). No `middleware.md` convention remains. → We use **`proxy.ts`**.
- Proxy is for **optimistic checks only**: _"Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone."_ → The real security boundary is a DAL `verifySession()` called by every Server Action and protected read.
- The docs' recommended credentials-auth is **DIY**: `jose` (JWT) + async `cookies()` + a memoized DAL check. Auth.js v5 targets the removed `middleware.ts` + Edge model. → We implement DIY sessions.
- `cookies()` is **async**; cookies may be set/deleted only inside a Server Action or Route Handler. `redirect()` (from `next/navigation`) throws and must be called **outside** try/catch. Zod uses the **v4** API (`z.email()`, `{ error: 'msg' }`).

**Net:** every functional requirement of parent §6 is honored (credentials login, JWT cookie session, no session table, seeded users only, no registration, every Server Action re-checks the session). Only the mechanism changes: `proxy.ts` instead of `middleware.ts`, DIY `jose` sessions instead of NextAuth.

## 3. Scope

**In scope (Phase 3):**

- Stateless JWT session in an httpOnly cookie (`jose`), with create/verify/delete.
- Credentials login form + `login`/`logout` Server Actions with Zod validation.
- `proxy.ts` optimistic route protection.
- DAL session verification (`verifySession`, `getCurrentUser`).
- A minimal protected landing so the flow is demoable.
- `SESSION_SECRET` wired into `.env`, `.env.example`, and CI.

**Deferred (later phases):** Navbar/Sidenav shell, theming/`next-themes`, Storybook (Phase 4); real board list and Kanban UI (Phase 5). Registration / password reset remain out of scope entirely (parent §12).

## 4. Components & interfaces

### 4.1 Session library — `src/lib/session.ts` (`import 'server-only'`)

Signs a minimal payload and manages the cookie. Uses `jose` HS256 and the async `cookies()` API.

- `encrypt(payload: SessionPayload): Promise<string>` — `SignJWT` HS256, `setIssuedAt`, `setExpirationTime('7d')`.
- `decrypt(token?: string): Promise<SessionPayload | null>` — `jwtVerify`; returns `null` on any failure (never throws).
- `createSession(userId: string): Promise<void>` — encrypts `{ userId, expiresAt }`, sets cookie `session`.
- `deleteSession(): Promise<void>` — deletes cookie `session`.
- `SessionPayload = { userId: string; expiresAt: Date }` (or ISO string after round-trip).

Cookie options: `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `expires: expiresAt`, and **`secure: process.env.NODE_ENV === 'production'`** (must be non-secure over http in local dev). Secret from `process.env.SESSION_SECRET`.

### 4.2 Auth DAL — `src/lib/dal/auth.ts`

All Prisma access stays in `dal/` (parent §5 boundary). Uses relative imports (`../prisma`, `../session`) to match the existing `dal/` files.

- `verifySession()` — wrapped in React `cache()`: read+decrypt cookie; if no valid `userId`, `redirect('/login')`; else return `{ userId }`.
- `getCurrentUser()` — wrapped in `cache()`: `verifySession()` then Prisma fetch of safe fields only (`id, name, email, avatarColor`); returns the user (never `passwordHash`).
- Login lookup reuses the existing `getUserByEmail(email)` (returns the full row incl. `passwordHash` for the bcrypt check).

### 4.3 Zod schema — `src/schemas/auth.ts`

Shared by the client form and the Server Action (parent §5: schemas live only in `schemas/`).

- `loginSchema = z.object({ email: z.email({ error: 'Enter a valid email.' }), password: z.string().min(1, { error: 'Password is required.' }) })`.
- `LoginInput = z.infer<typeof loginSchema>`.

Login validation is intentionally light (format only); wrong credentials are an auth failure, not a validation error.

### 4.4 Server Actions — `src/actions/auth.ts` (`'use server'`)

Typed results per parent §7 (return errors, don't throw across the boundary).

- `login(prevState: LoginState, formData: FormData): Promise<LoginState>`:
  1. `safeParse` with `loginSchema`; on failure return `{ fieldErrors }` (per-field messages via `error.flatten().fieldErrors`).
  2. `getUserByEmail`; if absent → generic `{ error: 'Invalid email or password.' }`.
  3. `bcrypt.compare(password, user.passwordHash)`; if false → the same generic error (no user-enumeration).
  4. On success: `createSession(user.id)`, then `redirect('/boards')` — **outside** any try/catch.
- `logout(): Promise<void>`: `deleteSession()` then `redirect('/login')`.
- `LoginState = { error?: string; fieldErrors?: { email?: string[]; password?: string[] } } | undefined`.

### 4.5 Route protection — `src/proxy.ts` (Node runtime)

- Default-exported `async function proxy(req: NextRequest)`; reads the `session` cookie and `decrypt`s it (optimistic, cookie-only — no DB).
- Unauthenticated + not on `/login` → `NextResponse.redirect('/login')`. Authenticated + on `/login` → redirect `/boards`.
- `config.matcher` excludes `api`, `_next/static`, `_next/image`, and `favicon.ico`.
- Not the security boundary — a comment states real checks happen in `verifySession()`.

### 4.6 Routing & pages

Single root `app/layout.tsx` (keeps `<html><body>`; hosts the ThemeProvider in Phase 4). Nested route groups:

```
src/app/
  layout.tsx                 root (html/body)
  page.tsx                   redirect('/boards')
  (auth)/
    login/page.tsx           public; bare centered card; if already authed, redirect('/boards')
    login/login-form.tsx     'use client' — useActionState(login)
  (app)/
    layout.tsx               minimal pass-through now → shell in Phase 4
    boards/page.tsx          protected placeholder: "Signed in as {name}" + logout form
```

`LoginForm` (client): email + password inputs, submit disabled while `pending`, renders `state.error` / `fieldErrors`, shows a visible demo-login hint (`demo@example.com` / `demo1234`). Logout is a plain `<form action={logout}>` with a submit button (Server Action; no client component needed). Tailwind styling is basic and dark-friendly; full theming is Phase 4.

## 5. Data flow

```
Visit any protected URL
  → proxy.ts: no session cookie → redirect /login
/login submit
  → login Server Action: Zod → getUserByEmail → bcrypt.compare
      fail → return { error } → useActionState renders it
      ok   → createSession() sets httpOnly cookie → redirect /boards
/boards (protected)
  → getCurrentUser(): verifySession() (redirect /login if invalid) → Prisma safe fields → render
Logout
  → logout Server Action: deleteSession() → redirect /login
```

## 6. Environment & CI

- `SESSION_SECRET` — 32-byte random (e.g. `openssl rand -base64 32`) in local `.env`; a placeholder in `.env.example`; a dummy value in the CI `env:` block so `build`/`test` pass. `.env` stays gitignored.
- No schema/migration change this phase (User already has `passwordHash`).

## 7. Testing (parent §9)

- **`session`**: `encrypt`→`decrypt` round-trip returns the payload; `decrypt` of a tampered/empty token returns `null`.
- **`loginSchema`**: accepts valid input; rejects invalid email and empty password with the expected messages.
- **`LoginForm`**: renders fields; displays `error` and `fieldErrors` when the (mocked) action returns them; disables submit while pending.
- Actions and DAL stay thin → covered by typecheck plus the schema/session tests. No E2E.

## 8. Dependencies

Add: `jose`, `zod` (v4), `server-only` (runtime). `bcryptjs` already present.

## 9. Done criteria

- Unauthenticated access to any non-`/login` route redirects to `/login`.
- `demo@example.com` / `demo1234` logs in and lands on `/boards` (placeholder); wrong credentials show a generic error; logout returns to `/login`.
- `lint`, `format:check`, `typecheck`, `test`, `build` all green locally and in CI (with `SESSION_SECRET` set).
- No secret committed; session cookie is httpOnly and not readable client-side.

**Next plan:** Phase 4 (app shell — Storybook, UI primitives, config-driven Navbar/Sidenav, theme toggle) — written after this phase executes.

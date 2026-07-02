# Phase 4: App Shell — Design Spec

**Date:** 2026-07-02
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-06-13-jira-kanban-design.md` (§5 structure, §8 theming/Storybook, §9 testing)
**Builds on:** Phase 3 (auth). Authenticated users currently see a bare `/boards` placeholder; this phase wraps the authenticated area in a real shell.

## 1. Purpose

Give the authenticated app a polished, themeable shell: a config-driven Sidenav and Navbar with a working light/dark theme toggle and a user menu, plus a Storybook-driven library of `components/ui` primitives (each built in isolation with dark-mode variants before use). Ends demoable: log in → see the shell around `/boards`, toggle the theme, and log out from the user menu.

## 2. Platform reality (Next 16 / React 19 / Tailwind v4)

Verified against the actual toolchain (mid-2026):

- **Storybook 10** (`@storybook/nextjs-vite`, ≥10.4.6) officially supports Next 16 + React 19. Tailwind v4 is wired via the `@tailwindcss/vite` plugin in `viteFinal`. Local dev may require **Node ≥22** (CI already uses 22); if `storybook dev` won't start on the local Node 20, that is a documented Node bump, not a code blocker.
- **Tailwind v4 is CSS-first** — there is no `tailwind.config.js`. Dark mode's class strategy is enabled with a CSS directive: `@custom-variant dark (&:where(.dark, .dark *))`. The old `darkMode: 'class'` JS config is not read.
- **`next-themes` 0.4.6** works with React 19: a `'use client'` provider in the root layout + `suppressHydrationWarning` on `<html>`. Theme-dependent UI (the toggle icon) must be mount-guarded to avoid a hydration mismatch.
- **`lucide-react`** provides icons (React 19 compatible).

## 3. Scope

**In scope (Phase 4):**

- Theming: `next-themes` provider, Tailwind v4 class-based dark mode, converting `globals.css` off the media-query strategy.
- `components/ui` primitives (fuller set): `Button`, `Avatar`, `Badge`, `ThemeToggle`, `Dropdown`, `Modal`, `Skeleton` — each with a Storybook story and an RTL test.
- Config-driven navigation (`config/navigation.ts`) and layout components `Sidenav` + `Navbar`.
- The real `(app)/layout.tsx` shell.
- Storybook 10 setup with a light/dark decorator.

**Deferred:** the board Kanban UI and drag-and-drop (Phase 5); ticket create/edit + the intercepting-route modal that *consumes* `Modal` (Phase 6); comments/labels/epics (Phase 7). `Modal`/`Badge` are built now as primitives but wired into features later.

## 4. Components & interfaces

### 4.1 Theming

- `src/components/theme-provider.tsx` (`'use client'`): thin wrapper exporting `ThemeProvider` that renders `next-themes`' provider with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
- `src/app/layout.tsx`: add `suppressHydrationWarning` to `<html>`; wrap `{children}` in `<ThemeProvider>`.
- `src/app/globals.css`: remove the `@media (prefers-color-scheme: dark)` block; add `@custom-variant dark (&:where(.dark, .dark *));`. Keep the CSS-var theme, with dark values applied under `.dark`.

### 4.2 UI primitives (`src/components/ui/`)

Each is a client component (uses interactivity/hooks or is a styled leaf), carries `dark:` variants, has a `*.stories.tsx`, and an RTL test. Components never import Prisma (spec §5 boundary).

- **`Button`** — props: `variant` (`primary` | `secondary` | `ghost` | `danger`), `size` (`sm` | `md`), plus native button attrs; `forwardRef`. Tailwind classes per variant.
- **`Avatar`** — props: `name: string`, `color: string` (the user's `avatarColor`), `size?`. Renders a colored circle with the name's initials (1–2 letters).
- **`Badge`** — props: `children`, `color?: string` (or a small variant set). A rounded pill; used later for labels/priority.
- **`ThemeToggle`** — a `Button`-styled control using `useTheme()`; shows a sun/moon `lucide` icon; toggles `light`/`dark`. Mount-guarded (renders a neutral placeholder until mounted) to avoid hydration mismatch.
- **`Dropdown`** — a custom accessible menu (no extra dep): a trigger + a popover list; opens on click, closes on outside-click and `Escape`, `aria-expanded`/`role="menu"`. Props: `trigger: ReactNode`, `children` (menu items).
- **`Modal`** — a controlled dialog built on the native `<dialog>` element: props `open: boolean`, `onClose: () => void`, `children`, optional `title`. `showModal()`/`close()` driven by `open` via `useEffect`; backdrop click and `Escape` close it.
- **`Skeleton`** — a presentational `animate-pulse` block; props: `className?`.

### 4.3 Config-driven navigation (`src/config/navigation.ts`)

Data, not JSX (spec §5): `type NavItem = { label: string; href: string; icon: LucideIcon }` (`LucideIcon` is `lucide-react`'s component type). Export `sidenavItems: NavItem[]` (initially one entry: `{ label: 'Boards', href: '/boards', icon: SquareKanban }`, referencing the `lucide-react` icon component — the plan confirms the exact export name). Adding a destination is a one-line change.

### 4.4 Layout components (`src/components/layout/`)

- **`Sidenav`** (`'use client'` for `usePathname`): renders `sidenavItems` as links with icon + label; highlights the active item by path prefix.
- **`Navbar`**: app name/logo on the left; on the right, `ThemeToggle` and a user menu — an `Avatar` trigger opening a `Dropdown` that shows the user's name/email and a logout `<form action={logout}>`. Receives the current user as props (name, email, avatarColor).

### 4.5 The shell (`src/app/(app)/layout.tsx`)

Replaces the Phase 3 pass-through. Server component: calls `getCurrentUser()` (the Next auth-guide pattern — fetch user in the layout; the security gate stays in the DAL/pages). Renders:

```
<div class="flex h-full">
  <Sidenav />
  <div class="flex flex-1 flex-col">
    <Navbar user={user} />
    <main class="flex-1 overflow-auto">{children}</main>
  </div>
</div>
```

If `getCurrentUser()` returns null, redirect to `/login` (belt-and-suspenders with proxy + page gates).

### 4.6 Storybook (`.storybook/`)

- Init with `npx storybook@latest init` (framework `@storybook/nextjs-vite`, pinned ≥10.4.6).
- `.storybook/main.ts`: stories glob `../src/**/*.stories.@(tsx)`; `viteFinal` merges the `@tailwindcss/vite` plugin so Tailwind v4 classes render.
- `.storybook/preview.ts`: import `../src/app/globals.css`; a global toolbar `theme` (light/dark) with a **decorator** that toggles the `.dark` class on the story container, so every story is verified in both modes.
- One `*.stories.tsx` per primitive, exercising its variants/states.

## 5. Data flow

```
(app)/layout (server) → getCurrentUser() (verifySession + safe fields)
  → <Navbar user={...}/> (Avatar + Dropdown → logout action)
  → <Sidenav/> (config-driven links, active via usePathname)
  → <main>{page}</main>
ThemeToggle (client) → next-themes useTheme().setTheme → .dark class on <html> → dark: variants
```

## 6. Testing (spec §9)

- **UI primitives** — RTL render + interaction: `ThemeToggle` toggles theme (mock `next-themes`), `Dropdown` opens/closes on click + Escape, `Modal` opens/closes, `Avatar` renders correct initials; render/prop tests for `Button` (variants), `Badge`, `Skeleton`.
- **Layout** — `Sidenav` highlights the active route (mock `usePathname`); `Navbar` renders the user's name and a logout control.
- `config/navigation.ts` is data → covered by typecheck. Storybook config is not unit-tested.

## 7. Done criteria

- `lint`, `format:check`, `typecheck`, `test`, `build` all green locally and in CI.
- `npm run storybook` renders every primitive with a working light/dark toggle (subject to the Node ≥22 note).
- Logging in shows the shell (Sidenav + Navbar) around `/boards`; the theme toggle switches light/dark and persists; the user menu logs out.
- No component imports Prisma; theming uses the `.dark` class strategy.

**Next plan:** Phase 5 (read-only Kanban board, then drag-and-drop with optimistic moves).

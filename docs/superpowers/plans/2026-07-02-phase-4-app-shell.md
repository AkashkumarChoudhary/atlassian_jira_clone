# Phase 4: App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wrap the authenticated area in a themeable, config-driven shell (Sidenav + Navbar + light/dark toggle + user menu) and build the `components/ui` primitives in Storybook, so login lands on a polished `/boards` shell.

**Architecture:** `next-themes` drives a `.dark` class (Tailwind v4 class strategy via `@custom-variant`). Presentational primitives (`Button`/`Avatar`/`Badge`/`Skeleton`) are shared components; interactive ones (`ThemeToggle`/`Dropdown`/`Modal`) and `Sidenav` are `'use client'`. The `(app)` layout is a server component that fetches the user (`getCurrentUser()`) for the `Navbar`. Storybook 10 (`@storybook/nextjs-vite`) renders each primitive with a light/dark decorator.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (CSS-first), `next-themes` 0.4.x, `lucide-react` 1.x, Storybook 10 (`nextjs-vite`), Jest + RTL.

**Spec:** `docs/superpowers/specs/2026-07-02-phase-4-app-shell-design.md`.

## Global Constraints

- **Tailwind v4 is CSS-first (no `tailwind.config.js`).** Dark mode uses the class strategy via one CSS line: `@custom-variant dark (&:where(.dark, .dark *));`. Every component carries `dark:` variants.
- **`next-themes`**: a `'use client'` provider with `attribute="class"`; root `<html>` gets `suppressHydrationWarning`; theme-dependent UI is mount-guarded (render a neutral placeholder until `useEffect` sets `mounted`).
- **`components/` never imports Prisma** (spec §5). `config/` is data, not JSX.
- Import alias `@/` for app/component code. Icons come from `lucide-react`.
- Presentational primitives (`Button`, `Avatar`, `Badge`, `Skeleton`) have NO `'use client'` (shared components, no hooks). Interactive ones (`ThemeToggle`, `Dropdown`, `Modal`) and `Sidenav` start with `'use client'`.
- Storybook: framework `@storybook/nextjs-vite` (pinned ≥10.4.6); Tailwind v4 wired via `@tailwindcss/vite` in `viteFinal`; `preview.ts` imports `globals.css` and adds a light/dark toolbar decorator. **Local `storybook dev` may need Node ≥22** (CI is 22) — if it won't start locally, note it; it does not block the app build.
- Every primitive gets a `*.stories.tsx` and an RTL test that verifies real behavior.
- Prettier style: single quotes, no semicolons, 2-space; run `npm run format` before committing if unsure.

---

### Task 1: Theming foundation (deps, dark class strategy, provider)

**Files:**

- Modify: `package.json`/`package-lock.json` (deps), `src/app/globals.css`, `src/app/layout.tsx`
- Create: `src/components/theme-provider.tsx`

**Interfaces:**

- Produces: `ThemeProvider` (client component wrapping `next-themes`); `.dark` class strategy active; `next-themes`/`lucide-react` installed.

- [ ] **Step 1: Install deps**

```bash
npm install next-themes lucide-react
```

- [ ] **Step 2: Switch `globals.css` to the class dark strategy** — `src/app/globals.css`

Replace the ENTIRE file with:

```css
@import 'tailwindcss';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  --background: #ffffff;
  --foreground: #171717;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
}
```

- [ ] **Step 3: Create the provider** — `src/components/theme-provider.tsx`

```tsx
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
```

- [ ] **Step 4: Wire the provider into the root layout** — `src/app/layout.tsx`

Add `suppressHydrationWarning` to `<html>`, import `ThemeProvider`, and wrap `{children}`. The `<html>`/`<body>` open tags and font setup stay as they are; only add the highlighted pieces:

```tsx
import { ThemeProvider } from '@/components/theme-provider'
// ...existing imports (Metadata, fonts, globals.css)...

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck && npm run build
```

Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/app/globals.css src/app/layout.tsx src/components/theme-provider.tsx
git commit -m "feat: add next-themes provider and tailwind class dark mode"
```

---

### Task 2: Storybook 10 setup

**Files:**

- Create: `.storybook/main.ts`, `.storybook/preview.ts` (generated by init, then edited); Modify: `package.json` (scripts, dev deps); `.gitignore` (storybook build output)

**Interfaces:**

- Produces: `npm run storybook` / `npm run build-storybook`; a light/dark decorator available to all stories.

- [ ] **Step 1: Initialize Storybook**

```bash
npx storybook@latest init --yes
```

Accept the Next.js (`nextjs-vite`) framework it detects. This adds `storybook` + `@storybook/nextjs-vite` (and friends) to devDependencies, `.storybook/`, example stories, and `storybook`/`build-storybook` scripts. If it created `src/stories/` example files, delete that folder (we write our own stories next to components).

- [ ] **Step 2: Install the Tailwind Vite plugin**

```bash
npm install -D @tailwindcss/vite
```

- [ ] **Step 3: Configure `.storybook/main.ts`** for Tailwind v4

Ensure the stories glob covers `src/**` and add the Tailwind Vite plugin via `viteFinal`:

```ts
import type { StorybookConfig } from '@storybook/nextjs-vite'
import tailwindcss from '@tailwindcss/vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials'],
  framework: { name: '@storybook/nextjs-vite', options: {} },
  async viteFinal(config) {
    const { mergeConfig } = await import('vite')
    return mergeConfig(config, { plugins: [tailwindcss()] })
  },
}

export default config
```

(If `init` scaffolded a different `addons` list, keep it; only ensure the stories glob and `viteFinal` are as above.)

- [ ] **Step 4: Configure `.storybook/preview.ts`** — global styles + light/dark decorator

```ts
import type { Preview, Decorator } from '@storybook/nextjs-vite'
import '../src/app/globals.css'

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? 'light'
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="bg-background text-foreground min-h-24 p-6">
        <Story />
      </div>
    </div>
  )
}

const preview: Preview = {
  parameters: { layout: 'centered' },
  globalTypes: {
    theme: {
      description: 'Theme',
      defaultValue: 'light',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
}

export default preview
```

> Note: `.storybook/preview.ts` contains JSX, so rename it to `preview.tsx` if the toolchain requires it (Storybook accepts either; use `.tsx` since the decorator returns JSX).

- [ ] **Step 5: Ignore Storybook build output** — append to `.gitignore`

```
storybook-static
```

- [ ] **Step 6: Verify config compiles** (build is the reliable check; `dev` may need Node ≥22)

```bash
npm run build-storybook
```

Expected: exit 0, writes `storybook-static/`. If it fails only on `storybook dev` locally due to Node version, record it as a concern; `build-storybook` is the CI-relevant check. Confirm `npm run typecheck` and `npm run build` still exit 0.

- [ ] **Step 7: Commit**

```bash
git add .storybook package.json package-lock.json .gitignore
git commit -m "chore: set up storybook 10 with tailwind v4 and a theme decorator"
```

---

### Task 3: Button, Badge, Skeleton primitives

**Files:**

- Create: `src/components/ui/button.tsx`, `button.stories.tsx`, `src/components/ui/__tests__/button.test.tsx`; same trio for `badge` and `skeleton`.

**Interfaces:**

- Produces: `Button` (`variant`, `size`, native button props, `forwardRef`), `Badge` (`children`, `color?`), `Skeleton` (`className?`).

- [ ] **Step 1: Write failing tests** — `src/components/ui/__tests__/button.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

test('renders its children as a button', () => {
  render(<Button>Save</Button>)
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
})

test('fires onClick when enabled and not when disabled', async () => {
  const onClick = jest.fn()
  const user = userEvent.setup()
  const { rerender } = render(<Button onClick={onClick}>Go</Button>)
  await user.click(screen.getByRole('button', { name: 'Go' }))
  expect(onClick).toHaveBeenCalledTimes(1)

  rerender(
    <Button onClick={onClick} disabled>
      Go
    </Button>,
  )
  await user.click(screen.getByRole('button', { name: 'Go' }))
  expect(onClick).toHaveBeenCalledTimes(1)
})
```

`src/components/ui/__tests__/badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { Badge } from '../badge'

test('renders its children', () => {
  render(<Badge>bug</Badge>)
  expect(screen.getByText('bug')).toBeInTheDocument()
})

test('applies a custom background color when given one', () => {
  render(<Badge color="#ef4444">urgent</Badge>)
  expect(screen.getByText('urgent')).toHaveStyle({ backgroundColor: '#ef4444' })
})
```

`src/components/ui/__tests__/skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { Skeleton } from '../skeleton'

test('renders a pulsing placeholder element', () => {
  const { container } = render(<Skeleton className="h-4 w-10" />)
  const el = container.firstChild as HTMLElement
  expect(el).toHaveClass('animate-pulse')
  expect(el).toHaveClass('h-4')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- button badge skeleton`
Expected: FAIL — cannot find the modules.

- [ ] **Step 3: Implement** — `src/components/ui/button.tsx`

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'

const variants = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
  secondary:
    'border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700',
  ghost:
    'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
  danger: 'bg-red-600 text-white hover:bg-red-500',
}

const sizes = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  ),
)

Button.displayName = 'Button'
```

`src/components/ui/badge.tsx`:

```tsx
import type { ReactNode } from 'react'

export type BadgeProps = {
  children: ReactNode
  color?: string
  className?: string
}

export function Badge({ children, color, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color ? 'text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'} ${className}`}
      style={color ? { backgroundColor: color } : undefined}
    >
      {children}
    </span>
  )
}
```

`src/components/ui/skeleton.tsx`:

```tsx
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`}
    />
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- button badge skeleton`
Expected: PASS.

- [ ] **Step 5: Add stories** — `button.stories.tsx`, `badge.stories.tsx`, `skeleton.stories.tsx` (next to each component)

`src/components/ui/button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './button'

const meta: Meta<typeof Button> = { component: Button, title: 'ui/Button' }
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Primary' } }
export const Secondary: Story = {
  args: { children: 'Secondary', variant: 'secondary' },
}
export const Ghost: Story = { args: { children: 'Ghost', variant: 'ghost' } }
export const Danger: Story = { args: { children: 'Delete', variant: 'danger' } }
export const Small: Story = { args: { children: 'Small', size: 'sm' } }
```

`src/components/ui/badge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './badge'

const meta: Meta<typeof Badge> = { component: Badge, title: 'ui/Badge' }
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'chore' } }
export const Colored: Story = { args: { children: 'bug', color: '#ef4444' } }
```

`src/components/ui/skeleton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Skeleton } from './skeleton'

const meta: Meta<typeof Skeleton> = {
  component: Skeleton,
  title: 'ui/Skeleton',
}
export default meta
type Story = StoryObj<typeof Skeleton>

export const Line: Story = { args: { className: 'h-4 w-40' } }
export const Card: Story = { args: { className: 'h-24 w-64' } }
```

- [ ] **Step 6: Verify and commit**

```bash
npm run typecheck && npm test -- button badge skeleton
git add src/components/ui/button.tsx src/components/ui/button.stories.tsx src/components/ui/badge.tsx src/components/ui/badge.stories.tsx src/components/ui/skeleton.tsx src/components/ui/skeleton.stories.tsx src/components/ui/__tests__/button.test.tsx src/components/ui/__tests__/badge.test.tsx src/components/ui/__tests__/skeleton.test.tsx
git commit -m "feat: add Button, Badge and Skeleton primitives with stories"
```

---

### Task 4: Avatar primitive (initials)

**Files:**

- Create: `src/components/ui/avatar.tsx`, `avatar.stories.tsx`, `src/components/ui/__tests__/avatar.test.tsx`

**Interfaces:**

- Produces: `Avatar` (`name: string`, `color: string`, `size?: 'sm' | 'md'`), rendering the name's initials on a colored circle.

- [ ] **Step 1: Write failing test** — `src/components/ui/__tests__/avatar.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { Avatar } from '../avatar'

test('shows two-letter initials for a multi-word name', () => {
  render(<Avatar name="Demo User" color="#6366f1" />)
  expect(screen.getByText('DU')).toBeInTheDocument()
})

test('shows the first two letters for a single-word name', () => {
  render(<Avatar name="Marketing" color="#ef4444" />)
  expect(screen.getByText('MA')).toBeInTheDocument()
})

test('labels the avatar with the full name for accessibility', () => {
  render(<Avatar name="Ava Patel" color="#f59e0b" />)
  expect(screen.getByLabelText('Ava Patel')).toHaveTextContent('AP')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- avatar`
Expected: FAIL — cannot find module '../avatar'.

- [ ] **Step 3: Implement** — `src/components/ui/avatar.tsx`

```tsx
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const sizes = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
}

export type AvatarProps = {
  name: string
  color: string
  size?: keyof typeof sizes
}

export function Avatar({ name, color, size = 'md' }: AvatarProps) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-medium text-white ${sizes[size]}`}
      style={{ backgroundColor: color }}
      aria-label={name}
      title={name}
    >
      {initials(name)}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- avatar`
Expected: PASS, 3 passed.

- [ ] **Step 5: Add story** — `src/components/ui/avatar.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Avatar } from './avatar'

const meta: Meta<typeof Avatar> = { component: Avatar, title: 'ui/Avatar' }
export default meta
type Story = StoryObj<typeof Avatar>

export const Default: Story = { args: { name: 'Demo User', color: '#6366f1' } }
export const Small: Story = {
  args: { name: 'Ava Patel', color: '#f59e0b', size: 'sm' },
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/avatar.tsx src/components/ui/avatar.stories.tsx src/components/ui/__tests__/avatar.test.tsx
git commit -m "feat: add Avatar primitive with initials"
```

---

### Task 5: ThemeToggle primitive

**Files:**

- Create: `src/components/ui/theme-toggle.tsx`, `theme-toggle.stories.tsx`, `src/components/ui/__tests__/theme-toggle.test.tsx`

**Interfaces:**

- Consumes: `Button` (`./button`), `useTheme` (`next-themes`), `Sun`/`Moon` (`lucide-react`).
- Produces: `ThemeToggle` (`'use client'`) — toggles light/dark.

- [ ] **Step 1: Write failing test** — `src/components/ui/__tests__/theme-toggle.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '../theme-toggle'

const setTheme = jest.fn()
let resolvedTheme = 'light'

jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}))

beforeEach(() => {
  setTheme.mockClear()
})

test('switches to dark when currently light', async () => {
  resolvedTheme = 'light'
  const user = userEvent.setup()
  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))
  expect(setTheme).toHaveBeenCalledWith('dark')
})

test('switches to light when currently dark', async () => {
  resolvedTheme = 'dark'
  const user = userEvent.setup()
  render(<ThemeToggle />)
  await user.click(screen.getByRole('button', { name: /toggle theme/i }))
  expect(setTheme).toHaveBeenCalledWith('light')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- theme-toggle`
Expected: FAIL — cannot find module '../theme-toggle'.

- [ ] **Step 3: Implement** — `src/components/ui/theme-toggle.tsx`

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from './button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? (
        isDark ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )
      ) : (
        <span className="block h-4 w-4" />
      )}
    </Button>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- theme-toggle`
Expected: PASS, 2 passed.

- [ ] **Step 5: Add story** — `src/components/ui/theme-toggle.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ThemeToggle } from './theme-toggle'

const meta: Meta<typeof ThemeToggle> = {
  component: ThemeToggle,
  title: 'ui/ThemeToggle',
}
export default meta

export const Default: StoryObj<typeof ThemeToggle> = {}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/theme-toggle.tsx src/components/ui/theme-toggle.stories.tsx src/components/ui/__tests__/theme-toggle.test.tsx
git commit -m "feat: add ThemeToggle primitive"
```

---

### Task 6: Dropdown primitive

**Files:**

- Create: `src/components/ui/dropdown.tsx`, `dropdown.stories.tsx`, `src/components/ui/__tests__/dropdown.test.tsx`

**Interfaces:**

- Produces: `Dropdown` (`'use client'`) — props `trigger: ReactNode`, `children: ReactNode`, `align?: 'left' | 'right'`. Opens on trigger click; closes on outside-click and Escape.

- [ ] **Step 1: Write failing test** — `src/components/ui/__tests__/dropdown.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dropdown } from '../dropdown'

function setup() {
  return render(
    <div>
      <Dropdown trigger={<span>Menu</span>}>
        <button role="menuitem">Log out</button>
      </Dropdown>
      <button>outside</button>
    </div>,
  )
}

test('opens on trigger click and closes on Escape', async () => {
  const user = userEvent.setup()
  setup()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()

  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('closes when clicking outside', async () => {
  const user = userEvent.setup()
  setup()
  await user.click(screen.getByRole('button', { name: 'Menu' }))
  expect(screen.getByRole('menu')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'outside' }))
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- dropdown`
Expected: FAIL — cannot find module '../dropdown'.

- [ ] **Step 3: Implement** — `src/components/ui/dropdown.tsx`

```tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

export type DropdownProps = {
  trigger: ReactNode
  children: ReactNode
  align?: 'left' | 'right'
}

export function Dropdown({
  trigger,
  children,
  align = 'right',
}: DropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute z-20 mt-1 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800 ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- dropdown`
Expected: PASS, 2 passed.

- [ ] **Step 5: Add story** — `src/components/ui/dropdown.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Dropdown } from './dropdown'

const meta: Meta<typeof Dropdown> = {
  component: Dropdown,
  title: 'ui/Dropdown',
}
export default meta

export const Default: StoryObj<typeof Dropdown> = {
  args: {
    trigger: <span className="rounded border px-3 py-1 text-sm">Open</span>,
    children: (
      <button className="w-full px-3 py-2 text-left text-sm">Log out</button>
    ),
  },
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/dropdown.tsx src/components/ui/dropdown.stories.tsx src/components/ui/__tests__/dropdown.test.tsx
git commit -m "feat: add Dropdown primitive"
```

---

### Task 7: Modal primitive (native dialog)

The `<dialog>` API is not fully implemented in jsdom, so the test needs a tiny polyfill in `jest.setup.ts`.

**Files:**

- Create: `src/components/ui/modal.tsx`, `modal.stories.tsx`, `src/components/ui/__tests__/modal.test.tsx`
- Modify: `jest.setup.ts` (dialog polyfill)

**Interfaces:**

- Produces: `Modal` (`'use client'`) — props `open: boolean`, `onClose: () => void`, `title?: string`, `children: ReactNode`.

- [ ] **Step 1: Add the jsdom `<dialog>` polyfill** — append to `jest.setup.ts`

```ts
// jsdom does not implement HTMLDialogElement.showModal/close — polyfill for tests.
if (typeof HTMLDialogElement !== 'undefined') {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.open = true
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.open = false
      this.dispatchEvent(new Event('close'))
    }
  }
}
```

- [ ] **Step 2: Write failing test** — `src/components/ui/__tests__/modal.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Modal } from '../modal'

function Harness() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Details">
        <p>Body content</p>
      </Modal>
    </div>
  )
}

test('opens the dialog when open becomes true', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.getByRole('dialog', { hidden: true })).not.toHaveAttribute(
    'open',
  )
  await user.click(screen.getByRole('button', { name: 'open' }))
  expect(screen.getByRole('dialog')).toHaveAttribute('open')
  expect(screen.getByText('Body content')).toBeInTheDocument()
})

test('calls onClose when the dialog emits close (Escape)', async () => {
  const onClose = jest.fn()
  render(
    <Modal open onClose={onClose} title="Details">
      <p>Body</p>
    </Modal>,
  )
  screen.getByRole('dialog').dispatchEvent(new Event('close'))
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- modal`
Expected: FAIL — cannot find module '../modal'.

- [ ] **Step 4: Implement** — `src/components/ui/modal.tsx`

```tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export type ModalProps = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      className="m-auto w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 text-gray-900 backdrop:bg-black/50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
    >
      {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
      {children}
    </dialog>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- modal`
Expected: PASS, 2 passed.

- [ ] **Step 6: Add story** — `src/components/ui/modal.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { Modal } from './modal'

const meta: Meta<typeof Modal> = { component: Modal, title: 'ui/Modal' }
export default meta

export const Default: StoryObj<typeof Modal> = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <div>
        <button onClick={() => setOpen(true)}>Open modal</button>
        <Modal open={open} onClose={() => setOpen(false)} title="Ticket">
          <p className="text-sm">Modal body content.</p>
        </Modal>
      </div>
    )
  },
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/modal.tsx src/components/ui/modal.stories.tsx src/components/ui/__tests__/modal.test.tsx jest.setup.ts
git commit -m "feat: add Modal primitive on the native dialog element"
```

---

### Task 8: Navigation config and Sidenav

**Files:**

- Create: `src/config/navigation.ts`, `src/components/layout/sidenav.tsx`, `sidenav.stories.tsx`, `src/components/layout/__tests__/sidenav.test.tsx`

**Interfaces:**

- Produces: `NavItem` type, `sidenavItems: NavItem[]`; `Sidenav` (`'use client'`) rendering the config with active-link highlight.

- [ ] **Step 1: Create the config** — `src/config/navigation.ts`

```ts
import { LayoutDashboard, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const sidenavItems: NavItem[] = [
  { label: 'Boards', href: '/boards', icon: LayoutDashboard },
]
```

- [ ] **Step 2: Write failing test** — `src/components/layout/__tests__/sidenav.test.tsx`

```tsx
import { render, screen } from '@testing-library/react'
import { Sidenav } from '../sidenav'

let pathname = '/boards'
jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}))

test('marks the item matching the current path as current', () => {
  pathname = '/boards'
  render(<Sidenav />)
  expect(screen.getByRole('link', { name: /boards/i })).toHaveAttribute(
    'aria-current',
    'page',
  )
})

test('does not mark items on an unrelated path', () => {
  pathname = '/settings'
  render(<Sidenav />)
  expect(screen.getByRole('link', { name: /boards/i })).not.toHaveAttribute(
    'aria-current',
  )
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- sidenav`
Expected: FAIL — cannot find module '../sidenav'.

- [ ] **Step 4: Implement** — `src/components/layout/sidenav.tsx`

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { sidenavItems } from '@/config/navigation'

export function Sidenav() {
  const pathname = usePathname()

  return (
    <nav className="flex w-56 flex-col gap-1 border-r border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
      {sidenavItems.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/')
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sidenav`
Expected: PASS, 2 passed.

- [ ] **Step 6: Add story** — `src/components/layout/sidenav.stories.tsx`

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Sidenav } from './sidenav'

const meta: Meta<typeof Sidenav> = {
  component: Sidenav,
  title: 'layout/Sidenav',
  parameters: { layout: 'fullscreen', nextjs: { appDirectory: true } },
}
export default meta

export const Default: StoryObj<typeof Sidenav> = {}
```

- [ ] **Step 7: Commit**

```bash
git add src/config/navigation.ts src/components/layout/sidenav.tsx src/components/layout/sidenav.stories.tsx src/components/layout/__tests__/sidenav.test.tsx
git commit -m "feat: add navigation config and Sidenav"
```

---

### Task 9: Navbar

**Files:**

- Create: `src/components/layout/navbar.tsx`, `navbar.stories.tsx`, `src/components/layout/__tests__/navbar.test.tsx`

**Interfaces:**

- Consumes: `Avatar`, `Dropdown`, `ThemeToggle` (`@/components/ui/*`), `logout` (`@/actions/auth`).
- Produces: `NavbarUser = { name: string; email: string; avatarColor: string }`; `Navbar` (`{ user: NavbarUser }`) — server component rendering the shell top bar.

- [ ] **Step 1: Write failing test** — `src/components/layout/__tests__/navbar.test.tsx`

The test mocks `@/actions/auth` (so the `logout` server action's `jose`/bcrypt chain never loads) and `next-themes` (so `ThemeToggle` renders without a provider):

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navbar } from '../navbar'

jest.mock('@/actions/auth', () => ({ logout: jest.fn() }))
jest.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: jest.fn() }),
}))

const user = {
  name: 'Demo User',
  email: 'demo@example.com',
  avatarColor: '#6366f1',
}

test('renders the app name and the user avatar', () => {
  render(<Navbar user={user} />)
  expect(screen.getByText('Jira Clone')).toBeInTheDocument()
  expect(screen.getByLabelText('Demo User')).toBeInTheDocument()
})

test('reveals the user details and a logout control when the menu opens', async () => {
  const u = userEvent.setup()
  render(<Navbar user={user} />)
  await u.click(screen.getByLabelText('Demo User'))
  expect(screen.getByText('demo@example.com')).toBeInTheDocument()
  expect(screen.getByRole('menuitem', { name: /log out/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- navbar`
Expected: FAIL — cannot find module '../navbar'.

- [ ] **Step 3: Implement** — `src/components/layout/navbar.tsx`

```tsx
import { logout } from '@/actions/auth'
import { Avatar } from '@/components/ui/avatar'
import { Dropdown } from '@/components/ui/dropdown'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export type NavbarUser = {
  name: string
  email: string
  avatarColor: string
}

export function Navbar({ user }: { user: NavbarUser }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Jira Clone
      </span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Dropdown
          trigger={<Avatar name={user.name} color={user.avatarColor} />}
        >
          <div className="px-3 py-2 text-sm">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {user.name}
            </p>
            <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Log out
            </button>
          </form>
        </Dropdown>
      </div>
    </header>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- navbar`
Expected: PASS, 2 passed.

- [ ] **Step 5: Add story** — `src/components/layout/navbar.stories.tsx`

The story mocks the logout action via Storybook module aliasing is overkill; instead render the Navbar with a user and rely on the real action import (Storybook's vite build can resolve it). Keep it simple:

```tsx
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Navbar } from './navbar'

const meta: Meta<typeof Navbar> = {
  component: Navbar,
  title: 'layout/Navbar',
  parameters: { layout: 'fullscreen' },
  args: {
    user: {
      name: 'Demo User',
      email: 'demo@example.com',
      avatarColor: '#6366f1',
    },
  },
}
export default meta

export const Default: StoryObj<typeof Navbar> = {}
```

> If the Storybook build errors on the `@/actions/auth` (`server-only`/`jose`) import chain, add `src/components/layout/navbar.stories.tsx` to the risk notes and skip the Navbar story (the RTL test already covers it); do not block the phase on it.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/navbar.tsx src/components/layout/navbar.stories.tsx src/components/layout/__tests__/navbar.test.tsx
git commit -m "feat: add Navbar with theme toggle and user menu"
```

---

### Task 10: Wire the shell into the (app) layout + verify

**Files:**

- Modify: `src/app/(app)/layout.tsx`

**Interfaces:**

- Consumes: `getCurrentUser` (`@/lib/dal/auth`), `Sidenav`, `Navbar` (`@/components/layout/*`).

- [ ] **Step 1: Replace the pass-through layout with the shell** — `src/app/(app)/layout.tsx`

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal/auth'
import { Navbar } from '@/components/layout/navbar'
import { Sidenav } from '@/components/layout/sidenav'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-full">
      <Sidenav />
      <div className="flex flex-1 flex-col">
        <Navbar
          user={{
            name: user.name,
            email: user.email,
            avatarColor: user.avatarColor,
          }}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Simplify the boards page** (the shell now owns the layout; drop the duplicate logout/heading chrome) — `src/app/(app)/boards/page.tsx`

```tsx
export default function BoardsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Boards
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        The board list arrives in Phase 5.
      </p>
    </div>
  )
}
```

(The auth gate now lives in the `(app)` layout via `getCurrentUser()`, so the page no longer needs its own check.)

- [ ] **Step 3: Full gate**

```bash
npm run lint && npm run format:check && npm run typecheck && npm test && npm run build && npm run build-storybook
```

Expected: all exit 0. (`format:check` will flag the git-ignored `.superpowers/` scratch dir locally — that's fine, it isn't in CI; confirm no tracked source file is flagged.)

- [ ] **Step 4: Manual smoke test**

```bash
npm run db:up && npx prisma migrate deploy && npx prisma db seed
npm run dev
```

- Log in with `demo@example.com` / `demo1234` → `/boards` now shows the Sidenav + Navbar shell.
- Click the theme toggle → the whole shell switches light/dark and persists on reload.
- Open the avatar menu → shows the user's name/email → **Log out** returns to `/login`.

Stop the dev server. If anything fails, STOP and report.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/boards/page.tsx"
git commit -m "feat: wire the app shell (Sidenav + Navbar) into the (app) layout"
```

---

## Done Criteria (Phase 4)

- `lint`, `format:check`, `typecheck`, `test`, `build`, `build-storybook` all green.
- Every `components/ui` primitive has a story and an RTL test; Storybook shows them with a working light/dark toggle.
- Login lands on the shell around `/boards`; the theme toggle switches + persists; the user menu logs out.
- No component imports Prisma; dark mode uses the `.dark` class strategy.

**Next plan:** Phase 5 (read-only Kanban board, then drag-and-drop with optimistic moves).

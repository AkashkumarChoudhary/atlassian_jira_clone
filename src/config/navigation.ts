import { LayoutDashboard, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const sidenavItems: NavItem[] = [
  { label: 'Boards', href: '/boards', icon: LayoutDashboard },
]

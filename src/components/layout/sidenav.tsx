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

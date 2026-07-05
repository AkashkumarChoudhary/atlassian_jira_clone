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

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

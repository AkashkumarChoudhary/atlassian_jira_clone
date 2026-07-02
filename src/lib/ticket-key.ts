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

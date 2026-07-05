import type { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'

export type Columns = Record<Status, BoardTicket[]>

export function moveTicketInColumns(
  columns: Columns,
  move: { ticketId: string; toStatus: Status; toIndex: number },
): Columns {
  const { ticketId, toStatus, toIndex } = move

  let fromStatus: Status | undefined
  let ticket: BoardTicket | undefined
  for (const status of Object.keys(columns) as Status[]) {
    const found = columns[status].find((c) => c.id === ticketId)
    if (found) {
      fromStatus = status
      ticket = found
      break
    }
  }
  if (!ticket || !fromStatus) return columns

  // Remove from the source column.
  const result: Columns = {
    ...columns,
    [fromStatus]: columns[fromStatus].filter((c) => c.id !== ticketId),
  }

  // Insert into the destination column at a clamped index.
  const dest = [...result[toStatus]]
  const index = Math.max(0, Math.min(toIndex, dest.length))
  dest.splice(index, 0, { ...ticket, status: toStatus })
  result[toStatus] = dest

  return result
}

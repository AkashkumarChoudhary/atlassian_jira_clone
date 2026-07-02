import type { Status } from '@prisma/client'
import { prisma } from '../prisma'

/**
 * Persists a ticket move: sets the ticket's status and densely reindexes the
 * destination column (and, on a cross-column move, the source column) so
 * positions stay gapless `0..n`. Returns the board slug for revalidation, or
 * null if the ticket no longer exists. All Prisma access for moves lives here.
 */
export async function moveTicketPositions(
  ticketId: string,
  toStatus: Status,
  toIndex: number,
): Promise<{ slug: string } | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true,
      boardId: true,
      status: true,
      board: { select: { slug: true } },
    },
  })
  if (!ticket) return null
  const fromStatus = ticket.status

  await prisma.$transaction(async (tx) => {
    // Destination column without the moved ticket, in order.
    const dest = await tx.ticket.findMany({
      where: {
        boardId: ticket.boardId,
        status: toStatus,
        id: { not: ticket.id },
      },
      orderBy: { position: 'asc' },
      select: { id: true },
    })
    const destIds = dest.map((d) => d.id)
    const index = Math.max(0, Math.min(toIndex, destIds.length))
    destIds.splice(index, 0, ticket.id)

    for (let position = 0; position < destIds.length; position++) {
      await tx.ticket.update({
        where: { id: destIds[position] },
        data: { position, status: toStatus },
      })
    }

    // Cross-column move: close the gap in the source column.
    if (fromStatus !== toStatus) {
      const source = await tx.ticket.findMany({
        where: { boardId: ticket.boardId, status: fromStatus },
        orderBy: { position: 'asc' },
        select: { id: true },
      })
      for (let position = 0; position < source.length; position++) {
        await tx.ticket.update({
          where: { id: source[position].id },
          data: { position },
        })
      }
    }
  })

  return { slug: ticket.board.slug }
}

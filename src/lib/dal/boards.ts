import { Status } from '@prisma/client'
import { prisma } from '../prisma'

export function getBoards() {
  return prisma.board.findMany({ orderBy: { name: 'asc' } })
}

export async function getBoardWithTickets(slug: string) {
  const board = await prisma.board.findUnique({
    where: { slug },
    include: {
      epics: true,
      tickets: {
        orderBy: { position: 'asc' },
        include: {
          assignee: { select: { id: true, name: true, avatarColor: true } },
          labels: true,
          epic: true,
        },
      },
    },
  })
  if (!board) return null

  const { tickets, ...rest } = board
  return {
    ...rest,
    columns: {
      TODO: tickets.filter((t) => t.status === Status.TODO),
      IN_PROGRESS: tickets.filter((t) => t.status === Status.IN_PROGRESS),
      DONE: tickets.filter((t) => t.status === Status.DONE),
    },
  }
}

export type BoardWithTickets = NonNullable<
  Awaited<ReturnType<typeof getBoardWithTickets>>
>
export type BoardTicket = BoardWithTickets['columns']['TODO'][number]

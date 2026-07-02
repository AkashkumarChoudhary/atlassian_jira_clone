import { Status } from '@prisma/client'
import type { BoardTicket } from '@/lib/dal/boards'
import { moveTicketInColumns, type Columns } from '../move'

const t = (id: string, status: Status): BoardTicket =>
  ({ id, status }) as unknown as BoardTicket

function cols(todo: string[], inProgress: string[], done: string[]): Columns {
  return {
    TODO: todo.map((id) => t(id, Status.TODO)),
    IN_PROGRESS: inProgress.map((id) => t(id, Status.IN_PROGRESS)),
    DONE: done.map((id) => t(id, Status.DONE)),
  }
}

const ids = (list: BoardTicket[]) => list.map((x) => x.id)

test('moves a ticket down within its column', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'a',
    toStatus: Status.TODO,
    toIndex: 2,
  })
  expect(ids(next.TODO)).toEqual(['b', 'c', 'a'])
})

test('moves a ticket up within its column', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'c',
    toStatus: Status.TODO,
    toIndex: 0,
  })
  expect(ids(next.TODO)).toEqual(['c', 'a', 'b'])
})

test('same-position move is a no-op ordering', () => {
  const next = moveTicketInColumns(cols(['a', 'b', 'c'], [], []), {
    ticketId: 'b',
    toStatus: Status.TODO,
    toIndex: 1,
  })
  expect(ids(next.TODO)).toEqual(['a', 'b', 'c'])
})

test('moves across columns, reindexing both', () => {
  const next = moveTicketInColumns(cols(['a', 'b'], ['x', 'y'], []), {
    ticketId: 'a',
    toStatus: Status.IN_PROGRESS,
    toIndex: 1,
  })
  expect(ids(next.TODO)).toEqual(['b'])
  expect(ids(next.IN_PROGRESS)).toEqual(['x', 'a', 'y'])
  expect(next.IN_PROGRESS.find((c) => c.id === 'a')?.status).toBe(
    Status.IN_PROGRESS,
  )
})

test('moves into an empty column', () => {
  const next = moveTicketInColumns(cols(['a'], [], []), {
    ticketId: 'a',
    toStatus: Status.DONE,
    toIndex: 0,
  })
  expect(ids(next.TODO)).toEqual([])
  expect(ids(next.DONE)).toEqual(['a'])
})

test('moves to the end of a column (index === length)', () => {
  const next = moveTicketInColumns(cols(['a'], ['x', 'y'], []), {
    ticketId: 'a',
    toStatus: Status.IN_PROGRESS,
    toIndex: 2,
  })
  expect(ids(next.IN_PROGRESS)).toEqual(['x', 'y', 'a'])
})

test('returns the input unchanged for an unknown ticket', () => {
  const input = cols(['a'], [], [])
  const next = moveTicketInColumns(input, {
    ticketId: 'zzz',
    toStatus: Status.DONE,
    toIndex: 0,
  })
  expect(next).toBe(input)
})

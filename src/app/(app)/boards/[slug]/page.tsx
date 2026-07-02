import { notFound } from 'next/navigation'
import { getBoardWithTickets } from '@/lib/dal/boards'
import { getTicketFormOptions } from '@/lib/dal/tickets'
import { NewTicketButton } from '@/components/tickets/new-ticket-button'
import { BoardView } from '@/components/board/board-view'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const board = await getBoardWithTickets(slug)
  if (!board) notFound()
  const options = await getTicketFormOptions(slug)

  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {board.name}
        </h1>
        {options && <NewTicketButton boardId={board.id} options={options} />}
      </div>
      <BoardView board={board} />
    </div>
  )
}

import { notFound } from 'next/navigation'
import { getBoardWithTickets } from '@/lib/dal/boards'
import { BoardView } from '@/components/board/board-view'

export default async function BoardPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const board = await getBoardWithTickets(slug)
  if (!board) notFound()

  return <BoardView board={board} />
}

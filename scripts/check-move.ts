import { getBoardWithTickets } from '../src/lib/dal/boards'
import { moveTicketPositions } from '../src/lib/dal/tickets'
import { prisma } from '../src/lib/prisma'

// Live smoke check for the ticket-move persistence path (the drag gesture is
// not E2E-testable). Runs after the seed; asserts a cross-column move persists
// and leaves both columns densely reindexed (0..n).
async function main() {
  const slug = 'website-redesign'
  const before = await getBoardWithTickets(slug)
  if (!before) throw new Error(`board not found: ${slug}`)

  const ticket = before.columns.TODO[0]
  if (!ticket) throw new Error('no TODO ticket to move')
  const todoBefore = before.columns.TODO.length
  const doneBefore = before.columns.DONE.length

  const result = await moveTicketPositions(ticket.id, 'DONE', 0)
  if (!result) throw new Error('move returned null')
  if (result.slug !== slug) throw new Error(`wrong slug: ${result.slug}`)

  const after = await getBoardWithTickets(slug)
  if (!after) throw new Error('board vanished after move')

  if (after.columns.DONE[0]?.id !== ticket.id) {
    throw new Error('moved ticket is not at the top of DONE')
  }
  if (after.columns.TODO.length !== todoBefore - 1) {
    throw new Error('source column count did not shrink by one')
  }
  if (after.columns.DONE.length !== doneBefore + 1) {
    throw new Error('destination column count did not grow by one')
  }

  const gapless = (list: { position: number }[]) =>
    list.every((t, i) => t.position === i)
  if (!gapless(after.columns.TODO))
    throw new Error('TODO not gapless after move')
  if (!gapless(after.columns.DONE))
    throw new Error('DONE not gapless after move')

  console.log(
    `moved ${ticket.key} TODO->DONE[0]; todo=${after.columns.TODO.length} done=${after.columns.DONE.length}; both gapless: ok`,
  )
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

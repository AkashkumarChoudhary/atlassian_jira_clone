import { getBoards, getBoardWithTickets } from '../src/lib/dal/boards'
import { getUsers } from '../src/lib/dal/users'

async function main() {
  const users = await getUsers()
  const boards = await getBoards()
  console.log(`users: ${users.length}, boards: ${boards.length}`)

  for (const b of boards) {
    const full = await getBoardWithTickets(b.slug)
    if (!full) throw new Error(`board not found by slug: ${b.slug}`)
    const counts = `todo=${full.columns.TODO.length} in_progress=${full.columns.IN_PROGRESS.length} done=${full.columns.DONE.length}`
    console.log(`${full.prefix} ${full.name}: ${counts}`)
  }

  const missing = await getBoardWithTickets('does-not-exist')
  if (missing !== null) throw new Error('expected null for unknown slug')
  console.log('unknown slug returns null: ok')
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e)
    process.exit(1)
  },
)

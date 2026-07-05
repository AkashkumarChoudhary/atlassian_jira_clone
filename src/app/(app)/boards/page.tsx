import Link from 'next/link'
import { getBoards } from '@/lib/dal/boards'

export default async function BoardsPage() {
  const boards = await getBoards()

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
        Boards
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/boards/${board.slug}`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-indigo-400 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-indigo-500"
          >
            <div className="flex items-center gap-2">
              <span className="rounded bg-indigo-100 px-2 py-0.5 font-mono text-xs text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {board.prefix}
              </span>
              <h2 className="font-medium text-gray-900 dark:text-gray-100">
                {board.name}
              </h2>
            </div>
            {board.description && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {board.description}
              </p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

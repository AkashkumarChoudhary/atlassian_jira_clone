import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal/auth'
import { logout } from '@/actions/auth'

export default async function BoardsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Boards
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Signed in as {user.name} ({user.email}). The board list arrives in Phase
        5.
      </p>
      <form action={logout} className="mt-6">
        <button
          type="submit"
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
        >
          Log out
        </button>
      </form>
    </main>
  )
}

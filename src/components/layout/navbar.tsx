import { logout } from '@/actions/auth'
import { Avatar } from '@/components/ui/avatar'
import { Dropdown } from '@/components/ui/dropdown'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export type NavbarUser = {
  name: string
  email: string
  avatarColor: string
}

export function Navbar({ user }: { user: NavbarUser }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-950">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Jira Clone
      </span>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Dropdown
          trigger={<Avatar name={user.name} color={user.avatarColor} />}
        >
          <div className="px-3 py-2 text-sm">
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {user.name}
            </p>
            <p className="text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="w-full rounded px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Log out
            </button>
          </form>
        </Dropdown>
      </div>
    </header>
  )
}

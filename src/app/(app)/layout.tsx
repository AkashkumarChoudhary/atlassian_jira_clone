import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal/auth'
import { Navbar } from '@/components/layout/navbar'
import { Sidenav } from '@/components/layout/sidenav'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen">
      <Sidenav />
      <div className="flex flex-1 flex-col">
        <Navbar
          user={{
            name: user.name,
            email: user.email,
            avatarColor: user.avatarColor,
          }}
        />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}

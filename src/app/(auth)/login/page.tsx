import { redirect } from 'next/navigation'
import { getSessionPayload } from '@/lib/session'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await getSessionPayload()
  if (session?.userId) {
    redirect('/boards')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 dark:bg-gray-950">
      <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Sign in
        </h1>
        <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          Demo login: demo@example.com / demo1234
        </p>
        <LoginForm />
      </div>
    </main>
  )
}

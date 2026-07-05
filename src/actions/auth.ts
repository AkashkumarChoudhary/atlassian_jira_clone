'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/schemas/auth'
import { getUserByEmail } from '@/lib/dal/users'
import { createSession, deleteSession } from '@/lib/session'

// A fixed hash to compare against when the email is unknown, so login response
// timing does not reveal whether an account exists (mitigates user enumeration).
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('login-timing-equalizer', 10)

export type LoginState =
  | {
      error?: string
      fieldErrors?: { email?: string[]; password?: string[] }
    }
  | undefined

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const user = await getUserByEmail(parsed.data.email)
  const passwordMatches = await bcrypt.compare(
    parsed.data.password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  )
  if (!user || !passwordMatches) {
    return { error: 'Invalid email or password.' }
  }

  await createSession(user.id)
  redirect('/boards')
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}

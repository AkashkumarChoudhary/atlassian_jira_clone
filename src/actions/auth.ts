'use server'

import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { loginSchema } from '@/schemas/auth'
import { getUserByEmail } from '@/lib/dal/users'
import { createSession, deleteSession } from '@/lib/session'

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
  if (!user || !bcrypt.compareSync(parsed.data.password, user.passwordHash)) {
    return { error: 'Invalid email or password.' }
  }

  await createSession(user.id)
  redirect('/boards')
}

export async function logout(): Promise<void> {
  await deleteSession()
  redirect('/login')
}

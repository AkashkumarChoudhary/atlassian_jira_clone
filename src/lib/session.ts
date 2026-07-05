import 'server-only'
import { cookies } from 'next/headers'
import {
  decrypt,
  encrypt,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from './jwt'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
  const token = await encrypt({ userId, expiresAt: expiresAt.toISOString() })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  return decrypt(token)
}

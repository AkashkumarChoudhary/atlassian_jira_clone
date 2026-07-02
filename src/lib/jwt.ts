import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE_NAME = 'session'

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET)

export type SessionPayload = {
  userId: string
  expiresAt: string
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    })
    if (typeof payload.userId !== 'string') return null
    return {
      userId: payload.userId,
      expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
    }
  } catch {
    return null
  }
}

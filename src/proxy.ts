import { NextRequest, NextResponse } from 'next/server'
import { decrypt, SESSION_COOKIE_NAME } from '@/lib/jwt'

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isLoginRoute = path === '/login'

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  const session = await decrypt(token)

  // Optimistic checks only — the real auth boundary is verifySession() in the DAL.
  if (!session?.userId && !isLoginRoute) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }

  if (session?.userId && isLoginRoute) {
    return NextResponse.redirect(new URL('/boards', req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

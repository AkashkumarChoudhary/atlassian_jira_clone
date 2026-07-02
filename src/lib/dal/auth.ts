import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getSessionPayload } from '../session'
import { prisma } from '../prisma'

export const verifySession = cache(async () => {
  const session = await getSessionPayload()
  if (!session?.userId) {
    redirect('/login')
  }
  return { userId: session.userId }
})

export const getCurrentUser = cache(async () => {
  const { userId } = await verifySession()
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, avatarColor: true },
  })
})

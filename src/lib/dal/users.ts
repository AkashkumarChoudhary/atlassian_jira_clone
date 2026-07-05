import { prisma } from '../prisma'

export function getUsers() {
  return prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, avatarColor: true },
  })
}

export function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } })
}

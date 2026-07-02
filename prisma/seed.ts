import { PrismaClient, Priority, Status } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { deriveBoardPrefix, formatTicketKey } from '../src/lib/ticket-key'

const prisma = new PrismaClient()

const USERS = [
  { name: 'Demo User', email: 'demo@example.com', avatarColor: '#6366f1' },
  { name: 'Ava Patel', email: 'ava@example.com', avatarColor: '#f59e0b' },
  { name: 'Liam Chen', email: 'liam@example.com', avatarColor: '#10b981' },
  { name: 'Sofia Garcia', email: 'sofia@example.com', avatarColor: '#ef4444' },
  { name: 'Noah Kim', email: 'noah@example.com', avatarColor: '#3b82f6' },
]

const LABELS = [
  { name: 'bug', color: '#ef4444' },
  { name: 'feature', color: '#22c55e' },
  { name: 'chore', color: '#64748b' },
  { name: 'design', color: '#a855f7' },
]

// One entry per ticket: [title, status, priority, epicIndex | null]
type TicketSpec = [string, Status, Priority, number | null]

const BOARDS: {
  name: string
  description: string
  epics: { name: string; color: string }[]
  tickets: TicketSpec[]
}[] = [
  {
    name: 'Website Redesign',
    description: 'Marketing site refresh for the Q3 launch',
    epics: [
      { name: 'Landing page', color: '#6366f1' },
      { name: 'Design system', color: '#a855f7' },
    ],
    tickets: [
      ['Audit current page performance', 'DONE', 'MEDIUM', 0],
      ['Define new color tokens', 'DONE', 'HIGH', 1],
      ['Build hero section', 'IN_PROGRESS', 'HIGH', 0],
      ['Implement responsive nav', 'IN_PROGRESS', 'MEDIUM', 1],
      ['Fix CLS regression on mobile', 'TODO', 'URGENT', 0],
      ['Write pricing page copy', 'TODO', 'LOW', null],
      ['Add dark mode support', 'TODO', 'MEDIUM', 1],
      ['Set up A/B test for CTA', 'TODO', 'LOW', null],
    ],
  },
  {
    name: 'Mobile App',
    description: 'iOS and Android client',
    epics: [
      { name: 'Onboarding', color: '#10b981' },
      { name: 'Push notifications', color: '#f59e0b' },
    ],
    tickets: [
      ['Design onboarding flow', 'DONE', 'HIGH', 0],
      ['Crash on login with emoji password', 'IN_PROGRESS', 'URGENT', null],
      ['Implement signup screen', 'IN_PROGRESS', 'HIGH', 0],
      ['Register device tokens', 'TODO', 'MEDIUM', 1],
      ['Notification preferences screen', 'TODO', 'MEDIUM', 1],
      ['Upgrade React Native version', 'TODO', 'LOW', null],
      ['Add biometric unlock', 'TODO', 'LOW', 0],
      ['Deep links open wrong screen', 'TODO', 'HIGH', null],
    ],
  },
  {
    name: 'Marketing',
    description: 'Campaigns, content and analytics',
    epics: [{ name: 'Q3 campaign', color: '#ef4444' }],
    tickets: [
      ['Draft launch announcement', 'DONE', 'MEDIUM', 0],
      ['Book conference booth', 'DONE', 'LOW', null],
      ['Produce demo video', 'IN_PROGRESS', 'HIGH', 0],
      ['Set up UTM dashboard', 'IN_PROGRESS', 'MEDIUM', null],
      ['Write customer case study', 'TODO', 'MEDIUM', 0],
      ['Refresh email templates', 'TODO', 'LOW', null],
      ['Plan webinar series', 'TODO', 'MEDIUM', 0],
      ['Competitor pricing analysis', 'TODO', 'HIGH', null],
    ],
  },
]

const COMMENT_BODIES = [
  'I can pick this up tomorrow.',
  'Blocked on the design review — pinged the channel.',
  'Done on my branch, opening a PR shortly.',
]

async function main() {
  // Delete in FK-dependency order
  await prisma.comment.deleteMany()
  await prisma.ticket.deleteMany()
  await prisma.epic.deleteMany()
  await prisma.label.deleteMany()
  await prisma.board.deleteMany()
  await prisma.user.deleteMany()

  const passwordHash = bcrypt.hashSync('demo1234', 10)
  const users = []
  for (const u of USERS) {
    users.push(await prisma.user.create({ data: { ...u, passwordHash } }))
  }

  const labels = []
  for (const l of LABELS) {
    labels.push(await prisma.label.create({ data: l }))
  }

  let ticketCount = 0
  let commentCount = 0

  for (const boardSpec of BOARDS) {
    const board = await prisma.board.create({
      data: {
        name: boardSpec.name,
        slug: boardSpec.name.toLowerCase().replace(/\s+/g, '-'),
        prefix: deriveBoardPrefix(boardSpec.name),
        description: boardSpec.description,
      },
    })

    const epics = []
    for (const e of boardSpec.epics) {
      epics.push(
        await prisma.epic.create({ data: { ...e, boardId: board.id } }),
      )
    }

    const positionByStatus: Record<Status, number> = {
      TODO: 0,
      IN_PROGRESS: 0,
      DONE: 0,
    }
    let counter = 0

    for (const [title, status, priority, epicIndex] of boardSpec.tickets) {
      counter += 1
      const ticket = await prisma.ticket.create({
        data: {
          key: formatTicketKey(board.prefix, counter),
          title,
          description: `Details for "${title}". Seeded for demo purposes.`,
          status,
          priority,
          position: positionByStatus[status]++,
          boardId: board.id,
          reporterId: users[ticketCount % users.length].id,
          assigneeId:
            ticketCount % 3 === 0
              ? null
              : users[(ticketCount + 1) % users.length].id,
          epicId: epicIndex === null ? null : epics[epicIndex].id,
          labels: { connect: [{ id: labels[ticketCount % labels.length].id }] },
        },
      })
      ticketCount += 1

      if (ticketCount % 2 === 0) {
        await prisma.comment.create({
          data: {
            body: COMMENT_BODIES[commentCount % COMMENT_BODIES.length],
            ticketId: ticket.id,
            authorId: users[commentCount % users.length].id,
          },
        })
        commentCount += 1
      }
    }

    await prisma.board.update({
      where: { id: board.id },
      data: { ticketCounter: counter },
    })
  }

  console.log(
    `Seeded ${users.length} users, ${BOARDS.length} boards, ${labels.length} labels, ${ticketCount} tickets, ${commentCount} comments`,
  )
  console.log('Demo login: demo@example.com / demo1234')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())

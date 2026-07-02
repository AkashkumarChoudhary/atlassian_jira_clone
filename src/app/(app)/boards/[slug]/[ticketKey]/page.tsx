import { notFound } from 'next/navigation'
import { getTicketByKey, getTicketFormOptions } from '@/lib/dal/tickets'
import { TicketDetail } from '@/components/tickets/ticket-detail'

export default async function TicketPage({
  params,
}: {
  params: Promise<{ slug: string; ticketKey: string }>
}) {
  const { slug, ticketKey } = await params
  const [ticket, options] = await Promise.all([
    getTicketByKey(slug, ticketKey),
    getTicketFormOptions(slug),
  ])
  if (!ticket || !options) notFound()

  return (
    <div className="mx-auto max-w-2xl p-6">
      <TicketDetail ticket={ticket} options={options} />
    </div>
  )
}

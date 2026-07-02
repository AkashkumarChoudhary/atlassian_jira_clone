import { notFound } from 'next/navigation'
import { getTicketByKey, getTicketFormOptions } from '@/lib/dal/tickets'
import { TicketDetail } from '@/components/tickets/ticket-detail'
import { TicketModal } from '@/components/tickets/ticket-modal'

export default async function TicketModalPage({
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
    <TicketModal>
      <TicketDetail ticket={ticket} options={options} />
    </TicketModal>
  )
}

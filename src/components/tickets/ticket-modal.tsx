'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'

export function TicketModal({ children }: { children: ReactNode }) {
  const router = useRouter()
  return (
    <Modal open onClose={() => router.back()}>
      {children}
    </Modal>
  )
}

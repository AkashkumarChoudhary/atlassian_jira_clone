'use client'

import { useEffect, useState } from 'react'
import { Droppable, type DroppableProps } from '@hello-pangea/dnd'

export function StrictModeDroppable({ children, ...props }: DroppableProps) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEnabled(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  if (!enabled) return null
  return <Droppable {...props}>{children}</Droppable>
}

'use client'

import { useActionState, useEffect } from 'react'
import type { TicketFormState } from '@/actions/tickets'
import type { TicketFormOptions } from '@/lib/dal/tickets'
import { Button } from '@/components/ui/button'

type Action = (
  state: TicketFormState,
  formData: FormData,
) => Promise<TicketFormState>

export type TicketFormDefaults = {
  title: string
  description: string
  status: string
  priority: string
  assigneeId: string
  epicId: string
  labelIds: string[]
}

const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const

const field =
  'w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800'
const labelCls =
  'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'

export function TicketForm({
  action,
  options,
  defaultValues,
  onSuccess,
  submitLabel,
}: {
  action: Action
  options: TicketFormOptions
  defaultValues?: TicketFormDefaults
  onSuccess?: () => void
  submitLabel: string
}) {
  const [state, formAction, pending] = useActionState<
    TicketFormState,
    FormData
  >(action, undefined)
  const d = defaultValues

  useEffect(() => {
    if (state?.ok) onSuccess?.()
  }, [state, onSuccess])

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className={labelCls}>
          Title
        </label>
        <input
          id="title"
          name="title"
          defaultValue={d?.title}
          className={field}
        />
        {state?.fieldErrors?.title && (
          <p className="mt-1 text-sm text-red-600">
            {state.fieldErrors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={labelCls}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={d?.description}
          className={field}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="status" className={labelCls}>
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={d?.status ?? 'TODO'}
            className={field}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="priority" className={labelCls}>
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={d?.priority ?? 'MEDIUM'}
            className={field}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="assigneeId" className={labelCls}>
            Assignee
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            defaultValue={d?.assigneeId ?? ''}
            className={field}
          >
            <option value="">Unassigned</option>
            {options.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label htmlFor="epicId" className={labelCls}>
            Epic
          </label>
          <select
            id="epicId"
            name="epicId"
            defaultValue={d?.epicId ?? ''}
            className={field}
          >
            <option value="">None</option>
            {options.epics.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className={labelCls}>Labels</legend>
        <div className="flex flex-wrap gap-3">
          {options.labels.map((label) => (
            <label key={label.id} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="labelIds"
                value={label.id}
                defaultChecked={d?.labelIds.includes(label.id)}
              />
              {label.name}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}

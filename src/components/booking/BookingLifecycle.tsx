import { Check, X } from 'lucide-react'
import { logEvent } from '@/lib/logEvent'
import { setBookingStatus } from '@/lib/queries'
import { cn } from '@/lib/utils'
import type { AppRole, Booking, BookingStatus } from '@/types/db'

/**
 * One place that decides what a booking is allowed to do next. Both the student
 * and the expert side read this map, so neither can invent a move the other
 * does not know about.
 */
export const NEXT_STATUS: Record<BookingStatus, BookingStatus[]> = {
  requested: ['accepted', 'declined', 'canceled'],
  accepted: ['confirmed', 'canceled', 'failed'],
  confirmed: ['in_progress', 'canceled'],
  in_progress: ['completed'],
  failed: ['confirmed', 'canceled'],
  completed: [],
  declined: [],
  canceled: [],
}

/** Plain names for the statuses, used in errors and on the rail. */
export const STATUS_LABEL: Record<BookingStatus, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  confirmed: 'Paid and confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  declined: 'Declined',
  canceled: 'Canceled',
  failed: 'Payment failed',
}

const TERMINAL_BAD: BookingStatus[] = ['declined', 'canceled', 'failed']

export function isTerminal(status: BookingStatus): boolean {
  return NEXT_STATUS[status].length === 0
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return NEXT_STATUS[from].includes(to)
}

export interface TransitionInput {
  booking: Booking
  to: BookingStatus
  actorId: string | null
  actorRole: AppRole | null
}

/**
 * Moves a booking to its next status. Illegal moves are refused before anything
 * is written, and every accepted move leaves a row in event_logs. Never throws.
 */
export async function transitionBooking({
  booking,
  to,
  actorId,
  actorRole,
}: TransitionInput): Promise<{ ok: boolean; error?: string }> {
  const from = booking.status

  if (from === to) {
    return { ok: false, error: `This booking is already ${STATUS_LABEL[to].toLowerCase()}.` }
  }

  if (!canTransition(from, to)) {
    const allowed = NEXT_STATUS[from]
    const error = allowed.length
      ? `A ${STATUS_LABEL[from].toLowerCase()} booking can only move to ${allowed
          .map((status) => STATUS_LABEL[status].toLowerCase())
          .join(', ')}.`
      : `This booking is ${STATUS_LABEL[from].toLowerCase()} and cannot change any further.`

    await logEvent({
      userId: actorId,
      role: actorRole,
      eventType: `booking_${to}`,
      entity: 'bookings',
      status: 'rejected',
      message: `Blocked ${from} -> ${to} on booking ${booking.id}`,
    })

    return { ok: false, error }
  }

  try {
    await setBookingStatus(booking.id, to)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not save the change. Try again.'
    await logEvent({
      userId: actorId,
      role: actorRole,
      eventType: `booking_${to}`,
      entity: 'bookings',
      status: 'failed',
      message,
    })
    return { ok: false, error: message }
  }

  await logEvent({
    userId: actorId,
    role: actorRole,
    eventType: `booking_${to}`,
    entity: 'bookings',
    status: 'success',
    message: `Booking ${booking.id} moved from ${from} to ${to}`,
  })

  return { ok: true }
}

/* --------------------------------- rail --------------------------------- */

const STEPS: { key: string; label: string; reached: BookingStatus[] }[] = [
  { key: 'requested', label: 'Requested', reached: ['requested', 'accepted', 'confirmed', 'in_progress', 'completed'] },
  { key: 'accepted', label: 'Accepted', reached: ['accepted', 'confirmed', 'in_progress', 'completed'] },
  { key: 'paid', label: 'Paid', reached: ['confirmed', 'in_progress', 'completed'] },
  { key: 'in_progress', label: 'In progress', reached: ['in_progress', 'completed'] },
  { key: 'completed', label: 'Completed', reached: ['completed'] },
]

/** Index of the step the booking is sitting on right now. */
function currentStep(status: BookingStatus): number {
  let index = -1
  STEPS.forEach((step, i) => {
    if (step.reached.includes(status)) index = i
  })
  return index
}

/** Five-step rail across the top of a booking. Bad endings replace it outright. */
export function BookingTimeline({
  status,
  className,
}: {
  status: BookingStatus
  className?: string
}) {
  if (TERMINAL_BAD.includes(status)) {
    const detail =
      status === 'declined'
        ? 'The expert turned this request down. Nothing was charged.'
        : status === 'canceled'
          ? 'This session was called off.'
          : 'The card did not go through, so the session is not confirmed.'

    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-card border border-status-red/20 bg-status-red/5 p-4',
          className
        )}
        role="status"
      >
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-red text-white">
          <X className="h-3 w-3" aria-hidden />
        </span>
        <div className="text-sm">
          <p className="font-medium text-red-700">{STATUS_LABEL[status]}</p>
          <p className="mt-0.5 leading-relaxed text-red-600">{detail}</p>
        </div>
      </div>
    )
  }

  const active = currentStep(status)

  return (
    <ol className={cn('flex w-full items-start', className)} aria-label="Booking progress">
      {STEPS.map((step, index) => {
        const done = index < active
        const isCurrent = index === active
        const last = index === STEPS.length - 1

        return (
          <li key={step.key} className={cn('flex min-w-0 flex-1 flex-col items-center', last && 'flex-none')}>
            <div className="flex w-full items-center">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  'transition-[background-color,box-shadow,color] duration-200 ease-out',
                  done && 'bg-expert-teal text-white',
                  isCurrent && 'bg-expert-teal text-white ring-4 ring-expert-teal/20',
                  !done && !isCurrent && 'bg-slate-100 text-slate-400'
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
              </span>
              {!last && (
                <span
                  className={cn(
                    'mx-1.5 h-0.5 flex-1 rounded-full transition-colors duration-300 ease-out',
                    done ? 'bg-expert-teal' : 'bg-slate-200'
                  )}
                  aria-hidden
                />
              )}
            </div>
            <span
              className={cn(
                'mt-2 w-full pr-2 text-left text-[11px] leading-tight',
                last && 'pr-0 text-center',
                done || isCurrent ? 'font-medium text-nexus-indigo' : 'text-slate-400'
              )}
            >
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

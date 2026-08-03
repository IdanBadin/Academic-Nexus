import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { VerifiedBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { FieldError, Label, Textarea } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { BookingConfirmedAnimation } from '@/components/lottie/Animations'
import { PageHeader } from '@/components/layout/AppLayout'
import { FORMATS } from '@/config/theme'
import { MISSING_KEY_HINT } from '@/config/env'
import { supabaseReady } from '@/lib/supabase'
import { createBooking, getAvailability, getListing } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { cn, formatCurrency, formatDate, formatTime } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { Availability, Listing, Profile } from '@/types/db'

const DAYS_AHEAD = 14
const MIN_NOTE = 10

interface DayGroup {
  key: string
  label: string
  slots: Date[]
}

/** "HH:MM:SS" -> minutes since midnight. */
function toMinutes(time: string): number {
  const [h, m] = time.split(':')
  return Number(h) * 60 + Number(m)
}

/**
 * Walk the next 14 days, match each against the expert's weekly availability,
 * and cut every matching window into duration-sized slots. Past slots drop out.
 */
function buildSlots(availability: Availability[], durationMin: number): DayGroup[] {
  if (availability.length === 0 || durationMin <= 0) return []

  const now = Date.now()
  const groups: DayGroup[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (let offset = 0; offset < DAYS_AHEAD; offset += 1) {
    const day = new Date(today)
    day.setDate(today.getDate() + offset)

    const windows = availability.filter((slot) => slot.weekday === day.getDay())
    if (windows.length === 0) continue

    const slots: Date[] = []
    for (const window of windows) {
      const start = toMinutes(window.start_time)
      const end = toMinutes(window.end_time)
      for (let minute = start; minute + durationMin <= end; minute += durationMin) {
        const slot = new Date(day)
        slot.setHours(0, minute, 0, 0)
        if (slot.getTime() > now) slots.push(slot)
      }
    }

    if (slots.length === 0) continue
    slots.sort((a, b) => a.getTime() - b.getTime())
    groups.push({
      key: day.toISOString(),
      label: formatDate(day.toISOString()),
      slots,
    })
  }

  return groups
}

export default function Book() {
  const { listingId } = useParams<{ listingId: string }>()
  const { profile } = useAuth()
  const { push } = useToast()

  const [listing, setListing] = useState<(Listing & { expert: Profile }) | null>(null)
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selected, setSelected] = useState<Date | null>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!supabaseReady || !listingId) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const row = await getListing(listingId)
        if (!alive) return
        setListing(row)
        if (row) {
          const slots = await getAvailability(row.expert_id)
          if (alive) setAvailability(slots)
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load this listing.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [listingId])

  const groups = useMemo(
    () => buildSlots(availability, listing?.duration_min ?? 0),
    [availability, listing]
  )

  const noteTooShort = note.trim().length < MIN_NOTE

  const submit = async () => {
    setTouched(true)
    if (!listing || !profile || !selected || noteTooShort) return

    setSubmitting(true)
    try {
      const booking = await createBooking({
        listing_id: listing.id,
        student_id: profile.id,
        expert_id: listing.expert_id,
        slot_datetime: selected.toISOString(),
        student_note: note.trim(),
        price: listing.price,
      })
      await logEvent({
        userId: profile.id,
        role: profile.role,
        eventType: 'booking_requested',
        entity: 'bookings',
        status: 'requested',
        message: `Requested ${listing.subject} on ${formatDate(booking.slot_datetime)}`,
      })
      setSent(true)
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'The request did not go through.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!supabaseReady) {
    return <MissingKeyNotice feature="Booking" hint={MISSING_KEY_HINT.supabase} />
  }
  if (loading) return <LoadingBlock label="Loading listing" />
  if (error) return <ErrorState message={error} />
  if (!listing) {
    return (
      <EmptyState
        title="Listing not found"
        description="This session is no longer listed. Have a look at what else is open."
        action={
          <Link to="/student/search">
            <Button variant="student">Back to search</Button>
          </Link>
        }
      />
    )
  }

  const formatLabel = FORMATS.find((f) => f.value === listing.format)?.label ?? listing.format
  const ownListing = profile?.id === listing.expert_id

  /* ------------------------------ success view ----------------------------- */
  if (sent) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="flex flex-col items-center py-10 text-center">
          <BookingConfirmedAnimation className="h-32 w-32" />
          <h2 className="mt-2 font-heading text-xl font-semibold text-nexus-indigo">
            Request sent
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
            {listing.expert.full_name ?? 'The expert'} has to accept before you pay. You will see
            the request move to accepted in My bookings, and that is when the Pay now button shows
            up.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/student/bookings">
              <Button variant="student">View my bookings</Button>
            </Link>
            <Link to="/student/search">
              <Button variant="secondary">Browse more experts</Button>
            </Link>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Request a session"
        description="Pick a time that works, say what you need, and send it over."
      />

      {/* ------------------------------ listing ------------------------------ */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to={`/student/experts/${listing.expert_id}`}
            className="flex items-center gap-3"
          >
            <Avatar name={listing.expert.full_name} url={listing.expert.avatar_url} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-base font-semibold text-nexus-indigo">
                  {listing.expert.full_name ?? 'Expert'}
                </span>
                {listing.expert.is_verified && <VerifiedBadge />}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">
                {listing.subject} · {listing.level} · {formatLabel}
              </p>
            </div>
          </Link>
          <p className="tabular text-sm text-slate-600">
            <span className="text-lg font-semibold text-nexus-indigo">
              {formatCurrency(listing.price)}
            </span>{' '}
            / {listing.duration_min} min
          </p>
        </CardBody>
      </Card>

      {ownListing ? (
        <ErrorState message="This is your own listing. You cannot book yourself." />
      ) : listing.expert.is_suspended ? (
        <ErrorState message="This expert's account is suspended, so bookings are closed for now. Try another expert from search." />
      ) : (
        <>
          {/* ---------------------------- slot picker --------------------------- */}
          <Card>
            <CardHeader
              title="Pick a time"
              description={`Times over the next ${DAYS_AHEAD} days, in ${listing.duration_min} minute blocks.`}
            />
            <CardBody>
              {groups.length === 0 ? (
                <p className="text-sm text-slate-500">
                  This expert has not posted any open hours for the next two weeks. Check their
                  profile again in a few days, or pick a different expert.
                </p>
              ) : (
                <div className="space-y-5">
                  {groups.map((group) => (
                    <div key={group.key}>
                      <p className="mb-2 text-sm font-medium text-slate-500">{group.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.slots.map((slot) => {
                          const active = selected?.getTime() === slot.getTime()
                          return (
                            <button
                              key={slot.toISOString()}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setSelected(slot)}
                              className={cn(
                                'tabular rounded-control border px-3 py-2 text-sm font-medium',
                                'transition-[background-color,color,border-color] duration-150 ease-out',
                                active
                                  ? 'border-student-amber bg-student-amber/10 text-amber-700'
                                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                              )}
                            >
                              {formatTime(
                                `${String(slot.getHours()).padStart(2, '0')}:${String(
                                  slot.getMinutes()
                                ).padStart(2, '0')}`
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* ------------------------------- note ------------------------------- */}
          <Card>
            <CardBody className="space-y-4">
              <div>
                <Label htmlFor="student-note">Describe what you need</Label>
                <Textarea
                  id="student-note"
                  rows={5}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={() => setTouched(true)}
                  placeholder="Which course is this for, which topic is giving you trouble, and what have you already tried? The more specific you are, the better the session goes."
                />
                {touched && noteTooShort && (
                  <FieldError>
                    Give this at least {MIN_NOTE} characters so the expert knows what to prepare.
                  </FieldError>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-500">
                  {selected
                    ? `You picked ${formatDate(selected.toISOString())}, ${formatTime(
                        `${String(selected.getHours()).padStart(2, '0')}:${String(
                          selected.getMinutes()
                        ).padStart(2, '0')}`
                      )}.`
                    : 'Pick a time above to continue.'}
                </p>
                <Button
                  variant="student"
                  size="lg"
                  loading={submitting}
                  disabled={!selected || noteTooShort || !profile}
                  onClick={submit}
                >
                  Send request
                </Button>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  )
}

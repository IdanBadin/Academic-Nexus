import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { FieldError, Label, Textarea } from '@/components/ui/Field'
import { RatingInput } from '@/components/ui/Rating'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, MissingKeyNotice, SkeletonCard } from '@/components/ui/States'
import { BookingConfirmedAnimation, EmptyStateAnimation } from '@/components/lottie/Animations'
import { PageHeader } from '@/components/layout/AppLayout'
import { FORMATS } from '@/config/theme'
import { MISSING_KEY_HINT } from '@/config/env'
import { supabase, supabaseReady } from '@/lib/supabase'
import { getBookingsForUser, setBookingStatus } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { payForBooking } from '@/lib/stripe'
import { addBookingToCalendar } from '@/lib/calendar'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { BookingDetail, BookingStatus } from '@/types/db'

type Tab = 'all' | 'upcoming' | 'past'

const UPCOMING: BookingStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress']
const PAST: BookingStatus[] = ['completed', 'canceled', 'declined', 'failed']

const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'Past' },
]

const MIN_REVIEW = 10

function formatLabel(value: string | undefined): string {
  if (!value) return 'Session'
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export default function Bookings() {
  const { profile } = useAuth()
  const { push } = useToast()

  const [bookings, setBookings] = useState<BookingDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')

  const [payingId, setPayingId] = useState<string | null>(null)
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const [paidOpen, setPaidOpen] = useState(false)

  const [reviewFor, setReviewFor] = useState<BookingDetail | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewTouched, setReviewTouched] = useState(false)
  const [savingReview, setSavingReview] = useState(false)

  const load = useCallback(async () => {
    if (!supabaseReady || !profile) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const rows = await getBookingsForUser(profile.id, 'student')
      setBookings(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your bookings.')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    if (tab === 'upcoming') return bookings.filter((b) => UPCOMING.includes(b.status))
    if (tab === 'past') return bookings.filter((b) => PAST.includes(b.status))
    return bookings
  }, [bookings, tab])

  /* -------------------------------- payment ------------------------------- */

  const pay = async (booking: BookingDetail) => {
    setPayingId(booking.id)
    try {
      const result = await payForBooking(booking)
      if (result.ok) {
        await setBookingStatus(booking.id, 'confirmed')
        await logEvent({
          userId: profile?.id ?? null,
          role: profile?.role ?? null,
          eventType: 'payment_succeeded',
          entity: 'bookings',
          status: 'confirmed',
          message: `Paid ${formatCurrency(booking.price)} for booking ${booking.id}${
            result.ref ? ` (ref ${result.ref})` : ''
          }`,
        })
        const calendar = await addBookingToCalendar(booking)
        if (!calendar.ok && calendar.error) {
          push('info', `Paid, but the calendar sync did not work: ${calendar.error}`)
        }
        setPaidOpen(true)
        await load()
      } else {
        await setBookingStatus(booking.id, 'failed')
        await logEvent({
          userId: profile?.id ?? null,
          role: profile?.role ?? null,
          eventType: 'payment_failed',
          entity: 'bookings',
          status: 'failed',
          message: result.error ?? 'The payment was declined.',
        })
        push('error', result.error ?? 'The payment did not go through.')
        await load()
      }
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Something broke while paying.')
    } finally {
      setPayingId(null)
    }
  }

  /* --------------------------------- cancel -------------------------------- */

  const cancel = async (booking: BookingDetail) => {
    setCancelingId(booking.id)
    try {
      await setBookingStatus(booking.id, 'canceled')
      await logEvent({
        userId: profile?.id ?? null,
        role: profile?.role ?? null,
        eventType: 'booking_canceled',
        entity: 'bookings',
        status: 'canceled',
        message: `Student canceled booking ${booking.id}`,
      })
      push('success', 'Request canceled.')
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not cancel that request.')
    } finally {
      setCancelingId(null)
    }
  }

  /* --------------------------------- review -------------------------------- */

  const openReview = (booking: BookingDetail) => {
    setReviewFor(booking)
    setRating(5)
    setReviewText('')
    setReviewTouched(false)
  }

  const submitReview = async () => {
    setReviewTouched(true)
    if (!reviewFor || !profile || reviewText.trim().length < MIN_REVIEW) return

    setSavingReview(true)
    try {
      const { error: insertError } = await supabase.from('reviews').insert({
        booking_id: reviewFor.id,
        student_id: profile.id,
        expert_id: reviewFor.expert_id,
        rating,
        text: reviewText.trim(),
      })
      if (insertError) throw insertError

      await logEvent({
        userId: profile.id,
        role: profile.role,
        eventType: 'review_submitted',
        entity: 'reviews',
        status: 'completed',
        message: `${rating} stars for booking ${reviewFor.id}`,
      })
      push('success', 'Thanks, your review is up.')
      setReviewFor(null)
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setSavingReview(false)
    }
  }

  if (!supabaseReady) {
    return (
      <div className="space-y-6">
        <PageHeader title="My bookings" description="Every session you have requested or paid for." />
        <MissingKeyNotice feature="Bookings" hint={MISSING_KEY_HINT.supabase} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My bookings"
        description="Every session you have requested or paid for."
      />

      <div role="tablist" aria-label="Filter bookings" className="flex gap-1 rounded-control bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex-1 rounded-[8px] px-3 py-2 text-sm font-medium',
              'transition-[background-color,color,box-shadow] duration-150 ease-out',
              tab === t.id
                ? 'bg-white text-nexus-indigo shadow-sm'
                : 'text-slate-500 hover:text-nexus-indigo'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          illustration={<EmptyStateAnimation className="h-32 w-32" />}
          title={tab === 'past' ? 'Nothing finished yet' : 'No bookings yet'}
          description={
            tab === 'past'
              ? 'Once a session wraps up it will show here, along with the option to leave a review.'
              : 'Search for an expert, pick a time that suits you, and send a request.'
          }
          action={
            <Link to="/student/search">
              <Button variant="student">Find an expert</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((booking) => (
            <Card key={booking.id}>
              <CardBody className="flex flex-wrap items-center gap-4">
                <Link
                  to={`/student/bookings/${booking.id}`}
                  className="flex min-w-[220px] flex-1 items-center gap-3"
                >
                  <Avatar
                    name={booking.expert?.full_name}
                    url={booking.expert?.avatar_url}
                    size="md"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-nexus-indigo">
                      {booking.expert?.full_name ?? 'Expert'}
                    </p>
                    <p className="truncate text-sm text-slate-500">
                      {booking.listing?.subject ?? 'Session'} ·{' '}
                      {formatLabel(booking.listing?.format)}
                    </p>
                  </div>
                </Link>

                <div className="tabular text-sm text-slate-600">
                  {formatDateTime(booking.slot_datetime)}
                </div>

                <div className="tabular text-sm font-semibold text-nexus-indigo">
                  {formatCurrency(booking.price)}
                </div>

                <StatusBadge status={booking.status} />

                <div className="ml-auto flex items-center gap-2">
                  {booking.status === 'accepted' && (
                    <Button
                      variant="student"
                      size="sm"
                      loading={payingId === booking.id}
                      onClick={() => pay(booking)}
                    >
                      Pay now
                    </Button>
                  )}

                  {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
                    <Link to={`/student/bookings/${booking.id}`}>
                      <Button variant="secondary" size="sm">
                        Open chat
                      </Button>
                    </Link>
                  )}

                  {booking.status === 'completed' && !booking.review && (
                    <Button variant="secondary" size="sm" onClick={() => openReview(booking)}>
                      Leave a review
                    </Button>
                  )}

                  {booking.status === 'requested' && (
                    <>
                      <span className="text-sm text-slate-400">Waiting on the expert</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={cancelingId === booking.id}
                        onClick={() => cancel(booking)}
                      >
                        Cancel request
                      </Button>
                    </>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* ------------------------------ paid modal ----------------------------- */}
      <Modal
        open={paidOpen}
        onClose={() => setPaidOpen(false)}
        title="You are booked"
        description="The session is confirmed and the chat with your expert is open."
        footer={
          <div className="flex justify-end">
            <Button variant="student" onClick={() => setPaidOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="flex justify-center py-4">
          <BookingConfirmedAnimation className="h-32 w-32" />
        </div>
      </Modal>

      {/* ----------------------------- review modal ---------------------------- */}
      <Modal
        open={reviewFor !== null}
        onClose={() => setReviewFor(null)}
        title="Leave a review"
        description={`How did the session with ${reviewFor?.expert?.full_name ?? 'your expert'} go?`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setReviewFor(null)}>
              Not now
            </Button>
            <Button variant="student" loading={savingReview} onClick={submitReview}>
              Post review
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Rating</Label>
            <div className="pt-1.5">
              <RatingInput value={rating} onChange={setRating} />
            </div>
          </div>
          <div>
            <Label htmlFor="review-text">What should other students know?</Label>
            <Textarea
              id="review-text"
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              onBlur={() => setReviewTouched(true)}
              placeholder="What did they explain well, how did they pace it, would you book them again?"
            />
            {reviewTouched && reviewText.trim().length < MIN_REVIEW && (
              <FieldError>Write at least {MIN_REVIEW} characters.</FieldError>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { StatusBadge, VerifiedBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { FieldError, Label, Textarea } from '@/components/ui/Field'
import { RatingInput } from '@/components/ui/Rating'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { PageHeader } from '@/components/layout/AppLayout'
import { BookingChat } from '@/components/chat/BookingChat'
import { FORMATS, STATUS_LABEL } from '@/config/theme'
import { MISSING_KEY_HINT } from '@/config/env'
import { supabase, supabaseReady } from '@/lib/supabase'
import { getBooking, setBookingStatus } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { BookingDetail as BookingDetailRow, BookingStatus } from '@/types/db'

const CHAT_STATUSES: BookingStatus[] = ['confirmed', 'in_progress', 'completed']
const MIN_REVIEW = 10

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { push } = useToast()

  const [booking, setBooking] = useState<BookingDetailRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const [rating, setRating] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [reviewTouched, setReviewTouched] = useState(false)
  const [savingReview, setSavingReview] = useState(false)

  const load = useCallback(async () => {
    if (!supabaseReady || !id) {
      setLoading(false)
      return
    }
    try {
      setError(null)
      const row = await getBooking(id)
      setBooking(row)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this booking.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const move = async (status: BookingStatus) => {
    if (!booking) return
    setUpdating(true)
    try {
      await setBookingStatus(booking.id, status)
      await logEvent({
        userId: profile?.id ?? null,
        role: profile?.role ?? null,
        eventType: 'booking_status_changed',
        entity: 'bookings',
        status,
        message: `Student moved booking ${booking.id} to ${STATUS_LABEL[status] ?? status}`,
      })
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not update the booking.')
    } finally {
      setUpdating(false)
    }
  }

  const submitReview = async () => {
    setReviewTouched(true)
    if (!booking || !profile || reviewText.trim().length < MIN_REVIEW) return

    setSavingReview(true)
    try {
      const { error: insertError } = await supabase.from('reviews').insert({
        booking_id: booking.id,
        student_id: profile.id,
        expert_id: booking.expert_id,
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
        message: `${rating} stars for booking ${booking.id}`,
      })
      push('success', 'Thanks, your review is up.')
      setReviewText('')
      await load()
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'Could not save your review.')
    } finally {
      setSavingReview(false)
    }
  }

  if (!supabaseReady) {
    return <MissingKeyNotice feature="Booking details" hint={MISSING_KEY_HINT.supabase} />
  }
  if (loading) return <LoadingBlock label="Loading booking" />
  if (error) return <ErrorState message={error} />
  if (!booking) {
    return (
      <EmptyState
        title="Booking not found"
        description="This booking is gone, or it was never yours to begin with."
        action={
          <Link to="/student/bookings">
            <Button variant="student">Back to my bookings</Button>
          </Link>
        }
      />
    )
  }

  const formatLabel =
    FORMATS.find((f) => f.value === booking.listing?.format)?.label ??
    booking.listing?.format ??
    'Session'
  const chatOpen = CHAT_STATUSES.includes(booking.status)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking"
        description={`${booking.listing?.subject ?? 'Session'} with ${
          booking.expert?.full_name ?? 'your expert'
        }`}
        action={
          <Link to="/student/bookings">
            <Button variant="ghost">All bookings</Button>
          </Link>
        }
      />

      {/* ------------------------------- summary ------------------------------- */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <Link
              to={`/student/experts/${booking.expert_id}`}
              className="flex items-center gap-3"
            >
              <Avatar
                name={booking.expert?.full_name}
                url={booking.expert?.avatar_url}
                size="lg"
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-base font-semibold text-nexus-indigo">
                    {booking.expert?.full_name ?? 'Expert'}
                  </span>
                  {booking.expert?.is_verified && <VerifiedBadge />}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {booking.listing?.subject ?? 'Session'} · {booking.listing?.level ?? '-'} ·{' '}
                  {formatLabel}
                </p>
              </div>
            </Link>
            <StatusBadge status={booking.status} />
          </div>

          <dl className="grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">When</dt>
              <dd className="tabular mt-1 text-sm text-nexus-indigo">
                {formatDateTime(booking.slot_datetime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-400">Price</dt>
              <dd className="tabular mt-1 text-sm text-nexus-indigo">
                {formatCurrency(booking.price)}
                {booking.listing ? ` / ${booking.listing.duration_min} min` : ''}
              </dd>
            </div>
            {booking.payment && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Payment</dt>
                <dd className="mt-1 text-sm text-nexus-indigo">
                  {STATUS_LABEL[booking.payment.status] ?? booking.payment.status}
                </dd>
              </div>
            )}
          </dl>

          {booking.student_note && (
            <div className="border-t border-slate-100 pt-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">What you asked for</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                {booking.student_note}
              </p>
            </div>
          )}

          {(booking.status === 'confirmed' || booking.status === 'in_progress') && (
            <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
              {booking.status === 'confirmed' && (
                <Button variant="student" loading={updating} onClick={() => move('in_progress')}>
                  Mark session started
                </Button>
              )}
              {booking.status === 'in_progress' && (
                <Button variant="student" loading={updating} onClick={() => move('completed')}>
                  Mark completed
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* --------------------------------- chat -------------------------------- */}
      {chatOpen ? (
        <BookingChat bookingId={booking.id} />
      ) : (
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">
              Chat opens once the expert accepts and the payment goes through. Right now this
              booking is {(STATUS_LABEL[booking.status] ?? booking.status).toLowerCase()}.
            </p>
          </CardBody>
        </Card>
      )}

      {/* -------------------------------- review ------------------------------- */}
      {booking.status === 'completed' && !booking.review && (
        <Card>
          <CardHeader
            title="Leave a review"
            description="Other students read these before they book."
          />
          <CardBody className="space-y-4">
            <div>
              <Label>Rating</Label>
              <div className="pt-1.5">
                <RatingInput value={rating} onChange={setRating} />
              </div>
            </div>
            <div>
              <Label htmlFor="detail-review-text">What should other students know?</Label>
              <Textarea
                id="detail-review-text"
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
            <div className="flex justify-end">
              <Button variant="student" loading={savingReview} onClick={submitReview}>
                Post review
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {booking.review && (
        <Card>
          <CardHeader title="Your review" description={`You gave ${booking.review.rating} out of 5.`} />
          <CardBody>
            <p className="text-sm leading-relaxed text-slate-600">
              {booking.review.text ?? 'You left a rating without a comment.'}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  )
}

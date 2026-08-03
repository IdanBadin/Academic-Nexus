import { useCallback, useEffect, useState } from 'react'
import { Quote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Label, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, SkeletonCard } from '@/components/ui/States'
import { EmptyStateAnimation } from '@/components/lottie/Animations'
import { useToast } from '@/components/ui/Toast'
import { FORMATS } from '@/config/theme'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { getBookingsForUser, setBookingStatus } from '@/lib/queries'
import { formatCurrency, formatDateTime, relativeTime } from '@/lib/utils'
import type { BookingDetail } from '@/types/db'

function formatLabel(value: string | undefined): string {
  if (!value) return 'Session'
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export default function Requests() {
  const { session } = useAuth()
  const { push } = useToast()
  const expertId = session?.user?.id ?? null

  const [requests, setRequests] = useState<BookingDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [declining, setDeclining] = useState<BookingDetail | null>(null)
  const [reason, setReason] = useState('')
  const [declineBusy, setDeclineBusy] = useState(false)

  const load = useCallback(async () => {
    if (!expertId) return
    setLoading(true)
    setLoadError('')
    try {
      const all = await getBookingsForUser(expertId, 'expert')
      setRequests(
        all
          .filter((b) => b.status === 'requested')
          .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      )
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'We could not load your requests right now.'
      )
    } finally {
      setLoading(false)
    }
  }, [expertId])

  useEffect(() => {
    void load()
  }, [load])

  const handleAccept = async (booking: BookingDetail) => {
    if (!expertId) return
    setBusyId(booking.id)
    const previous = requests
    setRequests((current) => current.filter((b) => b.id !== booking.id))

    try {
      await setBookingStatus(booking.id, 'accepted')
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: 'booking_accepted',
        entity: 'bookings',
        status: 'success',
        message: `Accepted ${formatDateTime(booking.slot_datetime)}`,
      })
      push('success', `Accepted. ${booking.student?.full_name ?? 'The student'} pays next.`)
    } catch (error) {
      setRequests(previous)
      push('error', error instanceof Error ? error.message : 'Could not accept that request.')
    } finally {
      setBusyId(null)
    }
  }

  const handleDecline = async () => {
    if (!expertId || !declining) return
    const booking = declining
    setDeclineBusy(true)
    const previous = requests
    setRequests((current) => current.filter((b) => b.id !== booking.id))

    try {
      await setBookingStatus(booking.id, 'declined')
      await logEvent({
        userId: expertId,
        role: 'expert',
        eventType: 'booking_declined',
        entity: 'bookings',
        status: 'success',
        message: reason.trim() || 'No reason given',
      })
      push('info', 'Declined. The student has been told.')
      setDeclining(null)
      setReason('')
    } catch (error) {
      setRequests(previous)
      push('error', error instanceof Error ? error.message : 'Could not decline that request.')
    } finally {
      setDeclineBusy(false)
    }
  }

  const renderBody = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )
    }

    if (loadError) return <ErrorState message={loadError} />

    if (requests.length === 0) {
      return (
        <EmptyState
          illustration={<EmptyStateAnimation />}
          title="Nothing waiting on you"
          description="Requests land here the moment a student books. If it has been quiet, check that a listing is visible and that your weekly hours are filled in."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/expert/listings">
                <Button variant="secondary">Check listings</Button>
              </Link>
              <Link to="/expert/availability">
                <Button variant="secondary">Check availability</Button>
              </Link>
            </div>
          }
        />
      )
    }

    return (
      <div className="space-y-4">
        {requests.map((booking) => (
          <Card key={booking.id}>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={booking.student?.full_name}
                    url={booking.student?.avatar_url}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="font-heading text-base font-semibold">
                      {booking.student?.full_name ?? 'A student'}
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {booking.listing?.subject ?? 'Session'} -{' '}
                      {formatLabel(booking.listing?.format)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Asked {relativeTime(booking.created_at)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="tabular font-heading text-lg font-semibold text-expert-teal">
                    {formatCurrency(booking.price)}
                  </p>
                  <p className="tabular mt-0.5 text-sm text-slate-600">
                    {formatDateTime(booking.slot_datetime)}
                  </p>
                  {booking.listing?.duration_min ? (
                    <Badge className="mt-1.5">{booking.listing.duration_min} min</Badge>
                  ) : null}
                </div>
              </div>

              {booking.student_note && (
                <blockquote className="rounded-card border-l-2 border-expert-teal bg-cloud p-4">
                  <Quote className="h-4 w-4 text-expert-teal/60" aria-hidden />
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {booking.student_note}
                  </p>
                </blockquote>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setReason('')
                    setDeclining(booking)
                  }}
                  disabled={busyId === booking.id}
                >
                  Decline
                </Button>
                <Button
                  variant="primary"
                  loading={busyId === booking.id}
                  onClick={() => handleAccept(booking)}
                >
                  Accept
                </Button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Requests"
        description="Students waiting on your yes or no. Read the note before you answer."
      />

      {renderBody()}

      <Modal
        open={declining !== null}
        onClose={() => setDeclining(null)}
        title="Decline this request?"
        description={
          declining
            ? `${declining.student?.full_name ?? 'The student'}, ${formatDateTime(declining.slot_datetime)}.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclining(null)} disabled={declineBusy}>
              Go back
            </Button>
            <Button variant="danger" loading={declineBusy} onClick={handleDecline}>
              Decline
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="decline_reason" hint="optional">
            Reason
          </Label>
          <Textarea
            id="decline_reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Booked that hour already. Try Thursday evening."
          />
          <p className="mt-1.5 text-xs text-slate-500">
            A line or two helps the student pick a better time next go.
          </p>
        </div>
      </Modal>
    </>
  )
}

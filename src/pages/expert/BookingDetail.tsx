import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Clock, DollarSign, User } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { LoadingBlock, ErrorState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BookingChat } from '@/components/chat/BookingChat'
import { BookingTimeline, transitionBooking } from '@/components/booking/BookingLifecycle'
import { getBooking } from '@/lib/queries'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import type { BookingDetail as BookingDetailType, BookingStatus } from '@/types/db'

const CHAT_OPEN: BookingStatus[] = ['confirmed', 'in_progress', 'completed']

export default function ExpertBookingDetail() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const { push } = useToast()

  const [booking, setBooking] = useState<BookingDetailType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    try {
      setLoading(true)
      setBooking(await getBooking(id))
      setError(null)
    } catch {
      setError('We could not load this booking. Refresh to try again.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const move = async (to: BookingStatus) => {
    if (!booking || !profile) return
    setWorking(true)
    const result = await transitionBooking({
      booking,
      to,
      actorId: profile.id,
      actorRole: 'expert',
    })
    setWorking(false)

    if (!result.ok) {
      push('error', result.error ?? 'That change did not go through.')
      return
    }
    push('success', 'Booking updated.')
    await load()
  }

  if (loading) return <LoadingBlock label="Loading booking" />
  if (error) return <ErrorState message={error} />
  if (!booking) return <ErrorState message="That booking does not exist, or it is not yours." />

  const student = booking.student
  const chatOpen = CHAT_OPEN.includes(booking.status)

  return (
    <div>
      <Link
        to="/expert/requests"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors hover:text-nexus-indigo"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to requests
      </Link>

      <PageHeader
        title={booking.listing?.subject ?? 'Session'}
        description={booking.listing?.level ?? undefined}
        action={<StatusBadge status={booking.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <BookingTimeline status={booking.status} />

              <div className="grid gap-4 sm:grid-cols-3">
                <Detail icon={<User className="h-4 w-4" />} label="Student">
                  <span className="flex items-center gap-2">
                    <Avatar name={student?.full_name} url={student?.avatar_url} size="sm" />
                    {student?.full_name ?? 'Unknown'}
                  </span>
                </Detail>
                <Detail icon={<Clock className="h-4 w-4" />} label="Scheduled">
                  {formatDateTime(booking.slot_datetime)}
                </Detail>
                <Detail icon={<DollarSign className="h-4 w-4" />} label="Price">
                  <span className="tabular">{formatCurrency(booking.price)}</span>
                </Detail>
              </div>

              {booking.student_note && (
                <div>
                  <p className="mb-1.5 text-sm font-medium">What they asked for</p>
                  <blockquote className="rounded-control border-l-2 border-student-amber bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                    {booking.student_note}
                  </blockquote>
                </div>
              )}

              <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                {booking.status === 'requested' && (
                  <>
                    <Button onClick={() => move('accepted')} loading={working}>
                      Accept request
                    </Button>
                    <Button variant="secondary" onClick={() => move('declined')} loading={working}>
                      Decline
                    </Button>
                  </>
                )}
                {booking.status === 'confirmed' && (
                  <Button onClick={() => move('in_progress')} loading={working}>
                    Mark session started
                  </Button>
                )}
                {booking.status === 'in_progress' && (
                  <Button onClick={() => move('completed')} loading={working}>
                    Mark completed
                  </Button>
                )}
                {booking.status === 'accepted' && (
                  <p className="text-sm text-slate-500">
                    Waiting on the student to pay. Chat opens once that clears.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div>
          {chatOpen ? (
            <BookingChat bookingId={booking.id} />
          ) : (
            <Card>
              <CardBody className="text-center text-sm text-slate-500">
                The chat thread opens once this booking is confirmed.
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span aria-hidden>{icon}</span>
        {label}
      </p>
      <div className="text-sm text-nexus-indigo">{children}</div>
    </div>
  )
}

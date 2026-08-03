import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, VerifiedBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Rating } from '@/components/ui/Rating'
import { EmptyState, ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { FORMATS, WEEKDAYS_SHORT } from '@/config/theme'
import { MISSING_KEY_HINT } from '@/config/env'
import { supabaseReady } from '@/lib/supabase'
import {
  getAvailability,
  getListingsForExpert,
  getProfile,
  getReviewsForExpert,
} from '@/lib/queries'
import { cn, formatCurrency, formatTime, relativeTime } from '@/lib/utils'
import type { Availability, Listing, Profile, Review } from '@/types/db'

function formatLabel(value: string): string {
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export default function ExpertProfile() {
  const { id } = useParams<{ id: string }>()

  const [expert, setExpert] = useState<Profile | null>(null)
  const [listings, setListings] = useState<Listing[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [availability, setAvailability] = useState<Availability[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const carousel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabaseReady || !id) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [profileRow, listingRows, reviewRows, availabilityRows] = await Promise.all([
          getProfile(id),
          getListingsForExpert(id),
          getReviewsForExpert(id),
          getAvailability(id),
        ])
        if (!alive) return
        setExpert(profileRow)
        setListings(listingRows.filter((l) => l.is_active))
        setReviews(reviewRows)
        setAvailability(availabilityRows)
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load this profile.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  const scrollReviews = (direction: -1 | 1) => {
    const node = carousel.current
    if (!node) return
    const card = node.querySelector<HTMLElement>('[data-review-card]')
    const step = card ? card.offsetWidth + 16 : node.clientWidth * 0.8
    node.scrollBy({ left: step * direction, behavior: 'smooth' })
  }

  if (!supabaseReady) {
    return <MissingKeyNotice feature="Expert profiles" hint={MISSING_KEY_HINT.supabase} />
  }
  if (loading) return <LoadingBlock label="Loading profile" />
  if (error) return <ErrorState message={error} />
  if (!expert) {
    return (
      <EmptyState
        title="No expert here"
        description="That profile does not exist, or it was taken down."
        action={
          <Link to="/student/search">
            <Button variant="student">Back to search</Button>
          </Link>
        }
      />
    )
  }

  const avgRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0

  const slotsByDay = WEEKDAYS_SHORT.map((_, index) =>
    availability
      .filter((slot) => slot.weekday === index)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
  )

  return (
    <div className="space-y-6">
      {/* -------------------------------- header ------------------------------- */}
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={expert.full_name} url={expert.avatar_url} size="xl" />
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-semibold text-nexus-indigo">
                {expert.full_name ?? 'Expert'}
              </h1>
              {expert.is_verified && <VerifiedBadge />}
            </div>

            <Rating value={avgRating} count={reviews.length} />

            {expert.subjects && expert.subjects.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {expert.subjects.map((subject) => (
                  <Badge key={subject} className="bg-expert-teal/10 text-expert-teal">
                    {subject}
                  </Badge>
                ))}
              </div>
            )}

            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              {expert.bio ?? 'This expert has not written a bio yet.'}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------- listings ------------------------------ */}
      <Card>
        <CardHeader
          title="What they teach"
          description={
            listings.length > 0
              ? 'Pick a session and send a request.'
              : 'Nothing is open for booking right now.'
          }
        />
        <CardBody>
          {listings.length === 0 ? (
            <p className="text-sm text-slate-500">
              No active listings. Try another expert from search.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listings.map((listing) => (
                <li
                  key={listing.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-nexus-indigo">
                      {formatLabel(listing.format)} · {listing.subject}
                    </p>
                    <p className="tabular mt-0.5 text-sm text-slate-500">
                      {listing.level} · {listing.duration_min} min ·{' '}
                      {formatCurrency(listing.price)}
                    </p>
                  </div>
                  <Link to={`/student/book/${listing.id}`}>
                    <Button variant="student" size="sm">
                      Book
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ------------------------------- reviews ------------------------------- */}
      <Card>
        <CardHeader
          title="Reviews"
          description={
            reviews.length > 0
              ? `${reviews.length} ${reviews.length === 1 ? 'student has' : 'students have'} left feedback.`
              : 'No reviews yet.'
          }
          action={
            reviews.length > 1 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label="Previous reviews"
                  onClick={() => scrollReviews(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-control border border-slate-200 text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next reviews"
                  onClick={() => scrollReviews(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-control border border-slate-200 text-slate-600 transition-colors duration-150 hover:bg-slate-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : undefined
          }
        />
        <CardBody>
          {reviews.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nobody has reviewed this expert yet. You could be first.
            </p>
          ) : (
            <div
              ref={carousel}
              className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {reviews.map((review) => (
                <div
                  key={review.id}
                  data-review-card
                  className="w-72 shrink-0 snap-start rounded-card border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={cn(
                          'h-4 w-4',
                          star <= review.rating
                            ? 'fill-student-amber text-student-amber'
                            : 'text-slate-200'
                        )}
                      />
                    ))}
                  </div>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    {review.text ?? 'No written feedback.'}
                  </p>
                  <p className="mt-3 text-xs text-slate-400">{relativeTime(review.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* ----------------------------- availability ---------------------------- */}
      <Card>
        <CardHeader
          title="Weekly availability"
          description="The hours this expert usually keeps free."
        />
        <CardBody>
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAYS_SHORT.map((label, index) => (
              <div key={label} className="min-w-0">
                <p className="mb-2 text-center text-xs font-medium uppercase tracking-wide text-slate-400">
                  {label}
                </p>
                <div className="space-y-1.5">
                  {slotsByDay[index].length === 0 ? (
                    <p className="text-center text-sm text-slate-300">-</p>
                  ) : (
                    slotsByDay[index].map((slot) => (
                      <span
                        key={slot.id}
                        className="tabular block rounded-control bg-expert-teal/10 px-1.5 py-1 text-center text-[11px] font-medium leading-tight text-expert-teal"
                      >
                        {formatTime(slot.start_time)}
                        <br />
                        {formatTime(slot.end_time)}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

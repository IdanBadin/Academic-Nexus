import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Rating } from '@/components/ui/Rating'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { EmptyStateAnimation } from '@/components/lottie/Animations'
import { useAuth } from '@/hooks/useAuth'
import { getReviewsForExpert } from '@/lib/queries'
import { supabase } from '@/lib/supabase'
import { relativeTime } from '@/lib/utils'
import type { Profile, Review } from '@/types/db'

export default function Reviews() {
  const { session } = useAuth()
  const expertId = session?.user?.id ?? null

  const [reviews, setReviews] = useState<Review[]>([])
  const [students, setStudents] = useState<Record<string, Profile>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!expertId) return
    let canceled = false

    const run = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const rows = await getReviewsForExpert(expertId)
        if (canceled) return
        setReviews(rows)

        const ids = [...new Set(rows.map((r) => r.student_id))]
        if (ids.length > 0) {
          const { data } = await supabase.from('profiles').select('*').in('id', ids)
          if (canceled) return
          const map: Record<string, Profile> = {}
          for (const person of (data ?? []) as Profile[]) map[person.id] = person
          setStudents(map)
        }
      } catch (error) {
        if (!canceled) {
          setLoadError(
            error instanceof Error ? error.message : 'We could not load your reviews right now.'
          )
        }
      } finally {
        if (!canceled) setLoading(false)
      }
    }

    void run()
    return () => {
      canceled = true
    }
  }, [expertId])

  const { average, distribution } = useMemo(() => {
    const counts = [0, 0, 0, 0, 0]
    let sum = 0
    for (const review of reviews) {
      sum += review.rating
      const slot = Math.min(5, Math.max(1, Math.round(review.rating))) - 1
      counts[slot] += 1
    }
    return {
      average: reviews.length > 0 ? sum / reviews.length : 0,
      distribution: counts,
    }
  }, [reviews])

  if (loading) return <LoadingBlock label="Loading your reviews" />
  if (loadError) {
    return (
      <>
        <PageHeader title="Reviews" />
        <ErrorState message={loadError} />
      </>
    )
  }

  if (reviews.length === 0) {
    return (
      <>
        <PageHeader title="Reviews" />
        <EmptyState
          illustration={<EmptyStateAnimation />}
          title="No reviews yet"
          description="Students can leave one after a session is done. The first few make a real difference to how often you get booked."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Reviews" description="What students said after their sessions with you." />

      <Card>
        <CardHeader title="Trust score" description="Every rating you have been given." />
        <CardBody className="grid gap-8 pt-4 sm:grid-cols-[200px_1fr]">
          <div className="flex flex-col items-center justify-center gap-2 text-center">
            <p className="tabular font-heading text-5xl font-bold text-nexus-indigo">
              {average.toFixed(1)}
            </p>
            <Rating value={average} />
            <p className="tabular text-sm text-slate-500">
              {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = distribution[star - 1]
              const share = reviews.length > 0 ? (count / reviews.length) * 100 : 0
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="tabular w-10 shrink-0 text-sm text-slate-500">{star} star</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-student-amber transition-[width] duration-500 ease-out"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                  <span className="tabular w-8 shrink-0 text-right text-sm text-slate-500">
                    {count}
                  </span>
                </div>
              )
            })}
          </div>
        </CardBody>
      </Card>

      <div className="mt-6 space-y-4">
        {reviews.map((review) => {
          const student = students[review.student_id]
          return (
            <Card key={review.id}>
              <CardBody className="flex gap-4">
                <Avatar name={student?.full_name} url={student?.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{student?.full_name ?? 'A student'}</p>
                    <span className="text-xs text-slate-400">{relativeTime(review.created_at)}</span>
                  </div>
                  <Rating value={review.rating} size="sm" className="mt-1" />
                  {review.text && (
                    <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {review.text}
                    </p>
                  )}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>
    </>
  )
}

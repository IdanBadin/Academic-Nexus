import { useCallback, useEffect, useState } from 'react'
import { Check, Flag, Star } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { supabase, supabaseReady } from '@/lib/supabase'
import { cn, formatDateTime, relativeTime } from '@/lib/utils'
import type { EventLog, Profile, Review } from '@/types/db'

interface DisputeItem {
  /** `event_logs:<id>` or `reviews:<id>` - also what a resolution row points at. */
  ref: string
  kind: 'dispute' | 'low_review'
  who: Profile | null
  entity: string | null
  status: string
  message: string
  createdAt: string
  rating?: number
}

type LoggedDispute = EventLog & { user: Profile | null }
type FlaggedReview = Review & { student: Profile | null; expert: Profile | null }

export default function AdminDisputes() {
  const { profile: me } = useAuth()
  const { push } = useToast()

  const [items, setItems] = useState<DisputeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyRef, setBusyRef] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [disputesRes, resolvedRes, reviewsRes] = await Promise.all([
      supabase
        .from('event_logs')
        .select('*, user:profiles(*)')
        .eq('event_type', 'dispute')
        .order('created_at', { ascending: false }),
      supabase.from('event_logs').select('entity').eq('event_type', 'dispute_resolved'),
      supabase
        .from('reviews')
        .select(
          '*, student:profiles!reviews_student_id_fkey(*), expert:profiles!reviews_expert_id_fkey(*)'
        )
        .lte('rating', 2)
        .order('created_at', { ascending: false }),
    ])

    if (disputesRes.error) throw disputesRes.error
    if (reviewsRes.error) throw reviewsRes.error

    const resolved = new Set(
      ((resolvedRes.data ?? []) as { entity: string | null }[])
        .map((row) => row.entity)
        .filter((entity): entity is string => Boolean(entity))
    )

    const raised: DisputeItem[] = ((disputesRes.data ?? []) as LoggedDispute[]).map((log) => ({
      ref: `event_logs:${log.id}`,
      kind: 'dispute',
      who: log.user,
      entity: log.entity,
      status: log.status ?? 'requested',
      message: log.message ?? 'No details were written down.',
      createdAt: log.created_at,
    }))

    const flagged: DisputeItem[] = ((reviewsRes.data ?? []) as FlaggedReview[]).map((review) => ({
      ref: `reviews:${review.id}`,
      kind: 'low_review',
      who: review.student,
      entity: review.expert?.full_name
        ? `Review of ${review.expert.full_name}`
        : `bookings:${review.booking_id}`,
      status: 'failed',
      message: review.text?.trim() || 'The student left a low rating without a comment.',
      createdAt: review.created_at,
      rating: review.rating,
    }))

    return [...raised, ...flagged]
      .filter((item) => !resolved.has(item.ref))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [])

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    let canceled = false
    load()
      .then((next) => {
        if (!canceled) setItems(next)
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : 'Could not load the dispute queue.')
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [load])

  const markReviewed = async (item: DisputeItem) => {
    setBusyRef(item.ref)
    const previous = items
    setItems((current) => current.filter((row) => row.ref !== item.ref))

    try {
      const { error: writeError } = await supabase.from('event_logs').insert({
        user_id: me?.id ?? null,
        role: 'admin',
        event_type: 'dispute_resolved',
        entity: item.ref,
        status: 'completed',
        message:
          item.kind === 'dispute'
            ? 'Dispute reviewed and closed by an admin'
            : 'Low rating reviewed and closed by an admin',
      })
      if (writeError) throw writeError
      push('success', 'Marked reviewed. It will stay off this list.')
    } catch (err) {
      setItems(previous)
      push('error', err instanceof Error ? err.message : 'That did not save. Try again.')
    } finally {
      setBusyRef(null)
    }
  }

  if (!supabaseReady) {
    return (
      <>
        <PageHeader title="Disputes" description="Complaints and low ratings that need a look." />
        <MissingKeyNotice
          feature="The dispute queue"
          hint="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then reload."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Complaints people filed, plus any review of two stars or less."
        action={
          items.length > 0 ? (
            <Badge className="border-status-red/30 bg-status-red/10 text-red-700">
              <span className="tabular">{items.length}</span> open
            </Badge>
          ) : undefined
        }
      />

      {loading ? (
        <LoadingBlock label="Loading the queue" />
      ) : error ? (
        <ErrorState message={error} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing needs attention"
          description="No open disputes and no low ratings waiting on a decision. Check back later."
        />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card
              key={item.ref}
              className={cn(
                'p-5',
                item.kind === 'low_review' && 'border-status-gold/40 bg-status-gold/5'
              )}
            >
              <div className="flex items-start gap-4">
                <Avatar name={item.who?.full_name} url={item.who?.avatar_url} size="md" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{item.who?.full_name ?? 'Someone signed out'}</p>
                    {item.kind === 'low_review' ? (
                      <Badge className="border-status-gold/40 bg-status-gold/10 text-yellow-700">
                        <Star className="h-3 w-3 fill-current" aria-hidden />
                        <span className="tabular">{item.rating}</span> star review
                      </Badge>
                    ) : (
                      <Badge className="border-status-red/30 bg-status-red/10 text-red-700">
                        <Flag className="h-3 w-3" aria-hidden />
                        Dispute
                      </Badge>
                    )}
                    <StatusBadge status={item.status} />
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{item.message}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    {item.entity && <span>{item.entity}</span>}
                    <span aria-hidden>·</span>
                    <span title={formatDateTime(item.createdAt)}>
                      {relativeTime(item.createdAt)}
                    </span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyRef === item.ref}
                  onClick={() => markReviewed(item)}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Mark reviewed
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}

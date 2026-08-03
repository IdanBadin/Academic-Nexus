import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Star } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { VerifiedBadge } from '@/components/ui/Badge'
import { Input, Label, Select } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { Rating } from '@/components/ui/Rating'
import { Modal } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, MissingKeyNotice, SkeletonCard } from '@/components/ui/States'
import { MatchFoundAnimation } from '@/components/lottie/Animations'
import { PageHeader } from '@/components/layout/AppLayout'
import { FORMATS, LEVELS, SUBJECTS, WEEKDAYS_SHORT } from '@/config/theme'
import { MISSING_KEY_HINT } from '@/config/env'
import { supabaseReady } from '@/lib/supabase'
import { listActiveListings } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { rankListings, type StudentPrefs } from '@/lib/matchScore'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { ListingWithExpert, MatchResult } from '@/types/db'

const ANY = 'any'
const MAX_PRICE = 200

function formatLabel(value: string): string {
  return FORMATS.find((f) => f.value === value)?.label ?? value
}

export default function StudentSearch() {
  const { profile } = useAuth()
  const { push } = useToast()

  const [listings, setListings] = useState<ListingWithExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [subject, setSubject] = useState<string>(ANY)
  const [level, setLevel] = useState<string>(ANY)
  const [formats, setFormats] = useState<string[]>([])
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)
  const [minRating, setMinRating] = useState(0)
  const [days, setDays] = useState<number[]>([])

  const [matchOpen, setMatchOpen] = useState(false)
  const [matches, setMatches] = useState<MatchResult[] | null>(null)
  const [matchRunning, setMatchRunning] = useState(false)
  const [barsIn, setBarsIn] = useState(false)
  const [prefSubject, setPrefSubject] = useState<string>(SUBJECTS[0])
  const [prefLevel, setPrefLevel] = useState<string>(LEVELS[0])
  const [prefPrice, setPrefPrice] = useState(MAX_PRICE)
  const [prefDays, setPrefDays] = useState<number[]>([])

  /* ------------------------------ data load ------------------------------ */

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }
    let alive = true
    ;(async () => {
      try {
        const rows = await listActiveListings()
        if (alive) setListings(rows)
      } catch (err) {
        if (alive) setLoadError(err instanceof Error ? err.message : 'Could not load listings.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!supabaseReady) return
    void logEvent({
      userId: profile?.id ?? null,
      role: profile?.role ?? null,
      eventType: 'view_search',
      entity: 'listings',
      message: 'Opened the search page',
    })
    // Once per mount, not on every profile refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ------------------------------ filtering ------------------------------ */

  const results = useMemo(() => {
    return listings.filter((listing) => {
      if (subject !== ANY && listing.subject !== subject) return false
      if (level !== ANY && listing.level !== level) return false
      if (formats.length > 0 && !formats.includes(listing.format)) return false
      if (listing.price > maxPrice) return false
      if (minRating > 0 && listing.stats.avg_rating < minRating) return false
      if (days.length > 0) {
        const covered = new Set(listing.availability.map((slot) => slot.weekday))
        if (!days.some((day) => covered.has(day))) return false
      }
      return true
    })
  }, [listings, subject, level, formats, maxPrice, minRating, days])

  // One search event per settled set of filters, not one per keystroke or drag.
  const firstRun = useRef(true)
  useEffect(() => {
    if (!supabaseReady || loading) return
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const timer = window.setTimeout(() => {
      void logEvent({
        userId: profile?.id ?? null,
        role: profile?.role ?? null,
        eventType: 'search',
        entity: 'listings',
        message: `subject=${subject}, level=${level}, formats=${
          formats.join('|') || 'any'
        }, maxPrice=${maxPrice}, minRating=${minRating}, days=${
          days.join('|') || 'any'
        } -> ${results.length} results`,
      })
    }, 700)
    return () => window.clearTimeout(timer)
  }, [subject, level, formats, maxPrice, minRating, days, results.length, loading, profile])

  /* -------------------------------- match -------------------------------- */

  const openMatch = useCallback(() => {
    setPrefSubject(subject === ANY ? SUBJECTS[0] : subject)
    setPrefLevel(level === ANY ? LEVELS[0] : level)
    setPrefPrice(maxPrice)
    setPrefDays(days)
    setMatches(null)
    setBarsIn(false)
    setMatchOpen(true)
  }, [subject, level, maxPrice, days])

  const runMatch = async () => {
    setMatchRunning(true)
    setBarsIn(false)
    try {
      const prefs: StudentPrefs = {
        subject: prefSubject,
        level: prefLevel,
        maxPrice: prefPrice,
        days: prefDays,
        formats: formats.length > 0 ? formats : undefined,
      }
      const ranked = rankListings(listings, prefs).slice(0, 5)
      setMatches(ranked)
      await logEvent({
        userId: profile?.id ?? null,
        role: profile?.role ?? null,
        eventType: 'match_score_run',
        entity: 'listings',
        message: `Scored ${listings.length} listings against ${prefSubject} / ${prefLevel} / $${prefPrice} cap`,
      })
      window.requestAnimationFrame(() => setBarsIn(true))
    } catch (err) {
      push('error', err instanceof Error ? err.message : 'The match run did not finish.')
    } finally {
      setMatchRunning(false)
    }
  }

  const toggleFormat = (value: string) =>
    setFormats((prev) =>
      prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]
    )

  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))

  const togglePrefDay = (day: number) =>
    setPrefDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]))

  /** The filter most likely to be hiding results, so the empty state can say so. */
  const loosenHint = useMemo(() => {
    if (minRating > 0) return `Try dropping the ${minRating} star minimum.`
    if (maxPrice < MAX_PRICE) return `Try raising the price cap above ${formatCurrency(maxPrice)}.`
    if (days.length > 0) return 'Try adding a couple more days.'
    if (formats.length > 0) return 'Try turning off a session type.'
    if (level !== ANY) return `Try widening the level beyond ${level}.`
    if (subject !== ANY) return `No one is teaching ${subject} right now. Try another subject.`
    return 'There are no active listings yet. Check back soon.'
  }, [minRating, maxPrice, days, formats, level, subject])

  if (!supabaseReady) {
    return (
      <div className="space-y-6">
        <PageHeader title="Find an expert" description="Search by subject, level, price, and when you are free." />
        <MissingKeyNotice feature="Search" hint={MISSING_KEY_HINT.supabase} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Find an expert"
        description="Search by subject, level, price, and when you are free."
      />

      {/* ------------------------------ filters ------------------------------ */}
      <Card>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-slate-500">
              Results update as you change anything below.
            </p>
            <Button variant="student" onClick={openMatch} disabled={listings.length === 0}>
              <Sparkles className="h-4 w-4" />
              Find my best match
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label htmlFor="filter-subject">Subject</Label>
              <Select
                id="filter-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                <option value={ANY}>All subjects</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-level">Level</Label>
              <Select id="filter-level" value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value={ANY}>All levels</option>
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="filter-price" hint={`Up to ${formatCurrency(maxPrice)}`}>
                Price cap
              </Label>
              <Input
                id="filter-price"
                type="range"
                min={0}
                max={MAX_PRICE}
                step={5}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="h-10 cursor-pointer accent-student-amber"
              />
            </div>

            <div>
              <Label>Minimum rating</Label>
              <div className="flex items-center gap-1 pt-1.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${star} stars and up`}
                    aria-pressed={minRating === star}
                    onClick={() => setMinRating(minRating === star ? 0 : star)}
                    className="rounded p-0.5 transition-transform duration-150 ease-out hover:scale-110"
                  >
                    <Star
                      className={cn(
                        'h-5 w-5 transition-colors duration-150',
                        star <= minRating
                          ? 'fill-student-amber text-student-amber'
                          : 'text-slate-300'
                      )}
                    />
                  </button>
                ))}
                {minRating > 0 && (
                  <button
                    type="button"
                    onClick={() => setMinRating(0)}
                    className="ml-1 text-xs text-slate-500 underline underline-offset-2"
                  >
                    clear
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Session type</Label>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {FORMATS.map((f) => {
                  const active = formats.includes(f.value)
                  return (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleFormat(f.value)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-sm font-medium',
                        'transition-[background-color,color,border-color] duration-150 ease-out',
                        active
                          ? 'border-student-amber bg-student-amber/10 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <Label>Days you are free</Label>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {WEEKDAYS_SHORT.map((label, index) => {
                  const active = days.includes(index)
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleDay(index)}
                      className={cn(
                        'h-9 w-12 rounded-control border text-sm font-medium',
                        'transition-[background-color,color,border-color] duration-150 ease-out',
                        active
                          ? 'border-student-amber bg-student-amber/10 text-amber-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ------------------------------ results ------------------------------ */}
      {loadError ? (
        <ErrorState message={loadError} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : results.length === 0 ? (
        <EmptyState title="Nothing matches those filters" description={loosenHint} />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            <span className="tabular font-medium text-nexus-indigo">{results.length}</span>{' '}
            {results.length === 1 ? 'listing' : 'listings'}
          </p>
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {results.map((listing) => (
              <ResultCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}

      {/* ---------------------------- match modal ---------------------------- */}
      <Modal
        open={matchOpen}
        onClose={() => setMatchOpen(false)}
        title="Find my best match"
        description="Tell us what you need and we will score every listing against it."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMatchOpen(false)}>
              Close
            </Button>
            <Button variant="student" onClick={runMatch} loading={matchRunning}>
              {matches ? 'Score again' : 'Show my matches'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pref-subject">Subject</Label>
              <Select
                id="pref-subject"
                value={prefSubject}
                onChange={(e) => setPrefSubject(e.target.value)}
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="pref-level">Level</Label>
              <Select
                id="pref-level"
                value={prefLevel}
                onChange={(e) => setPrefLevel(e.target.value)}
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pref-price" hint={`Up to ${formatCurrency(prefPrice)}`}>
              Most you want to pay
            </Label>
            <Input
              id="pref-price"
              type="range"
              min={0}
              max={MAX_PRICE}
              step={5}
              value={prefPrice}
              onChange={(e) => setPrefPrice(Number(e.target.value))}
              className="h-10 cursor-pointer accent-student-amber"
            />
          </div>

          <div>
            <Label>Days that work for you</Label>
            <div className="flex flex-wrap gap-2 pt-1.5">
              {WEEKDAYS_SHORT.map((label, index) => {
                const active = prefDays.includes(index)
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePrefDay(index)}
                    className={cn(
                      'h-9 w-12 rounded-control border text-sm font-medium',
                      'transition-[background-color,color,border-color] duration-150 ease-out',
                      active
                        ? 'border-student-amber bg-student-amber/10 text-amber-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {matches && (
            <div className="space-y-3 border-t border-slate-100 pt-5">
              <MatchFoundAnimation className="mx-auto h-24 w-24" />
              {matches.length === 0 ? (
                <p className="text-center text-sm text-slate-500">
                  Nothing scored high enough to show. Try a different subject or a higher price cap.
                </p>
              ) : (
                matches.map((match) => (
                  <div
                    key={match.listing.id}
                    className="rounded-card border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={match.listing.expert.full_name}
                          url={match.listing.expert.avatar_url}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-semibold text-nexus-indigo">
                            {match.listing.expert.full_name ?? 'Expert'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {match.listing.subject} · {match.listing.level}
                          </p>
                        </div>
                      </div>
                      <span className="tabular text-lg font-semibold text-amber-700">
                        {match.score}
                      </span>
                    </div>

                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-student-amber transition-[width] duration-700 ease-out"
                        style={{ width: barsIn ? `${match.score}%` : '0%' }}
                      />
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {match.explanation}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="tabular text-sm text-slate-500">
                        {formatCurrency(match.listing.price)} / {match.listing.duration_min} min
                      </span>
                      <Link
                        to={`/student/book/${match.listing.id}`}
                        className="text-sm font-medium text-amber-700 underline underline-offset-2"
                        onClick={() => setMatchOpen(false)}
                      >
                        Book this
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

function ResultCard({ listing }: { listing: ListingWithExpert }) {
  return (
    <Card interactive className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-4">
        <Link to={`/student/experts/${listing.expert_id}`} className="flex items-start gap-3">
          <Avatar name={listing.expert.full_name} url={listing.expert.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-heading text-base font-semibold text-nexus-indigo">
                {listing.expert.full_name ?? 'Expert'}
              </h3>
              {listing.expert.is_verified && <VerifiedBadge />}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              {listing.subject} · {listing.level} · {formatLabel(listing.format)}
            </p>
            <div className="mt-1.5">
              <Rating
                value={listing.stats.avg_rating}
                count={listing.stats.review_count}
                size="sm"
              />
            </div>
          </div>
        </Link>

        {listing.description && (
          <p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
            {listing.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="tabular text-sm text-slate-600">
            <span className="text-base font-semibold text-nexus-indigo">
              {formatCurrency(listing.price)}
            </span>{' '}
            / {listing.duration_min} min
          </span>
          <Link to={`/student/book/${listing.id}`}>
            <Button variant="student" size="sm">
              Book
            </Button>
          </Link>
        </div>
      </CardBody>
    </Card>
  )
}

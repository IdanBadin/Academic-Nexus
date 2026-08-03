import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  MessageSquare,
  Mic,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Rating } from '@/components/ui/Rating'
import { Avatar } from '@/components/ui/Avatar'
import { isConfigured } from '@/config/env'
import { SUBJECTS } from '@/config/theme'
import { listRecentReviews } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { relativeTime } from '@/lib/utils'
import type { Profile, Review } from '@/types/db'

type ReviewWithStudent = Review & { student: Profile | null }

/**
 * Landing-only motion. Scoped here rather than added to the shared
 * transitions.css so this page owns its own entrance timing.
 */
const LANDING_CSS = `
.an-rise {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(3px);
  animation: an-rise 500ms ease-in-out forwards;
}
@keyframes an-rise {
  to { opacity: 1; transform: translateY(0); filter: blur(0); }
}
.an-tile {
  transition:
    border-color 200ms ease-out,
    transform    200ms ease-out;
}
.an-tile:hover { border-color: rgb(148 163 184); transform: translateY(-3px); }
.an-track { scrollbar-width: none; }
.an-track::-webkit-scrollbar { display: none; }
@media (prefers-reduced-motion: reduce) {
  .an-rise {
    opacity: 1;
    transform: none;
    filter: none;
    animation: none;
  }
  .an-tile { transition: none; }
  .an-tile:hover { transform: none; }
}
`

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#reviews', label: 'Reviews' },
]

const ROLES = [
  {
    icon: GraduationCap,
    label: 'Student',
    headline: 'You need help with a course',
    ring: 'bg-student-amber/10 text-student-amber',
    points: [
      'Filter by subject, level, and price until the list is short enough to read',
      'Book a slot from the hours an expert actually marked open',
      'Message inside the booking once it is confirmed, then leave a review',
    ],
  },
  {
    icon: BookOpen,
    label: 'Expert',
    headline: 'You are the one teaching',
    ring: 'bg-expert-teal/10 text-expert-teal',
    points: [
      'Publish a listing per subject with your own rate and session length',
      'Set your weekly hours once - students only ever see real openings',
      'Accept or decline each request and watch your earnings add up',
    ],
  },
  {
    icon: ShieldCheck,
    label: 'Admin',
    headline: 'You keep the place honest',
    ring: 'bg-nexus-indigo/10 text-nexus-indigo',
    points: [
      'Verify an expert before their listings go in front of students',
      'Watch the funnel from search to booking to payment',
      'Read the event log when a number looks wrong',
    ],
  },
]

/* --------------------------- bento tile visuals --------------------------- */

function SearchVisual() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {['Statistics', 'Undergraduate', 'Under $60', '4.5+'].map((chip, i) => (
        <span
          key={chip}
          className={
            i === 0
              ? 'rounded-full border border-expert-teal/30 bg-expert-teal/10 px-3 py-1 text-xs font-medium text-expert-teal'
              : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500'
          }
        >
          {chip}
        </span>
      ))}
      <div className="mt-2 w-full space-y-2">
        {[92, 74, 58].map((w) => (
          <div key={w} className="flex items-center gap-2.5">
            <span className="h-7 w-7 shrink-0 rounded-full bg-slate-100" />
            <span className="h-2 rounded-full bg-slate-100" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function BookingVisual() {
  return (
    <div className="grid grid-cols-7 gap-1" aria-hidden>
      {Array.from({ length: 21 }).map((_, i) => (
        <span
          key={i}
          className={
            i === 10
              ? 'h-4 rounded bg-student-amber'
              : i % 5 === 2
                ? 'h-4 rounded bg-slate-200'
                : 'h-4 rounded bg-slate-100'
          }
        />
      ))}
    </div>
  )
}

function ChatVisual() {
  return (
    <div className="space-y-2" aria-hidden>
      <div className="w-4/5 rounded-card rounded-bl-sm bg-slate-100 px-3 py-2">
        <span className="block h-2 w-full rounded-full bg-slate-200" />
        <span className="mt-1.5 block h-2 w-2/3 rounded-full bg-slate-200" />
      </div>
      <div className="ml-auto w-3/5 rounded-card rounded-br-sm bg-expert-teal/10 px-3 py-2">
        <span className="block h-2 w-full rounded-full bg-expert-teal/30" />
      </div>
    </div>
  )
}

function AiVisual() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <Sparkles className="h-5 w-5 text-expert-teal" />
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 animate-pulse rounded-full bg-expert-teal/40"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function VoiceVisual() {
  const bars = [40, 78, 55, 100, 62, 88, 34, 70, 46]
  return (
    <div className="flex h-10 items-end gap-1" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-1.5 rounded-full bg-student-amber/70"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  )
}

const TILES = [
  {
    icon: Search,
    title: 'Search that narrows',
    copy: 'Subject, level, format, price, rating. Stack the filters until you are down to three names worth reading.',
    visual: <SearchVisual />,
    span: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
  },
  {
    icon: CalendarDays,
    title: 'Book a real slot',
    copy: 'Pick from the hours the expert marked open this week.',
    visual: <BookingVisual />,
    span: '',
  },
  {
    icon: MessageSquare,
    title: 'Chat per booking',
    copy: 'One thread tied to one session, so nothing gets lost in email.',
    visual: <ChatVisual />,
    span: '',
  },
  {
    icon: Sparkles,
    title: 'Ask before you book',
    copy: 'Describe what you are stuck on and the assistant points you at the right listing.',
    visual: <AiVisual />,
    span: '',
  },
  {
    icon: Mic,
    title: 'Say it out loud',
    copy: 'Record the question instead of typing it, and hear the answer back.',
    visual: <VoiceVisual />,
    span: '',
  },
]

/* ------------------------------ testimonials ------------------------------ */

function Testimonials({ reviews }: { reviews: ReviewWithStudent[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const sync = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const card = track.firstElementChild as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : track.clientWidth
    setIndex(Math.round(track.scrollLeft / step))
    setAtStart(track.scrollLeft <= 4)
    setAtEnd(track.scrollLeft >= track.scrollWidth - track.clientWidth - 4)
  }, [])

  useEffect(() => {
    sync()
  }, [sync, reviews.length])

  const nudge = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    const card = track.firstElementChild as HTMLElement | null
    const step = card ? card.offsetWidth + 16 : track.clientWidth
    track.scrollBy({ left: step * direction, behavior: 'smooth' })
  }

  return (
    <section id="reviews" className="border-t border-slate-200 bg-cloud py-20">
      <div className="mx-auto max-w-[1600px] px-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-3xl font-bold">What students said afterwards</h2>
            <p className="mt-2 max-w-lg text-slate-500">
              Every review here comes from a session that actually happened on Academic Nexus.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => nudge(-1)}
              disabled={atStart}
              aria-label="Previous reviews"
              className="flex h-10 w-10 items-center justify-center rounded-control border border-slate-200 bg-white text-nexus-indigo transition-colors duration-150 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              disabled={atEnd}
              aria-label="Next reviews"
              className="flex h-10 w-10 items-center justify-center rounded-control border border-slate-200 bg-white text-nexus-indigo transition-colors duration-150 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onScroll={sync}
          className="an-track mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
        >
          {reviews.map((review) => (
            <Card
              key={review.id}
              className="w-[19rem] shrink-0 snap-start p-5 sm:w-[22rem]"
            >
              <Rating value={review.rating} size="sm" />
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{review.text}</p>
              <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                <Avatar
                  name={review.student?.full_name ?? null}
                  url={review.student?.avatar_url}
                  size="sm"
                />
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium text-nexus-indigo">
                    {review.student?.full_name?.split(' ')[0] ?? 'Student'}
                  </p>
                  <p className="text-slate-400">{relativeTime(review.created_at)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-5 flex justify-center gap-1.5">
          {reviews.map((review, i) => (
            <span
              key={review.id}
              aria-hidden
              className={
                i === index
                  ? 'h-1.5 w-5 rounded-full bg-expert-teal transition-all duration-200'
                  : 'h-1.5 w-1.5 rounded-full bg-slate-300 transition-all duration-200'
              }
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------- page ---------------------------------- */

export default function Landing() {
  const [reviews, setReviews] = useState<ReviewWithStudent[]>([])
  const logged = useRef(false)

  useEffect(() => {
    // StrictMode mounts twice in dev - one landing_view row per visit, not two.
    if (logged.current) return
    logged.current = true
    void logEvent({ eventType: 'landing_view', entity: 'landing' })
  }, [])

  useEffect(() => {
    if (!isConfigured.supabase) return
    let canceled = false
    listRecentReviews(9)
      .then((rows) => {
        if (canceled) return
        setReviews(rows.filter((row) => Boolean(row.text?.trim())))
      })
      .catch(() => {
        /* The rail hides itself when nothing loads. */
      })
    return () => {
      canceled = true
    }
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-cloud">
      <style>{LANDING_CSS}</style>

      {/* ---------------------------- nav ---------------------------- */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5">
          <Link to="/" aria-label="Academic Nexus home">
            <Logo />
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-nexus-indigo"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm">
                Log in
              </Button>
            </Link>
            <Link to="/auth/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------------------------- hero --------------------------- */}
      <header className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(60rem 30rem at 50% -6rem, rgba(13,148,136,0.16), transparent 70%), radial-gradient(40rem 24rem at 85% 10%, rgba(30,41,59,0.10), transparent 65%)',
          }}
        />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center sm:py-28">
          <div className="an-rise flex justify-center" style={{ animationDelay: '0ms' }}>
            <LogoMark className="h-14 w-[6.5rem]" />
          </div>

          <h1
            className="an-rise mt-8 font-heading text-4xl font-bold tracking-tight text-nexus-indigo sm:text-5xl"
            style={{ animationDelay: '80ms' }}
          >
            Where academic help finds you.
          </h1>

          <p
            className="an-rise mx-auto mt-5 max-w-xl text-lg leading-relaxed text-slate-600"
            style={{ animationDelay: '160ms' }}
          >
            Students filter by subject, level, and budget, then book a time straight from the
            tutor's calendar. Tutors set their hours and their rate once, and the requests come to
            them.
          </p>

          <div
            className="an-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ animationDelay: '240ms' }}
          >
            <Link to="/auth/signup">
              <Button size="lg">Enter the marketplace</Button>
            </Link>
            <Link
              to="/auth/login"
              className="rounded-control px-4 py-2 text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-nexus-indigo"
            >
              I already have an account
            </Link>
          </div>

          <div
            className="an-rise mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-slate-200/70 pt-6"
            style={{ animationDelay: '320ms' }}
          >
            <span className="mr-1 text-xs uppercase tracking-wide text-slate-400">
              Tutors in
            </span>
            {SUBJECTS.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500"
              >
                {subject}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* --------------------------- roles --------------------------- */}
      <section className="border-t border-slate-200 py-20">
        <div className="mx-auto max-w-[1600px] px-5">
          <h2 className="font-heading text-3xl font-bold">Three ways in</h2>
          <p className="mt-2 max-w-xl text-slate-500">
            You choose one when you sign up, and that choice decides what you see after login.
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {ROLES.map((role) => {
              const Icon = role.icon
              return (
                <Card key={role.label} interactive className="flex flex-col p-6">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full ${role.ring}`}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {role.label}
                  </p>
                  <h3 className="mt-1 font-heading text-lg font-semibold">{role.headline}</h3>
                  <ul className="mt-4 space-y-3">
                    {role.points.map((point) => (
                      <li key={point} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-expert-teal" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* -------------------------- features ------------------------- */}
      <section id="features" className="border-t border-slate-200 bg-white py-20">
        <div className="mx-auto max-w-[1600px] px-5">
          <h2 className="font-heading text-3xl font-bold">What is inside</h2>
          <p className="mt-2 max-w-xl text-slate-500">
            Five parts you will actually touch. The sketches below are rough, the features are not.
          </p>

          <div className="mt-10 grid auto-rows-[minmax(11rem,auto)] gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TILES.map((tile) => {
              const Icon = tile.icon
              return (
                <article
                  key={tile.title}
                  className={`an-tile flex flex-col rounded-card border border-slate-200 bg-cloud p-5 ${tile.span}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-nexus-indigo" aria-hidden />
                    <h3 className="font-heading text-base font-semibold">{tile.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{tile.copy}</p>
                  <div className="mt-auto pt-6">{tile.visual}</div>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      {/* ------------------------ testimonials ----------------------- */}
      {isConfigured.supabase && reviews.length > 0 && <Testimonials reviews={reviews} />}

      {/* --------------------------- footer -------------------------- */}
      <footer className="border-t border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-[1600px] px-5">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <Logo />
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                A marketplace for academic help. Students find an expert for the course they are
                taking, experts find students who need exactly what they teach.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm sm:grid-cols-2">
              {/* Placeholder hrefs - these pages are not built yet. */}
              {['About', 'Privacy', 'Terms', 'Contact'].map((label) => (
                <a
                  key={label}
                  href="#"
                  className="rounded text-slate-500 transition-colors duration-150 hover:text-nexus-indigo"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          <p className="mt-10 border-t border-slate-100 pt-6 text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Academic Nexus. Built as a demo project.
          </p>
        </div>
      </footer>
    </div>
  )
}

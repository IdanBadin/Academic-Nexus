import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts'
import { ChevronRight, MessageSquare, Mic, Sparkles, Volume2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { COLORS, STATUS_COLOR, STATUS_LABEL } from '@/config/theme'
import { supabase, supabaseReady } from '@/lib/supabase'
import { listAllBookings, listProfiles } from '@/lib/queries'
import type { AppRole, BookingDetail, Profile } from '@/types/db'

/* ------------------------------ shared chart bits ------------------------------ */

const AXIS = {
  stroke: COLORS.statusSlate,
  tickLine: false as const,
  axisLine: false as const,
  tick: { fontSize: 12, fill: COLORS.statusSlate },
}

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-[0_12px_32px_-12px_rgba(15,23,42,0.28)]">
      {label !== undefined && label !== '' && (
        <p className="mb-1 text-xs font-medium text-slate-500">{String(label)}</p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-xs text-nexus-indigo">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color ?? COLORS.statusSlate }}
              aria-hidden
            />
            <span>{STATUS_LABEL[String(entry.name)] ?? entry.name}</span>
            <span className="tabular ml-auto font-semibold">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------- data types --------------------------------- */

interface DayPoint {
  day: string
  label: string
  [status: string]: string | number
}

interface UsageCounts {
  ai_chat: number
  tts_play: number
  stt_use: number
  match_score_run: number
  landing_view: number
  signup: number
}

const EMPTY_USAGE: UsageCounts = {
  ai_chat: 0,
  tts_play: 0,
  stt_use: 0,
  match_score_run: 0,
  landing_view: 0,
  signup: 0,
}

const ROLE_COLOR: Record<AppRole, string> = {
  student: COLORS.studentAmber,
  expert: COLORS.expertTeal,
  admin: COLORS.nexusIndigo,
}

const ROLE_LABEL: Record<AppRole, string> = {
  student: 'Students',
  expert: 'Experts',
  admin: 'Admins',
}

function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** One count per event type, straight from the server so nothing is capped by a row limit. */
async function countEvents(): Promise<UsageCounts> {
  const types = Object.keys(EMPTY_USAGE) as (keyof UsageCounts)[]
  const results = await Promise.all(
    types.map(async (type) => {
      const { count } = await supabase
        .from('event_logs')
        .select('id', { count: 'exact', head: true })
        .eq('event_type', type)
      return [type, count ?? 0] as const
    })
  )
  return results.reduce((acc, [type, count]) => ({ ...acc, [type]: count }), { ...EMPTY_USAGE })
}

/* ---------------------------------- the page ---------------------------------- */

export default function AdminDashboard() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [bookings, setBookings] = useState<BookingDetail[]>([])
  const [usage, setUsage] = useState<UsageCounts>(EMPTY_USAGE)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    let canceled = false
    ;(async () => {
      try {
        const [nextProfiles, nextBookings, nextUsage] = await Promise.all([
          listProfiles(),
          listAllBookings(),
          countEvents(),
        ])
        if (canceled) return
        setProfiles(nextProfiles)
        setBookings(nextBookings)
        setUsage(nextUsage)
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : 'Could not load the numbers.')
      } finally {
        if (!canceled) setLoading(false)
      }
    })()

    return () => {
      canceled = true
    }
  }, [])

  /* a) active users by role */
  const roleData = useMemo(() => {
    const active = profiles.filter((p) => !p.is_suspended)
    const order: AppRole[] = ['student', 'expert', 'admin']
    return order.map((role) => ({
      role,
      name: ROLE_LABEL[role],
      value: active.filter((p) => p.role === role).length,
      color: ROLE_COLOR[role],
    }))
  }, [profiles])

  const totalActive = roleData.reduce((sum, slice) => sum + slice.value, 0)

  /* b) bookings over the last 30 days */
  const { trend, trendStatuses } = useMemo(() => {
    const days: DayPoint[] = []
    const index = new Map<string, DayPoint>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let offset = 29; offset >= 0; offset--) {
      const date = new Date(today)
      date.setDate(today.getDate() - offset)
      const point: DayPoint = {
        day: dayKey(date),
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }
      days.push(point)
      index.set(point.day, point)
    }

    const seen = new Set<string>()
    for (const booking of bookings) {
      const point = index.get(dayKey(new Date(booking.created_at)))
      if (!point) continue
      seen.add(booking.status)
      point[booking.status] = ((point[booking.status] as number) ?? 0) + 1
    }

    const statuses = Object.keys(STATUS_COLOR).filter((status) => seen.has(status))
    // Zero-fill so every series is continuous across the axis.
    for (const point of days) {
      for (const status of statuses) {
        if (point[status] === undefined) point[status] = 0
      }
    }

    return { trend: days, trendStatuses: statuses }
  }, [bookings])

  /* c) transaction status breakdown */
  const statusBars = useMemo(() => {
    const counts = new Map<string, number>()
    for (const booking of bookings) {
      counts.set(booking.status, (counts.get(booking.status) ?? 0) + 1)
    }
    return Object.keys(STATUS_COLOR)
      .filter((status) => counts.has(status))
      .map((status) => ({
        status,
        label: STATUS_LABEL[status] ?? status,
        count: counts.get(status) ?? 0,
      }))
  }, [bookings])

  /* bonus) funnel */
  const firstBookings = useMemo(
    () => new Set(bookings.map((booking) => booking.student_id)).size,
    [bookings]
  )

  if (!supabaseReady) {
    return (
      <>
        <PageHeader title="Dashboard" description="Everything happening across the marketplace." />
        <MissingKeyNotice
          feature="The admin dashboard"
          hint="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then reload."
        />
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" description="Everything happening across the marketplace." />
        <LoadingBlock label="Pulling the latest numbers" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Everything happening across the marketplace." />
        <ErrorState message={error} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Everything happening across the marketplace, pulled live."
      />

      {/* d) AI and voice usage */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<MessageSquare className="h-4 w-4" aria-hidden />}
          value={usage.ai_chat}
          label="AI chat sessions"
        />
        <MetricCard
          icon={<Volume2 className="h-4 w-4" aria-hidden />}
          value={usage.tts_play}
          label="Text read aloud"
        />
        <MetricCard
          icon={<Mic className="h-4 w-4" aria-hidden />}
          value={usage.stt_use}
          label="Voice inputs"
        />
        <MetricCard
          icon={<Sparkles className="h-4 w-4" aria-hidden />}
          value={usage.match_score_run}
          label="Match runs"
        />
      </div>

      {/* bonus) conversion funnel */}
      <div className="mb-6 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <FunnelCard label="Landing visits" value={usage.landing_view} />
        <FunnelArrow />
        <FunnelCard label="Signups" value={usage.signup} previous={usage.landing_view} />
        <FunnelArrow />
        <FunnelCard label="Booked at least once" value={firstBookings} previous={usage.signup} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* a) donut */}
        <Card className="lg:col-span-1">
          <CardHeader title="Active users" description="Suspended accounts are left out." />
          <CardBody>
            {totalActive === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No accounts yet.</p>
            ) : (
              <>
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={84}
                        paddingAngle={2}
                        stroke={COLORS.white}
                        strokeWidth={2}
                      >
                        {roleData.map((slice) => (
                          <Cell key={slice.role} fill={slice.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="tabular font-heading text-2xl font-bold">{totalActive}</span>
                    <span className="text-xs text-slate-500">people</span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2">
                  {roleData.map((slice) => (
                    <li key={slice.role} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: slice.color }}
                        aria-hidden
                      />
                      <span className="text-slate-600">{slice.name}</span>
                      <span className="tabular ml-auto font-semibold">{slice.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>

        {/* b) 30 day trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Bookings, last 30 days"
            description="One point per day, split by where each booking ended up."
          />
          <CardBody>
            {trendStatuses.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                No bookings in the last 30 days.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                    <defs>
                      {trendStatuses.map((status) => (
                        <linearGradient
                          key={status}
                          id={`trend-${status}`}
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="0%" stopColor={STATUS_COLOR[status]} stopOpacity={0.55} />
                          <stop offset="100%" stopColor={STATUS_COLOR[status]} stopOpacity={0.04} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid
                      vertical={false}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                    />
                    <XAxis dataKey="label" interval={6} minTickGap={16} {...AXIS} />
                    <YAxis allowDecimals={false} width={40} {...AXIS} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#E2E8F0' }} />
                    {trendStatuses.map((status) => (
                      <Area
                        key={status}
                        type="monotone"
                        dataKey={status}
                        name={status}
                        stackId="bookings"
                        stroke={STATUS_COLOR[status]}
                        strokeWidth={1.5}
                        fill={`url(#trend-${status})`}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        {/* c) status breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader
            title="Transaction status breakdown"
            description="Every booking on the platform, counted by where it stands."
          />
          <CardBody>
            {statusBars.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">Nothing booked yet.</p>
            ) : (
              <div style={{ height: Math.max(200, statusBars.length * 44 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statusBars}
                    layout="vertical"
                    margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} {...AXIS} />
                    <YAxis type="category" dataKey="label" width={110} {...AXIS} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F1F5F9' }} />
                    <Bar dataKey="count" name="Bookings" radius={[0, 6, 6, 0]} barSize={20}>
                      {statusBars.map((bar) => (
                        <Cell key={bar.status} fill={STATUS_COLOR[bar.status]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

/* --------------------------------- small parts --------------------------------- */

function MetricCard({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: number
  label: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="tabular font-heading text-3xl font-bold leading-none">
            {value.toLocaleString('en-US')}
          </p>
          <p className="mt-2 text-sm text-slate-500">{label}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-nexus-indigo/5 text-nexus-indigo">
          {icon}
        </span>
      </div>
    </Card>
  )
}

function FunnelCard({
  label,
  value,
  previous,
}: {
  label: string
  value: number
  previous?: number
}) {
  const rate = previous && previous > 0 ? (value / previous) * 100 : null

  return (
    <Card className="flex-1 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="tabular font-heading text-2xl font-bold">
          {value.toLocaleString('en-US')}
        </span>
        {rate !== null && (
          <span className="tabular text-xs font-medium text-expert-teal">
            {rate.toFixed(1)}% of the step before
          </span>
        )}
      </div>
    </Card>
  )
}

function FunnelArrow() {
  return (
    <ChevronRight
      className="mx-auto h-5 w-5 shrink-0 rotate-90 text-slate-300 sm:mx-0 sm:rotate-0"
      aria-hidden
    />
  )
}

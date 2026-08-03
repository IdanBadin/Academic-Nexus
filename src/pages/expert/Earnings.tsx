import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { PageHeader } from '@/components/layout/AppLayout'
import { StatusBadge } from '@/components/ui/Badge'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { EmptyStateAnimation } from '@/components/lottie/Animations'
import { COLORS } from '@/config/theme'
import { useAuth } from '@/hooks/useAuth'
import { getBookingsForUser } from '@/lib/queries'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { BookingDetail } from '@/types/db'

interface MonthBucket {
  key: string
  label: string
  total: number
}

/** Six buckets ending with the current month, oldest first. */
function lastSixMonths(): MonthBucket[] {
  const now = new Date()
  const buckets: MonthBucket[] = []
  for (let back = 5; back >= 0; back--) {
    const date = new Date(now.getFullYear(), now.getMonth() - back, 1)
    buckets.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString('en-US', { month: 'short' }),
      total: 0,
    })
  }
  return buckets
}

function monthKey(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${date.getMonth()}`
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value?: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-control border border-slate-200 bg-white px-3 py-2 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.2)]">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-nexus-indigo">
        {formatCurrency(payload[0]?.value ?? 0)}
      </p>
    </div>
  )
}

export default function Earnings() {
  const { session } = useAuth()
  const expertId = session?.user?.id ?? null

  const [bookings, setBookings] = useState<BookingDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!expertId) return
    let canceled = false

    setLoading(true)
    setLoadError('')
    getBookingsForUser(expertId, 'expert')
      .then((all) => {
        if (canceled) return
        setBookings(all.filter((b) => b.status === 'completed'))
      })
      .catch((error: unknown) => {
        if (canceled) return
        setLoadError(
          error instanceof Error ? error.message : 'We could not load your earnings right now.'
        )
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [expertId])

  const { total, thisMonth, chart, rows } = useMemo(() => {
    const buckets = lastSixMonths()
    const index = new Map(buckets.map((b) => [b.key, b]))
    const currentKey = monthKey(new Date().toISOString())
    let sum = 0
    let month = 0

    for (const booking of bookings) {
      sum += booking.price
      const key = monthKey(booking.slot_datetime)
      if (key === currentKey) month += booking.price
      const bucket = index.get(key)
      if (bucket) bucket.total += booking.price
    }

    const sorted = [...bookings].sort(
      (a, b) => +new Date(b.slot_datetime) - +new Date(a.slot_datetime)
    )

    return { total: sum, thisMonth: month, chart: buckets, rows: sorted }
  }, [bookings])

  if (loading) return <LoadingBlock label="Adding up your sessions" />
  if (loadError) {
    return (
      <>
        <PageHeader title="Earnings" />
        <ErrorState message={loadError} />
      </>
    )
  }

  if (bookings.length === 0) {
    return (
      <>
        <PageHeader title="Earnings" />
        <EmptyState
          illustration={<EmptyStateAnimation />}
          title="No earnings yet"
          description="A session counts here once it is marked completed. Finish your first one and the numbers start filling in."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Earnings" description="Everything you have been paid for completed work." />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Total earned</p>
            <p className="tabular mt-1.5 font-heading text-2xl font-bold text-expert-teal">
              {formatCurrency(total)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">This month</p>
            <p className="tabular mt-1.5 font-heading text-2xl font-bold">
              {formatCurrency(thisMonth)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-sm text-slate-500">Sessions completed</p>
            <p className="tabular mt-1.5 font-heading text-2xl font-bold">{bookings.length}</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Last 6 months" description="Earnings by the month a session ran." />
        <CardBody>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: COLORS.statusSlate, fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: COLORS.statusSlate, fontSize: 12 }}
                  tickFormatter={(value: number) => formatCurrency(value)}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(13,148,136,0.06)' }}
                  content={<ChartTooltip />}
                />
                <Bar dataKey="total" fill={COLORS.expertTeal} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Paid sessions" description="Newest first." />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Student</th>
                  <th className="pb-2 pr-4 font-medium">Subject</th>
                  <th className="pb-2 pr-4 text-right font-medium">Amount</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((booking) => (
                  <tr key={booking.id} className="border-b border-slate-100 last:border-0">
                    <td className="tabular py-3 pr-4 text-slate-600">
                      {formatDate(booking.slot_datetime)}
                    </td>
                    <td className="py-3 pr-4 font-medium">
                      {booking.student?.full_name ?? 'Student'}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {booking.listing?.subject ?? 'Session'}
                    </td>
                    <td className="tabular py-3 pr-4 text-right font-semibold">
                      {formatCurrency(booking.price)}
                    </td>
                    <td className="py-3">
                      <StatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </>
  )
}

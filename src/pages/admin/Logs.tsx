import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Input, Select } from '@/components/ui/Field'
import { ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { STATUS_LABEL } from '@/config/theme'
import { listEventLogs } from '@/lib/queries'
import { supabaseReady } from '@/lib/supabase'
import { cn, formatDateTime } from '@/lib/utils'
import type { AppRole, EventLog, Profile } from '@/types/db'

type LogRow = EventLog & { user: Profile | null }

const ROLE_BADGE: Record<AppRole, string> = {
  student: 'border-student-amber/30 bg-student-amber/10 text-amber-700',
  expert: 'border-expert-teal/30 bg-expert-teal/10 text-expert-teal',
  admin: 'border-nexus-indigo/20 bg-nexus-indigo/10 text-nexus-indigo',
}

const BAD_EVENTS = ['dispute', 'error', 'fail', 'declin', 'cancel', 'suspend', 'refund']
const GOOD_EVENTS = [
  'signup',
  'login',
  'verified',
  'confirmed',
  'completed',
  'paid',
  'created',
  'resolved',
  'reinstated',
  'booking',
]

/** Green for things that went right, red for the ones that did not, slate otherwise. */
function eventTone(eventType: string): string {
  const type = eventType.toLowerCase()
  if (BAD_EVENTS.some((word) => type.includes(word))) {
    return 'border-status-red/30 bg-status-red/10 text-red-700'
  }
  if (GOOD_EVENTS.some((word) => type.includes(word))) {
    return 'border-status-green/30 bg-status-green/10 text-green-700'
  }
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function humanEvent(eventType: string): string {
  return eventType.replace(/_/g, ' ')
}

export default function AdminLogs() {
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [role, setRole] = useState('all')
  const [eventType, setEventType] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    let canceled = false
    listEventLogs(500)
      .then((data) => {
        if (!canceled) setRows(data)
      })
      .catch((err: unknown) => {
        if (!canceled) setError(err instanceof Error ? err.message : 'Could not load the log.')
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [])

  // Options come from whatever is actually in the log, not a hardcoded list.
  const eventOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.event_type))).sort(),
    [rows]
  )
  const statusOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.status).filter((value): value is string => Boolean(value)))
      ).sort(),
    [rows]
  )

  const filtered = useMemo(() => {
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null

    return rows.filter((row) => {
      if (role !== 'all' && row.role !== role) return false
      if (eventType !== 'all' && row.event_type !== eventType) return false
      if (status !== 'all' && row.status !== status) return false
      if (fromTime || toTime) {
        const stamp = new Date(row.created_at).getTime()
        if (fromTime && stamp < fromTime) return false
        if (toTime && stamp > toTime) return false
      }
      return true
    })
  }, [rows, role, eventType, status, from, to])

  const activeFilters = [
    role !== 'all',
    eventType !== 'all',
    status !== 'all',
    from !== '',
    to !== '',
  ].filter(Boolean).length

  const clearFilters = () => {
    setRole('all')
    setEventType('all')
    setStatus('all')
    setFrom('')
    setTo('')
  }

  const columns: Column<LogRow>[] = useMemo(
    () => [
      {
        key: 'created_at',
        header: 'When',
        sortable: true,
        className: 'whitespace-nowrap',
        render: (row) => (
          <span className="tabular text-slate-600">{formatDateTime(row.created_at)}</span>
        ),
      },
      {
        key: 'user',
        header: 'User',
        sortable: true,
        sortValue: (row) => row.user?.full_name ?? '',
        render: (row) => (
          <div className="flex items-center gap-2.5">
            <Avatar name={row.user?.full_name} url={row.user?.avatar_url} size="sm" />
            <span className="truncate">{row.user?.full_name ?? 'System'}</span>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        render: (row) =>
          row.role ? (
            <Badge className={cn('capitalize', ROLE_BADGE[row.role])}>{row.role}</Badge>
          ) : (
            <span className="text-slate-400">-</span>
          ),
      },
      {
        key: 'event_type',
        header: 'Event',
        sortable: true,
        render: (row) => (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
              eventTone(row.event_type)
            )}
          >
            {humanEvent(row.event_type)}
          </span>
        ),
      },
      {
        key: 'entity',
        header: 'Entity',
        sortable: true,
        render: (row) => (
          <span className="text-slate-500">{row.entity ?? <span className="text-slate-300">-</span>}</span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => {
          if (!row.status) return <span className="text-slate-300">-</span>
          return STATUS_LABEL[row.status] ? (
            <StatusBadge status={row.status} />
          ) : (
            <span className="capitalize text-slate-600">{row.status}</span>
          )
        },
      },
      {
        key: 'message',
        header: 'Message',
        sortable: false,
        className: 'max-w-[280px]',
        render: (row) =>
          row.message ? (
            <span className="block truncate text-slate-600" title={row.message}>
              {row.message}
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          ),
      },
    ],
    []
  )

  if (!supabaseReady) {
    return (
      <>
        <PageHeader title="Logs" description="Every event the app has written down." />
        <MissingKeyNotice
          feature="The activity log"
          hint="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then reload."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Logs"
        description="The last 500 events, newest first. Filters stack on top of each other."
      />

      <div className="mb-4 rounded-card border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Role</span>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role">
              <option value="all">Any role</option>
              <option value="student">Student</option>
              <option value="expert">Expert</option>
              <option value="admin">Admin</option>
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Event</span>
            <Select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              aria-label="Filter by event type"
            >
              <option value="all">Any event</option>
              {eventOptions.map((option) => (
                <option key={option} value={option} className="capitalize">
                  {humanEvent(option)}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">Status</span>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">Any status</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABEL[option] ?? option}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">From</span>
            <Input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
              aria-label="Filter from date"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">To</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
              aria-label="Filter to date"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <span className="tabular text-xs text-slate-500">
            {activeFilters === 0
              ? 'No filters on'
              : `${activeFilters} filter${activeFilters === 1 ? '' : 's'} on`}
          </span>
          {activeFilters > 0 && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4" aria-hidden />
              Clear filters
            </Button>
          )}
          <span className="tabular ml-auto text-xs text-slate-500">
            {filtered.length} of {rows.length} events
          </span>
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Loading events" />
      ) : error ? (
        <ErrorState message={error} />
      ) : (
        <DataTable
          rows={filtered}
          columns={columns}
          pageSize={25}
          getRowKey={(row) => row.id}
          emptyMessage={
            rows.length === 0
              ? 'Nothing has been logged yet.'
              : 'No events match those filters. Try clearing one.'
          }
        />
      )}
    </>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Ban, RotateCcw, Search } from 'lucide-react'
import { PageHeader } from '@/components/layout/AppLayout'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, VerifiedBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, LoadingBlock, MissingKeyNotice } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { listProfiles, updateProfile } from '@/lib/queries'
import { supabaseReady } from '@/lib/supabase'
import { cn, formatDate } from '@/lib/utils'
import type { AppRole, Profile } from '@/types/db'

const ROLE_BADGE: Record<AppRole, string> = {
  student: 'border-student-amber/30 bg-student-amber/10 text-amber-700',
  expert: 'border-expert-teal/30 bg-expert-teal/10 text-expert-teal',
  admin: 'border-nexus-indigo/20 bg-nexus-indigo/10 text-nexus-indigo',
}

export default function AdminUsers() {
  const { profile: me } = useAuth()
  const { push } = useToast()

  const [rows, setRows] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pendingSuspend, setPendingSuspend] = useState<Profile | null>(null)

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    let canceled = false
    listProfiles()
      .then((data) => {
        if (!canceled) setRows(data)
      })
      .catch((err: unknown) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : 'Could not load the user list.')
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false
      if (!needle) return true
      return (row.full_name ?? '').toLowerCase().includes(needle)
    })
  }, [rows, roleFilter, search])

  /** Writes optimistically, then puts the old row back if the write fails. */
  const applyPatch = async (
    target: Profile,
    patch: Partial<Profile>,
    event: { type: string; message: string },
    successCopy: string
  ) => {
    const previous = rows
    setBusyId(target.id)
    setRows((current) =>
      current.map((row) => (row.id === target.id ? { ...row, ...patch } : row))
    )

    try {
      await updateProfile(target.id, patch)
      await logEvent({
        userId: me?.id ?? null,
        role: 'admin',
        eventType: event.type,
        entity: `profiles:${target.id}`,
        status: 'success',
        message: event.message,
      })
      push('success', successCopy)
    } catch (err) {
      setRows(previous)
      push('error', err instanceof Error ? err.message : 'That change did not go through.')
    } finally {
      setBusyId(null)
    }
  }

  const verify = (target: Profile) =>
    applyPatch(
      target,
      { is_verified: true },
      { type: 'expert_verified', message: `${target.full_name ?? 'Expert'} verified` },
      `${target.full_name ?? 'This expert'} is verified now.`
    )

  const suspend = async (target: Profile) => {
    setPendingSuspend(null)
    await applyPatch(
      target,
      { is_suspended: true },
      { type: 'user_suspended', message: `${target.full_name ?? 'User'} suspended` },
      `${target.full_name ?? 'That account'} is suspended and can no longer sign in.`
    )
  }

  const reinstate = (target: Profile) =>
    applyPatch(
      target,
      { is_suspended: false },
      { type: 'user_reinstated', message: `${target.full_name ?? 'User'} reinstated` },
      `${target.full_name ?? 'That account'} can sign in again.`
    )

  if (!supabaseReady) {
    return (
      <>
        <PageHeader title="Users" description="Everyone with an account." />
        <MissingKeyNotice
          feature="User management"
          hint="Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file, then reload."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Verify experts, and suspend anyone who is causing trouble."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Search by name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search users by name"
          />
        </div>
        <Select
          className="w-40"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as 'all' | AppRole)}
          aria-label="Filter by role"
        >
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="expert">Experts</option>
          <option value="admin">Admins</option>
        </Select>
        <span className="tabular text-sm text-slate-500">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {loading ? (
        <LoadingBlock label="Loading accounts" />
      ) : error ? (
        <ErrorState message={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No one matches that"
          description="Try a different name, or set the role filter back to all roles."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="bg-slate-50/95">
                <tr>
                  {['Person', 'Role', 'Joined', 'Standing', ''].map((header, i) => (
                    <th
                      key={header || i}
                      scope="col"
                      className={cn(
                        'border-b border-slate-200 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500',
                        i === 4 && 'text-right'
                      )}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition-colors duration-150 ease-out last:border-b-0 hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={row.full_name} url={row.avatar_url} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{row.full_name ?? 'Unnamed'}</p>
                          <p className="truncate text-xs text-slate-400">{row.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn('capitalize', ROLE_BADGE[row.role])}>{row.role}</Badge>
                    </td>
                    <td className="tabular px-4 py-3 text-slate-600">
                      {formatDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {row.is_verified && <VerifiedBadge />}
                        {row.is_suspended ? (
                          <Badge className="border-status-red/30 bg-status-red/10 text-red-700">
                            Suspended
                          </Badge>
                        ) : (
                          <Badge className="border-status-green/30 bg-status-green/10 text-green-700">
                            Active
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {row.role === 'expert' && !row.is_verified && (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyId === row.id}
                            onClick={() => verify(row)}
                          >
                            <BadgeCheck className="h-4 w-4" aria-hidden />
                            Verify
                          </Button>
                        )}
                        {row.is_suspended ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busyId === row.id}
                            onClick={() => reinstate(row)}
                          >
                            <RotateCcw className="h-4 w-4" aria-hidden />
                            Reinstate
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={row.id === me?.id}
                            onClick={() => setPendingSuspend(row)}
                          >
                            <Ban className="h-4 w-4" aria-hidden />
                            Suspend
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={pendingSuspend !== null}
        onClose={() => setPendingSuspend(null)}
        title="Suspend this account?"
        description={`${pendingSuspend?.full_name ?? 'This person'} gets locked out at the login screen until an admin reinstates them.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingSuspend(null)}>
              Keep it active
            </Button>
            <Button
              variant="danger"
              onClick={() => pendingSuspend && suspend(pendingSuspend)}
              loading={busyId === pendingSuspend?.id}
            >
              Suspend
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-slate-600">
          Open bookings stay in the database, and an expert&apos;s listings drop out of search right
          away. Nothing is deleted, so reinstating puts everything back.
        </p>
      </Modal>
    </>
  )
}

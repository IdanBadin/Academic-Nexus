import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, supabaseReady } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Message } from '@/types/db'

/**
 * Unread tracking is deliberately dumb: one ISO timestamp per booking in
 * localStorage, nothing else. No message bodies, no names, no ids beyond the
 * booking id already in the URL - so a shared machine leaks nothing.
 */
const KEY_PREFIX = 'an:lastread:'

function readLastSeen(bookingId: string): string | null {
  try {
    return window.localStorage.getItem(KEY_PREFIX + bookingId)
  } catch {
    return null
  }
}

function writeLastSeen(bookingId: string, iso: string): void {
  try {
    window.localStorage.setItem(KEY_PREFIX + bookingId, iso)
  } catch {
    // Private mode or a full quota - unread badges are not worth throwing over.
  }
}

export interface UnreadCounts {
  counts: Record<string, number>
  markRead: (bookingId: string) => void
}

export function useUnreadCounts(bookingIds: string[]): UnreadCounts {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  // Stable identity so the effects below do not re-run on every render.
  const key = bookingIds.join(',')
  const ids = useMemo(() => bookingIds.filter(Boolean), [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const [counts, setCounts] = useState<Record<string, number>>({})

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const idSet = useMemo(() => new Set(ids), [ids])
  const idSetRef = useRef(idSet)
  idSetRef.current = idSet

  /* ---------- first pass over what is already in the table ---------- */
  useEffect(() => {
    if (!supabaseReady || !myId || ids.length === 0) {
      setCounts({})
      return
    }

    let canceled = false

    supabase
      .from('messages')
      .select('id,booking_id,sender_id,created_at')
      .in('booking_id', ids)
      .neq('sender_id', myId)
      .then(({ data, error }) => {
        if (canceled || !alive.current || error) return
        const next: Record<string, number> = {}
        for (const id of ids) next[id] = 0
        for (const row of (data ?? []) as Message[]) {
          const seen = readLastSeen(row.booking_id)
          if (!seen || row.created_at > seen) next[row.booking_id] = (next[row.booking_id] ?? 0) + 1
        }
        setCounts(next)
      })

    return () => {
      canceled = true
    }
  }, [ids, myId])

  /* ---------- one channel for the whole list ---------- */
  useEffect(() => {
    if (!supabaseReady || !myId || ids.length === 0) return

    const channel: RealtimeChannel = supabase
      .channel(`messages:unread:${myId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (!alive.current) return
          const row = payload.new as Message
          if (row.sender_id === myId) return
          if (!idSetRef.current.has(row.booking_id)) return
          const seen = readLastSeen(row.booking_id)
          if (seen && row.created_at <= seen) return
          setCounts((current) => ({
            ...current,
            [row.booking_id]: (current[row.booking_id] ?? 0) + 1,
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [ids, myId])

  const markRead = useCallback((bookingId: string) => {
    writeLastSeen(bookingId, new Date().toISOString())
    setCounts((current) => (current[bookingId] ? { ...current, [bookingId]: 0 } : current))
  }, [])

  return useMemo(() => ({ counts, markRead }), [counts, markRead])
}

/** Just the number for the nav badge, across every booking you are part of. */
export function useTotalUnread(): number {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null
  const [bookingIds, setBookingIds] = useState<string[]>([])

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    if (!supabaseReady || !myId) {
      setBookingIds([])
      return
    }

    let canceled = false

    supabase
      .from('bookings')
      .select('id')
      .or(`student_id.eq.${myId},expert_id.eq.${myId}`)
      .then(({ data, error }) => {
        if (canceled || !alive.current || error) return
        setBookingIds(((data ?? []) as { id: string }[]).map((row) => row.id))
      })

    return () => {
      canceled = true
    }
  }, [myId])

  const { counts } = useUnreadCounts(bookingIds)

  return useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts])
}

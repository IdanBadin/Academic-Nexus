import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase, supabaseReady } from '@/lib/supabase'
import { getBooking } from '@/lib/queries'
import { useAuth } from '@/hooks/useAuth'
import type { BookingStatus, Message, Profile } from '@/types/db'

/** The thread only opens once both sides are actually committed to the session. */
export const CHAT_OPEN_STATUSES: BookingStatus[] = ['confirmed', 'in_progress', 'completed']

export function chatIsOpen(status: BookingStatus | null | undefined): boolean {
  return !!status && CHAT_OPEN_STATUSES.includes(status)
}

export interface ChatParticipants {
  /** The signed in person, as far as this booking is concerned. */
  me: Profile | null
  /** The person on the other side of the thread. */
  other: Profile | null
  otherRole: 'student' | 'expert' | null
  status: BookingStatus | null
  /** False until the booking reaches a status where the thread is allowed. */
  canChat: boolean
}

export interface UseChat {
  messages: Message[]
  loading: boolean
  error: string | null
  sending: boolean
  send: (body: string) => Promise<void>
  participants: ChatParticipants
  /** True once the realtime channel reports SUBSCRIBED. */
  connected: boolean
}

const EMPTY_PARTICIPANTS: ChatParticipants = {
  me: null,
  other: null,
  otherRole: null,
  status: null,
  canChat: false,
}

/** Merge helper - never lets the same message id land in the list twice. */
function mergeMessage(list: Message[], next: Message): Message[] {
  if (list.some((m) => m.id === next.id)) return list
  const merged = [...list, next]
  merged.sort((a, b) => a.created_at.localeCompare(b.created_at))
  return merged
}

export function useChat(bookingId: string): UseChat {
  const { session } = useAuth()
  const myId = session?.user?.id ?? null

  const [messages, setMessages] = useState<Message[]>([])
  const [participants, setParticipants] = useState<ChatParticipants>(EMPTY_PARTICIPANTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [connected, setConnected] = useState(false)

  const alive = useRef(true)
  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  /* ---------- who is in this thread, and is it open yet ---------- */
  useEffect(() => {
    if (!bookingId) return
    if (!supabaseReady) {
      setLoading(false)
      setError('Supabase is not configured yet.')
      return
    }

    let canceled = false
    setLoading(true)
    setError(null)

    getBooking(bookingId)
      .then((booking) => {
        if (canceled || !alive.current) return
        if (!booking) {
          setParticipants(EMPTY_PARTICIPANTS)
          setError('That booking could not be found.')
          setLoading(false)
          return
        }
        const iAmStudent = booking.student_id === myId
        setParticipants({
          me: iAmStudent ? booking.student : booking.expert,
          other: iAmStudent ? booking.expert : booking.student,
          otherRole: iAmStudent ? 'expert' : 'student',
          status: booking.status,
          canChat: chatIsOpen(booking.status),
        })
        if (!chatIsOpen(booking.status)) {
          setMessages([])
          setLoading(false)
        }
      })
      .catch(() => {
        if (canceled || !alive.current) return
        setError('Could not load this booking.')
        setLoading(false)
      })

    return () => {
      canceled = true
    }
  }, [bookingId, myId])

  /* ---------- history + live inserts ---------- */
  const canChat = participants.canChat

  useEffect(() => {
    if (!bookingId || !canChat || !supabaseReady) return

    let canceled = false
    let channel: RealtimeChannel | null = null

    setLoading(true)

    supabase
      .from('messages')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true })
      .then(({ data, error: loadError }) => {
        if (canceled || !alive.current) return
        if (loadError) {
          setError('Could not load the messages.')
          setLoading(false)
          return
        }
        setMessages((current) => {
          // Anything the realtime channel already delivered stays put.
          const rows = (data ?? []) as Message[]
          const pending = current.filter(
            (m) => m.id.startsWith('tmp-') || !rows.some((r) => r.id === m.id)
          )
          return [...rows, ...pending]
        })
        setLoading(false)
      })

    channel = supabase
      .channel(`messages:booking:${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          if (!alive.current) return
          const row = payload.new as Message
          setMessages((current) => {
            // Drop our own optimistic copy before merging the real row in.
            const withoutEcho = current.filter(
              (m) => !(m.id.startsWith('tmp-') && m.sender_id === row.sender_id && m.body === row.body)
            )
            return mergeMessage(withoutEcho, row)
          })
        }
      )
      .subscribe((status) => {
        if (!alive.current) return
        setConnected(status === 'SUBSCRIBED')
      })

    return () => {
      canceled = true
      setConnected(false)
      if (channel) supabase.removeChannel(channel)
    }
  }, [bookingId, canChat])

  /* ---------- sending ---------- */
  const send = useCallback(
    async (body: string) => {
      const text = body.trim()
      if (!text || !myId || !bookingId || !canChat) return

      const tempId = `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`
      const optimistic: Message = {
        id: tempId,
        booking_id: bookingId,
        sender_id: myId,
        body: text,
        created_at: new Date().toISOString(),
      }

      setSending(true)
      setError(null)
      setMessages((current) => [...current, optimistic])

      const { data, error: insertError } = await supabase
        .from('messages')
        .insert({ booking_id: bookingId, sender_id: myId, body: text })
        .select()
        .single()

      if (!alive.current) return

      if (insertError || !data) {
        setMessages((current) => current.filter((m) => m.id !== tempId))
        setError('That message did not go through. Try again.')
        setSending(false)
        throw new Error(insertError?.message ?? 'Message insert failed')
      }

      const row = data as Message
      setMessages((current) => {
        const withoutTemp = current.filter((m) => m.id !== tempId)
        return mergeMessage(withoutTemp, row)
      })
      setSending(false)
    },
    [bookingId, canChat, myId]
  )

  return useMemo(
    () => ({ messages, loading, error, sending, send, participants, connected }),
    [messages, loading, error, sending, send, participants, connected]
  )
}

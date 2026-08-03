import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, MessageSquare, Send } from 'lucide-react'
import { useChat } from '@/hooks/useChat'
import { useUnreadCounts } from '@/hooks/useUnread'
import { useAuth } from '@/hooks/useAuth'
import { logEvent } from '@/lib/logEvent'
import { cn, formatDateTime } from '@/lib/utils'
import type { Message } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Field'
import { LoadingBlock } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'

/** How far off the bottom still counts as "reading the newest stuff". */
const NEAR_BOTTOM_PX = 96
const MAX_COMPOSER_PX = 112 // roughly four rows

function startOfDay(iso: string): number {
  const d = new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dayLabel(iso: string): string {
  const today = startOfDay(new Date().toISOString())
  const day = startOfDay(iso)
  const dayMs = 86_400_000
  if (day === today) return 'Today'
  if (day === today - dayMs) return 'Yesterday'
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

interface Row {
  message: Message
  mine: boolean
  showDivider: boolean
  startsRun: boolean
  endsRun: boolean
}

function buildRows(messages: Message[], myId: string | null): Row[] {
  return messages.map((message, i) => {
    const prev = messages[i - 1]
    const next = messages[i + 1]
    const showDivider = !prev || startOfDay(prev.created_at) !== startOfDay(message.created_at)
    return {
      message,
      mine: message.sender_id === myId,
      showDivider,
      startsRun: showDivider || !prev || prev.sender_id !== message.sender_id,
      endsRun:
        !next ||
        next.sender_id !== message.sender_id ||
        startOfDay(next.created_at) !== startOfDay(message.created_at),
    }
  })
}

export function BookingChat({ bookingId, className }: { bookingId: string; className?: string }) {
  const { session, role } = useAuth()
  const myId = session?.user?.id ?? null
  const { push } = useToast()
  const { messages, loading, error, sending, send, participants, connected } = useChat(bookingId)
  const { markRead } = useUnreadCounts(useMemo(() => [bookingId], [bookingId]))

  const [draft, setDraft] = useState('')
  const [showNewPill, setShowNewPill] = useState(false)

  const listRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const nearBottomRef = useRef(true)
  const lastCountRef = useRef(0)

  const rows = useMemo(() => buildRows(messages, myId), [messages, myId])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = listRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
    nearBottomRef.current = true
    setShowNewPill(false)
  }, [])

  const handleScroll = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    nearBottomRef.current = distance <= NEAR_BOTTOM_PX
    if (nearBottomRef.current) setShowNewPill(false)
  }, [])

  /* Stick to the bottom only when the reader is already there. */
  useLayoutEffect(() => {
    if (!participants.canChat) return
    const count = messages.length
    const grew = count > lastCountRef.current
    const first = lastCountRef.current === 0 && count > 0
    lastCountRef.current = count
    if (!grew) return

    if (first || nearBottomRef.current) {
      scrollToBottom(first ? 'auto' : 'smooth')
    } else {
      const last = messages[count - 1]
      if (last && last.sender_id !== myId) setShowNewPill(true)
    }
  }, [messages, myId, participants.canChat, scrollToBottom])

  /* Mark the thread read on mount and whenever something lands while we are looking. */
  useEffect(() => {
    if (!participants.canChat) return
    if (document.visibilityState !== 'visible') return
    markRead(bookingId)
  }, [bookingId, markRead, messages.length, participants.canChat])

  /* Auto-grow the composer, capped at about four rows. */
  useEffect(() => {
    const el = composerRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_COMPOSER_PX)}px`
  }, [draft])

  const submit = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    try {
      await send(text)
      nearBottomRef.current = true
      void logEvent({
        userId: myId,
        role,
        eventType: 'message_sent',
        entity: 'messages',
        status: 'success',
        message: `booking ${bookingId}`,
      })
    } catch {
      setDraft(text)
      push('error', 'That message did not send. Try again.')
    }
  }, [bookingId, draft, myId, push, role, send, sending])

  /* ---------- gate ---------- */
  if (participants.status === null && loading && !error) {
    return (
      <div className={cn('rounded-card border border-slate-200 bg-white', className)}>
        <LoadingBlock label="Loading messages" />
      </div>
    )
  }

  if (!participants.canChat) {
    return (
      <div
        className={cn(
          'flex min-h-[220px] flex-col items-center justify-center rounded-card border border-slate-200 bg-white px-6 py-12 text-center',
          className
        )}
      >
        <MessageSquare className="h-6 w-6 text-slate-300" aria-hidden />
        <p className="mt-3 text-sm font-medium text-nexus-indigo">Messages open after confirmation</p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">
          {error
            ? error
            : 'Once this booking is confirmed you and the other side can talk here about what to cover.'}
        </p>
      </div>
    )
  }

  const other = participants.other
  const otherLabel = other?.full_name ?? 'Your session partner'

  return (
    <div
      className={cn(
        'flex h-[560px] flex-col overflow-hidden rounded-card border border-slate-200 bg-white',
        className
      )}
    >
      {/* header */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <Avatar name={otherLabel} url={other?.avatar_url} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-nexus-indigo">
            {otherLabel}
          </p>
          <p className="text-xs capitalize text-slate-500">{participants.otherRole ?? 'member'}</p>
        </div>
        {connected && (
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="h-2 w-2 rounded-full bg-expert-teal"
              aria-hidden
            />
            Connected
          </span>
        )}
      </div>

      {/* messages */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={listRef}
          onScroll={handleScroll}
          aria-live="polite"
          aria-relevant="additions"
          className="h-full space-y-1 overflow-y-auto px-4 py-4"
        >
          {loading && messages.length === 0 ? (
            <LoadingBlock label="Loading messages" />
          ) : messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="text-sm text-slate-500">
                Nothing here yet. Say what you want to get out of the session and where you are
                stuck.
              </p>
            </div>
          ) : (
            rows.map(({ message, mine, showDivider, startsRun, endsRun }) => (
              <div key={message.id}>
                {showDivider && (
                  <div className="flex items-center justify-center py-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">
                      {dayLabel(message.created_at)}
                    </span>
                  </div>
                )}
                <div
                  className={cn(
                    'group flex flex-col',
                    mine ? 'items-end' : 'items-start',
                    startsRun ? 'mt-3 first:mt-0' : 'mt-0.5'
                  )}
                >
                  {startsRun && !mine && (
                    <span className="mb-1 px-1 text-xs font-medium text-slate-500">
                      {otherLabel}
                    </span>
                  )}
                  <div
                    className={cn(
                      'max-w-[80%] whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed',
                      mine
                        ? 'rounded-2xl rounded-br-md bg-expert-teal text-white'
                        : 'rounded-2xl rounded-bl-md border border-slate-200 bg-white text-nexus-indigo',
                      message.id.startsWith('tmp-') && 'opacity-70'
                    )}
                  >
                    {message.body}
                  </div>
                  <span
                    title={formatDateTime(message.created_at)}
                    className={cn(
                      'mt-1 px-1 text-[11px] text-slate-400 transition-opacity duration-150',
                      endsRun ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                  >
                    {timeLabel(message.created_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {showNewPill && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-nexus-indigo px-3 py-1.5 text-xs font-medium text-white shadow-lg transition-transform duration-150 ease-out hover:scale-[1.03]"
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
            New message
          </button>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={composerRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder="Write a message"
            aria-label="Message"
            className="max-h-28 min-h-[2.5rem] resize-none"
          />
          <Button
            type="button"
            size="md"
            onClick={() => void submit()}
            loading={sending}
            disabled={draft.trim().length === 0}
            aria-label="Send message"
            className="shrink-0"
          >
            {!sending && <Send className="h-4 w-4" aria-hidden />}
            Send
          </Button>
        </div>
        {error && messages.length > 0 && (
          <p role="alert" className="mt-2 text-xs text-status-red">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

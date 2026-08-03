import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Mic, Send, Sparkles, Square, Volume2, X } from 'lucide-react'

import { AI_CONFIG } from '@/config/ai'
import { isConfigured, MISSING_KEY_HINT } from '@/config/env'
import { sendToGemini, type AiMessage } from '@/lib/gemini'
import { speakText, transcribeAudio } from '@/lib/elevenlabs'
import { listActiveListings } from '@/lib/queries'
import { logEvent } from '@/lib/logEvent'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import { useAiAssistant } from './AiAssistantContext'

import { Avatar } from '@/components/ui/Avatar'
import { VerifiedBadge } from '@/components/ui/Badge'
import { Textarea } from '@/components/ui/Field'
import { Rating } from '@/components/ui/Rating'
import { MissingKeyNotice, Spinner } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AiThinkingAnimation, MatchFoundAnimation } from '@/components/lottie/Animations'
import type { ListingWithExpert } from '@/types/db'

/* ------------------------------ role config ------------------------------ */

const ROLE_COPY = {
  student: {
    title: 'Matching and Guidance',
    greeting:
      "Tell me what you are stuck on and I will find you two or three experts who handle it. Course, topic, whatever you have already tried - all useful.",
    suggestions: [
      'I have a linear algebra midterm in five days and eigenvalues are not clicking',
      'I need someone to review a stats assignment before Friday',
      'Who can help with a Python project under $50 an hour?',
    ],
  },
  expert: {
    title: 'Listing Optimization',
    greeting:
      'Paste a listing description and I will tell you what is doing no work in it, then check your price against what people are actually charging for that subject and level.',
    suggestions: [
      'Here is my description - what is weak about it?',
      'What should I charge for Graduate Statistics?',
      'Rewrite my listing so it says who it is for',
    ],
  },
} as const

type Mode = keyof typeof ROLE_COPY

interface ChatMessage extends AiMessage {
  /** Experts the model recommended in this turn, matched back to real rows. */
  listings?: ListingWithExpert[]
}

/* -------------------------------- helpers -------------------------------- */

let counter = 0
const nextId = () => `m${Date.now().toString(36)}-${counter++}`

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

/** Compact enough that 30 listings do not eat the whole context window. */
function summarizeListings(listings: ListingWithExpert[]): string {
  const rows = listings.slice(0, 30).map((listing) => {
    const name = listing.expert.full_name ?? 'Unnamed expert'
    const rating =
      listing.stats.review_count > 0
        ? `${listing.stats.avg_rating.toFixed(1)} stars / ${listing.stats.review_count} reviews`
        : 'no reviews yet'
    return `- ${name} | ${listing.subject} | ${listing.level} | ${listing.format} | $${listing.price} for ${listing.duration_min} min | ${rating}`
  })

  if (rows.length === 0) {
    return '\n\nLIVE LISTINGS: none are active right now. Tell the student there is nothing to recommend yet rather than inventing an expert.'
  }

  return `\n\nLIVE LISTINGS (the only experts you may name):\n${rows.join('\n')}`
}

/** Min / median / max price per subject and level, from real active listings. */
function summarizeMarket(listings: ListingWithExpert[]): string {
  const buckets = new Map<string, number[]>()
  for (const listing of listings) {
    const key = `${listing.subject} | ${listing.level}`
    const prices = buckets.get(key) ?? []
    prices.push(listing.price)
    buckets.set(key, prices)
  }

  if (buckets.size === 0) {
    return '\n\nMARKET DATA: no active listings yet, so there is no going rate to quote. Say that plainly instead of guessing a number.'
  }

  const rows = [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(
      ([key, prices]) =>
        `- ${key}: low $${Math.min(...prices)}, median $${median(prices)}, high $${Math.max(
          ...prices
        )} across ${prices.length} listing${prices.length === 1 ? '' : 's'}`
    )

  return `\n\nMARKET DATA (the only prices you may cite):\n${rows.join('\n')}`
}

/**
 * Pulls the trailing `RECOMMENDED: A, B` line out of a reply and matches the
 * names back to real listings. Anything the model made up is dropped.
 */
function extractRecommendations(
  reply: string,
  listings: ListingWithExpert[]
): { text: string; matched: ListingWithExpert[] } {
  const match = reply.match(/^\s*RECOMMENDED\s*:\s*(.+)$/im)
  if (!match) return { text: reply.trim(), matched: [] }

  const names = match[1]
    .split(',')
    .map((name) => name.trim().replace(/[.*_]+$/g, '').toLowerCase())
    .filter(Boolean)

  const matched: ListingWithExpert[] = []
  const seen = new Set<string>()

  for (const name of names) {
    const hit = listings.find((listing) => {
      const full = listing.expert.full_name?.toLowerCase()
      return Boolean(full) && (full === name || full!.includes(name) || name.includes(full!))
    })
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id)
      matched.push(hit)
    }
  }

  return { text: reply.replace(match[0], '').trim(), matched }
}

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong on my side. Try that again.'
}

/* ----------------------------- expert result ----------------------------- */

function ExpertResultCard({ listing }: { listing: ListingWithExpert }) {
  return (
    <Link
      to={`/student/experts/${listing.expert_id}`}
      className={cn(
        'flex items-start gap-3 rounded-control border border-slate-200 bg-white p-3',
        'transition-[border-color,transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-0.5 hover:border-expert-teal/40 hover:shadow-[0_8px_20px_-10px_rgba(15,23,42,0.25)]'
      )}
    >
      <Avatar name={listing.expert.full_name} url={listing.expert.avatar_url} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-nexus-indigo">
            {listing.expert.full_name ?? 'Unnamed expert'}
          </span>
          {listing.expert.is_verified && <VerifiedBadge />}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {listing.subject} - {listing.level}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <Rating value={listing.stats.avg_rating} count={listing.stats.review_count} size="sm" />
          <span className="tabular shrink-0 text-sm font-semibold text-expert-teal">
            {formatCurrency(listing.price)}
          </span>
        </div>
      </div>
    </Link>
  )
}

/* -------------------------------- widget --------------------------------- */

export function AiChatWidget() {
  const { session, role } = useAuth()
  const { isOpen, toggle, close, pendingPrompt, clearPendingPrompt } = useAiAssistant()
  const toast = useToast()
  const recorder = useVoiceRecorder()

  const mode: Mode = role === 'expert' ? 'expert' : 'student'
  const copy = ROLE_COPY[mode]

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  const listingsRef = useRef<ListingWithExpert[]>([])
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const aiReady = isConfigured.googleAi
  const voiceReady = isConfigured.elevenLabs

  /* greeting on first open */
  useEffect(() => {
    if (!isOpen) return
    setMessages((current) =>
      current.length > 0
        ? current
        : [{ id: nextId(), role: 'assistant', content: copy.greeting }]
    )
  }, [isOpen, copy.greeting])

  /* a draft handed over from another page */
  useEffect(() => {
    if (!isOpen || !pendingPrompt) return
    setInput(pendingPrompt)
    clearPendingPrompt()
    window.requestAnimationFrame(() => inputRef.current?.focus())
  }, [isOpen, pendingPrompt, clearPendingPrompt])

  /* stick to the newest message */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  /* auto-grow the composer to about four rows */
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 104)}px`
  }, [input])

  /* never leave audio playing behind a closed panel */
  useEffect(() => {
    if (isOpen) return
    audioRef.current?.pause()
    audioRef.current = null
    setSpeakingId(null)
  }, [isOpen])

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (recorder.error) toast.push('error', recorder.error)
  }, [recorder.error, toast])

  /** Base prompt plus whatever live data this role needs to stay honest. */
  const buildSystemPrompt = useCallback(async (): Promise<string> => {
    const base = AI_CONFIG.systemPrompts[mode]
    try {
      const listings = await listActiveListings()
      listingsRef.current = listings
      return base + (mode === 'student' ? summarizeListings(listings) : summarizeMarket(listings))
    } catch {
      listingsRef.current = []
      return `${base}\n\nNOTE: the live listing data could not be loaded this time. Say you cannot see the current listings rather than naming an expert or a price.`
    }
  }, [mode])

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim()
      if (!text || sending || !aiReady) return

      const userMessage: ChatMessage = { id: nextId(), role: 'user', content: text }
      const history = messages.map(({ id, role: r, content }) => ({ id, role: r, content }))

      setMessages((current) => [...current, userMessage])
      setInput('')
      setSending(true)

      void logEvent({
        userId: session?.user?.id ?? null,
        role,
        eventType: 'ai_chat',
        entity: 'ai',
        status: 'success',
        message: text.slice(0, 80),
      })

      try {
        const systemPrompt = await buildSystemPrompt()
        const reply = await sendToGemini({ systemPrompt, history, userMessage: text })

        const { text: body, matched } =
          mode === 'student'
            ? extractRecommendations(reply, listingsRef.current)
            : { text: reply, matched: [] as ListingWithExpert[] }

        setMessages((current) => [
          ...current,
          {
            id: nextId(),
            role: 'assistant',
            content: body || reply,
            listings: matched.length > 0 ? matched : undefined,
          },
        ])

        if (matched.length > 0) {
          void logEvent({
            userId: session?.user?.id ?? null,
            role,
            eventType: 'match_found',
            entity: 'ai',
            status: 'success',
            message: matched.map((l) => l.expert.full_name ?? l.expert_id).join(', ').slice(0, 80),
          })
        }
      } catch (error) {
        setMessages((current) => [
          ...current,
          { id: nextId(), role: 'assistant', content: errorText(error) },
        ])
      } finally {
        setSending(false)
      }
    },
    [aiReady, buildSystemPrompt, messages, mode, role, sending, session?.user?.id]
  )

  const handleMic = useCallback(async () => {
    if (!voiceReady) return

    if (!recorder.isRecording) {
      await recorder.start()
      return
    }

    const blob = await recorder.stop()
    if (!blob) return

    setTranscribing(true)
    try {
      const text = await transcribeAudio(blob)
      // Deliberately not auto-sent - people want to read it back first.
      setInput((current) => (current ? `${current} ${text}` : text))
      inputRef.current?.focus()
      void logEvent({
        userId: session?.user?.id ?? null,
        role,
        eventType: 'stt_use',
        entity: 'voice',
        status: 'success',
      })
    } catch (error) {
      toast.push('error', errorText(error))
    } finally {
      setTranscribing(false)
    }
  }, [recorder, role, session?.user?.id, toast, voiceReady])

  const handleListen = useCallback(
    async (message: ChatMessage) => {
      if (!voiceReady) return

      audioRef.current?.pause()
      audioRef.current = null

      if (speakingId === message.id) {
        setSpeakingId(null)
        return
      }

      setSpeakingId(message.id)
      try {
        const audio = await speakText(message.content)
        audioRef.current = audio
        audio.addEventListener('ended', () => setSpeakingId(null), { once: true })
        void logEvent({
          userId: session?.user?.id ?? null,
          role,
          eventType: 'tts_play',
          entity: 'voice',
          status: 'success',
        })
      } catch (error) {
        setSpeakingId(null)
        toast.push('error', errorText(error))
      }
    },
    [role, session?.user?.id, speakingId, toast, voiceReady]
  )

  const showSuggestions = useMemo(
    () => aiReady && messages.length <= 1 && !sending,
    [aiReady, messages.length, sending]
  )

  if (!session) return null

  return (
    <>
      {isOpen && (
        <div
          className={cn(
            'fixed z-40 flex animate-slide-up flex-col overflow-hidden rounded-card border border-slate-200 bg-white',
            'shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-16px_rgba(15,23,42,0.28)]',
            'inset-x-3 bottom-24 max-h-[70vh]',
            'sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[560px] sm:max-h-[calc(100vh-8rem)] sm:w-[380px]'
          )}
          role="dialog"
          aria-label={`${copy.title} assistant`}
        >
          {/* header */}
          <div className="flex items-center gap-2.5 border-b border-slate-200 bg-cloud px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-expert-teal/10">
              <Sparkles className="h-4 w-4 text-expert-teal" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-semibold text-nexus-indigo">
                {copy.title}
              </p>
              <p className="truncate text-xs text-slate-500">
                {mode === 'expert' ? 'Sharpens your listings' : 'Finds you an expert'}
              </p>
            </div>
            <button
              onClick={close}
              aria-label="Close assistant"
              className="-m-1 rounded-md p-1 text-slate-400 transition-colors duration-150 hover:text-nexus-indigo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message) => (
              <div key={message.id} className="animate-fade-in">
                <div
                  className={cn(
                    'flex',
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] whitespace-pre-wrap rounded-card px-3.5 py-2.5 text-sm leading-relaxed',
                      message.role === 'user'
                        ? 'bg-expert-teal text-white'
                        : 'border border-slate-200 bg-white text-nexus-indigo'
                    )}
                  >
                    {message.content}
                  </div>
                </div>

                {message.role === 'assistant' && voiceReady && (
                  <button
                    onClick={() => void handleListen(message)}
                    aria-label={speakingId === message.id ? 'Stop reading' : 'Read this out loud'}
                    className={cn(
                      'mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs',
                      'transition-colors duration-150 ease-out',
                      speakingId === message.id
                        ? 'text-expert-teal'
                        : 'text-slate-400 hover:text-nexus-indigo'
                    )}
                  >
                    {speakingId === message.id ? (
                      <>
                        <Square className="h-3 w-3 fill-current" aria-hidden />
                        Stop
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3.5 w-3.5" aria-hidden />
                        Listen
                      </>
                    )}
                  </button>
                )}

                {message.listings && message.listings.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex justify-center">
                      <MatchFoundAnimation loop={false} className="h-20 w-20" />
                    </div>
                    {message.listings.map((listing) => (
                      <ExpertResultCard key={listing.id} listing={listing} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-card border border-slate-200 bg-white px-3.5 py-2">
                  <AiThinkingAnimation />
                </div>
              </div>
            )}

            {showSuggestions && (
              <div className="space-y-1.5 pt-1">
                {copy.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion)
                      inputRef.current?.focus()
                    }}
                    className={cn(
                      'block w-full rounded-control border border-slate-200 bg-cloud px-3 py-2 text-left text-xs leading-relaxed text-slate-600',
                      'transition-[background-color,border-color,color] duration-150 ease-out',
                      'hover:border-expert-teal/40 hover:bg-white hover:text-nexus-indigo'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-slate-200 bg-white p-3">
            {!aiReady ? (
              <MissingKeyNotice feature="The assistant" hint={MISSING_KEY_HINT.googleAi} />
            ) : (
              <div className="flex items-end gap-2">
                {voiceReady && (
                  <button
                    onClick={() => void handleMic()}
                    disabled={transcribing}
                    aria-label={recorder.isRecording ? 'Stop recording' : 'Record a message'}
                    className={cn(
                      'flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-control px-2.5 text-sm',
                      'transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.98]',
                      'disabled:pointer-events-none disabled:opacity-50',
                      recorder.isRecording
                        ? 'bg-status-red text-white'
                        : 'border border-slate-200 bg-white text-slate-500 hover:text-nexus-indigo'
                    )}
                  >
                    {transcribing ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" aria-hidden />
                    )}
                    {recorder.isRecording && (
                      <span className="tabular text-xs font-medium">{recorder.seconds}s</span>
                    )}
                  </button>
                )}

                <Textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void send(input)
                    }
                  }}
                  placeholder={
                    recorder.isRecording ? 'Listening...' : 'Type a message, or hit the mic'
                  }
                  className="max-h-[104px] min-h-[40px] flex-1 resize-none"
                />

                <button
                  onClick={() => void send(input)}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-expert-teal text-white',
                    'transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.98]',
                    'hover:bg-teal-700 disabled:pointer-events-none disabled:opacity-40'
                  )}
                >
                  <Send className="h-4 w-4" aria-hidden />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
        aria-expanded={isOpen}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full',
          'bg-expert-teal text-white shadow-[0_8px_24px_-6px_rgba(13,148,136,0.6)]',
          'transition-[background-color,transform] duration-150 ease-out',
          'hover:bg-teal-700 active:scale-95'
        )}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
    </>
  )
}

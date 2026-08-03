import { ENV, isConfigured } from '@/config/env'
import { logEvent } from '@/lib/logEvent'
import type { BookingDetail } from '@/types/db'

/**
 * Google Calendar, connected straight from the browser.
 *
 * There is no server to hold a client secret, so this uses the OAuth implicit
 * flow in a popup: Google redirects back to /oauth/google with the token in the
 * URL fragment, that route postMessages it here, and the popup closes.
 *
 * The token lives in a module variable and nowhere else. It is never written to
 * localStorage or sessionStorage - a token sitting in web storage survives the
 * tab and is readable by any script on the origin.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const EVENTS_ENDPOINT = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const SCOPE = 'https://www.googleapis.com/auth/calendar.events'

/** Where Google sends the browser back. Must be an authorized redirect URI on the client ID. */
export const REDIRECT_URI = `${window.location.origin}/oauth/google`

/** The callback route and this module agree on where the state lives. */
export const OAUTH_STATE_KEY = 'academic-nexus.google-oauth-state'

/** Shape of the message /oauth/google posts back to the opener. */
export interface OAuthMessage {
  source: 'academic-nexus-google-oauth'
  state: string
  accessToken?: string
  expiresIn?: number
  error?: string
}

const POPUP_TIMEOUT_MS = 120_000
const CLOSE_POLL_MS = 400
/** Retire the token a minute early so a long request cannot expire mid-flight. */
const EXPIRY_SKEW_MS = 60_000

let cached: { token: string; expiresAt: number } | null = null
let pending: Promise<{ ok: boolean; token?: string; error?: string }> | null = null

function liveToken(): string | null {
  if (!cached) return null
  if (Date.now() >= cached.expiresAt) {
    cached = null
    return null
  }
  return cached.token
}

/** Forget the token. Called on sign-out or when Google rejects it. */
export function disconnectCalendar(): void {
  cached = null
}

export function isCalendarConnected(): boolean {
  return liveToken() !== null
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ENV.googleClientId,
    response_type: 'token',
    scope: SCOPE,
    redirect_uri: REDIRECT_URI,
    state,
    include_granted_scopes: 'true',
    prompt: 'consent',
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

/**
 * Opens the consent popup and waits for /oauth/google to post the result back.
 * Resolves either way - closing the popup is a normal outcome, not an error to
 * throw at the caller.
 */
export function connectCalendar(): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (!isConfigured.googleCalendar) {
    return Promise.resolve({
      ok: false,
      error: 'Google Calendar is not set up yet. Add VITE_GOOGLE_CLIENT_ID to your .env file.',
    })
  }

  const existing = liveToken()
  if (existing) return Promise.resolve({ ok: true, token: existing })

  // One consent window at a time, however many callers ask.
  if (pending) return pending

  const state = randomState()

  pending = new Promise((resolve) => {
    let settled = false
    let closeTimer = 0
    let timeoutTimer = 0

    const finish = (result: { ok: boolean; token?: string; error?: string }) => {
      if (settled) return
      settled = true
      window.clearInterval(closeTimer)
      window.clearTimeout(timeoutTimer)
      window.removeEventListener('message', onMessage)
      try {
        sessionStorage.removeItem(OAUTH_STATE_KEY)
      } catch {
        // Private mode can block sessionStorage. The state check below still runs.
      }
      pending = null
      resolve(result)
    }

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as OAuthMessage | null
      if (!data || data.source !== 'academic-nexus-google-oauth') return

      // The state we generated must come back untouched, or this is not our redirect.
      if (data.state !== state) {
        finish({ ok: false, error: 'The sign-in response did not match this request. Try again.' })
        return
      }

      if (data.error || !data.accessToken) {
        finish({ ok: false, error: data.error || 'Google did not return an access token.' })
        return
      }

      const lifetime = (data.expiresIn ?? 3600) * 1000
      cached = { token: data.accessToken, expiresAt: Date.now() + lifetime - EXPIRY_SKEW_MS }
      finish({ ok: true, token: data.accessToken })
    }

    try {
      sessionStorage.setItem(OAUTH_STATE_KEY, state)
    } catch {
      // Not fatal. The opener verifies state on the message either way.
    }

    window.addEventListener('message', onMessage)

    const popup = window.open(
      buildAuthUrl(state),
      'academic-nexus-google-oauth',
      'width=520,height=640,menubar=no,toolbar=no'
    )

    if (!popup) {
      finish({
        ok: false,
        error: 'Your browser blocked the sign-in window. Allow popups for this site and try again.',
      })
      return
    }

    closeTimer = window.setInterval(() => {
      if (popup.closed) {
        finish({ ok: false, error: 'The Google window closed before sign-in finished.' })
      }
    }, CLOSE_POLL_MS)

    timeoutTimer = window.setTimeout(() => {
      if (!popup.closed) popup.close()
      finish({ ok: false, error: 'Google sign-in timed out. Try again.' })
    }, POPUP_TIMEOUT_MS)
  })

  return pending
}

interface CalendarEventBody {
  summary: string
  description: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  reminders: { useDefault: false; overrides: { method: 'popup'; minutes: number }[] }
}

function buildEvent(booking: BookingDetail): CalendarEventBody {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const durationMin = booking.listing?.duration_min ?? 60
  const start = new Date(booking.slot_datetime)
  const end = new Date(start.getTime() + durationMin * 60_000)

  const expertName = booking.expert?.full_name ?? 'your expert'
  const subject = booking.listing?.subject ?? 'Tutoring session'
  const note = booking.student_note?.trim()

  const description = [
    `Subject: ${subject}`,
    note ? `Student note: ${note}` : 'Student note: none given.',
    `Booked through Academic Nexus (booking ${booking.id}).`,
  ].join('\n')

  return {
    summary: `[Academic Nexus] Session with ${expertName}`,
    description,
    start: { dateTime: start.toISOString(), timeZone },
    end: { dateTime: end.toISOString(), timeZone },
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] },
  }
}

/**
 * Puts a confirmed booking on the student's primary calendar. Connects first if
 * there is no live token. Returns a readable error instead of throwing.
 */
export async function addBookingToCalendar(
  booking: BookingDetail
): Promise<{ ok: boolean; error?: string }> {
  const fail = async (error: string): Promise<{ ok: boolean; error: string }> => {
    await logEvent({
      userId: booking.student_id,
      role: 'student',
      eventType: 'calendar_event_failed',
      entity: 'bookings',
      status: 'failed',
      message: error,
    })
    return { ok: false, error }
  }

  if (!isConfigured.googleCalendar) {
    return fail('Google Calendar is not set up yet. Add VITE_GOOGLE_CLIENT_ID to your .env file.')
  }

  let token = liveToken()
  if (!token) {
    const connection = await connectCalendar()
    if (!connection.ok || !connection.token) {
      return fail(connection.error ?? 'Could not connect to Google Calendar.')
    }
    token = connection.token
  }

  try {
    const response = await fetch(EVENTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildEvent(booking)),
    })

    if (response.status === 401 || response.status === 403) {
      // The token is stale or the scope was revoked. Drop it so the next try reconnects.
      disconnectCalendar()
      return fail('Google turned down that request. Connect your calendar again.')
    }

    if (!response.ok) {
      return fail(`Google Calendar returned ${response.status}. The session was not added.`)
    }

    const created = (await response.json()) as { id?: string }

    await logEvent({
      userId: booking.student_id,
      role: 'student',
      eventType: 'calendar_event_created',
      entity: 'bookings',
      status: 'success',
      message: `Added booking ${booking.id} to Google Calendar${created.id ? ` (event ${created.id})` : ''}`,
    })

    return { ok: true }
  } catch {
    return fail('Could not reach Google Calendar. Check your connection and try again.')
  }
}

import { useEffect, useState } from 'react'
import { CalendarCheck, TriangleAlert } from 'lucide-react'
import { OAUTH_STATE_KEY, type OAuthMessage } from '@/lib/calendar'

/**
 * The /oauth/google route. Google drops the browser here with the access token
 * in the URL fragment. This page reads it, checks the state it was handed
 * against the one the opener stored, posts the result back, and shuts itself.
 *
 * It renders something on purpose: popup blockers, a same-tab redirect, or a
 * closed opener all leave this page visible, and a blank screen there looks
 * broken.
 */
export default function OAuthCallback() {
  const [message, setMessage] = useState('Finishing up with Google...')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const query = new URLSearchParams(window.location.search)

    const state = hash.get('state') ?? query.get('state') ?? ''
    const accessToken = hash.get('access_token') ?? ''
    const expiresIn = Number(hash.get('expires_in') ?? '0')
    const googleError = hash.get('error') ?? query.get('error') ?? ''

    let expected = ''
    try {
      expected = sessionStorage.getItem(OAUTH_STATE_KEY) ?? ''
    } catch {
      // Storage can be blocked. The opener runs the same check on its own copy.
    }

    let error = ''
    if (googleError) {
      error = googleError === 'access_denied' ? 'You turned down the request.' : googleError
    } else if (expected && state !== expected) {
      error = 'The sign-in response did not match this request.'
    } else if (!accessToken) {
      error = 'Google did not return an access token.'
    }

    const payload: OAuthMessage = {
      source: 'academic-nexus-google-oauth',
      state,
      accessToken: error ? undefined : accessToken,
      expiresIn: error ? undefined : expiresIn || 3600,
      error: error || undefined,
    }

    // Clear the fragment so the token stops sitting in the address bar and history.
    window.history.replaceState(null, '', window.location.pathname)

    try {
      sessionStorage.removeItem(OAUTH_STATE_KEY)
    } catch {
      // Nothing to clean up if storage was blocked in the first place.
    }

    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin)
      setMessage(error || 'Connected. You can close this window.')
      setFailed(Boolean(error))
      const timer = window.setTimeout(() => window.close(), 400)
      return () => window.clearTimeout(timer)
    }

    setMessage(
      error || 'Connected, but the window that started this is gone. Close this tab and try again.'
    )
    setFailed(true)
    return undefined
  }, [])

  const Icon = failed ? TriangleAlert : CalendarCheck

  return (
    <div className="flex min-h-screen items-center justify-center bg-cloud p-6">
      <div className="w-full max-w-sm animate-scale-in rounded-card border border-slate-200 bg-white p-8 text-center shadow-[0_12px_32px_-12px_rgba(15,23,42,0.2)]">
        <Icon
          className={`mx-auto h-8 w-8 ${failed ? 'text-status-red' : 'text-expert-teal'}`}
          aria-hidden
        />
        <h1 className="mt-4 font-heading text-lg font-semibold text-nexus-indigo">
          {failed ? 'That did not go through' : 'Google Calendar'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
        <p className="mt-6 text-xs text-slate-400">You can close this window.</p>
      </div>
    </div>
  )
}

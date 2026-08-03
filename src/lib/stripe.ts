import { loadStripe, type Stripe, type StripeCardElement } from '@stripe/stripe-js'
import { ENV, isConfigured } from '@/config/env'
import { logEvent } from '@/lib/logEvent'
import { recordPayment, setBookingStatus } from '@/lib/queries'
import type { BookingDetail } from '@/types/db'

/**
 * Payments, honestly wired.
 *
 * A real Stripe charge needs a server: only a secret key can create a
 * PaymentIntent, and this app is a static SPA with no backend. So the SDK is
 * loaded for real and the whole flow is real, but the charge itself has two
 * modes:
 *
 *   live - VITE_STRIPE_PAYMENT_INTENT_URL points at an endpoint that creates a
 *          PaymentIntent. We POST to it, get a clientSecret back, and confirm
 *          it with Stripe.js against a real card Element. Actual money moves.
 *
 *   demo - no endpoint is set. We simulate the authorization locally and say so
 *          in the UI. Nothing is charged and no card data leaves the page, but
 *          everything downstream is real: the payments row is written, the
 *          booking status flips, and the events land in event_logs. Point the
 *          env var at an endpoint and the same code path goes live.
 */

/** Set this to a PaymentIntent-creating endpoint to switch on real charges. */
const PAYMENT_INTENT_URL = String(
  import.meta.env.VITE_STRIPE_PAYMENT_INTENT_URL ?? ''
).trim()

export const PAYMENT_MODE: 'live' | 'demo' = PAYMENT_INTENT_URL ? 'live' : 'demo'

/** Stripe's documented "always declines" test card. Wired up on purpose so the failure path is reachable. */
export const DECLINE_TEST_CARD = '4000000000000002'

/** Stripe's documented "always succeeds" test card. */
export const SUCCESS_TEST_CARD = '4242424242424242'

const DEMO_LATENCY_MS = 1200

let stripePromise: Promise<Stripe | null> | null = null

/** Memoized Stripe.js. Resolves to null when no publishable key is configured. */
export function getStripe(): Promise<Stripe | null> {
  if (!isConfigured.stripe) return Promise.resolve(null)
  if (!stripePromise) stripePromise = loadStripe(ENV.stripePublishableKey)
  return stripePromise
}

export interface PaymentResult {
  ok: boolean
  ref?: string
  error?: string
}

/**
 * What the pay button hands over. In demo mode only `number` is read. In live
 * mode the raw number never leaves the Stripe Element, so `element` is what
 * gets confirmed and `number` is ignored.
 */
export interface CardInput {
  number: string
  element?: StripeCardElement
}

/** Last four digits, for receipts and logs. Never store or send the full number. */
export function maskCard(number: string): string {
  const digits = number.replace(/\D/g, '')
  if (digits.length < 4) return '••••'
  return `•••• ${digits.slice(-4)}`
}

/** Space the digits into groups of four as someone types. */
export function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(.{4})/g, '$1 ').trim()
}

function demoRef(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const byte of bytes) out += alphabet[byte % alphabet.length]
  return `pi_demo_${out}`
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

/** Write the paid row, confirm the booking, log it. Swallows its own errors. */
async function settleSuccess(booking: BookingDetail, ref: string): Promise<void> {
  try {
    await recordPayment({
      booking_id: booking.id,
      amount: booking.price,
      status: 'paid',
      stripe_ref: ref,
    })
    await setBookingStatus(booking.id, 'confirmed')
  } catch (error) {
    console.warn('[payments] could not persist the successful charge', error)
  }

  await logEvent({
    userId: booking.student_id,
    role: 'student',
    eventType: 'payment_succeeded',
    entity: 'payments',
    status: 'paid',
    message: `${PAYMENT_MODE} payment for booking ${booking.id}`,
  })
}

/** Write the failed row, mark the booking failed, log the reason. */
async function settleFailure(
  booking: BookingDetail,
  reason: string,
  ref?: string
): Promise<void> {
  try {
    await recordPayment({
      booking_id: booking.id,
      amount: booking.price,
      status: 'failed',
      stripe_ref: ref ?? null,
    })
    await setBookingStatus(booking.id, 'failed')
  } catch (error) {
    console.warn('[payments] could not persist the failed charge', error)
  }

  await logEvent({
    userId: booking.student_id,
    role: 'student',
    eventType: 'payment_failed',
    entity: 'payments',
    status: 'failed',
    message: reason,
  })
}

/** The simulated authorization. No network call, no card data anywhere. */
async function runDemoCharge(card?: CardInput): Promise<PaymentResult> {
  await wait(DEMO_LATENCY_MS)

  const digits = (card?.number ?? '').replace(/\D/g, '')

  if (digits.length < 13) {
    return { ok: false, error: 'That card number is too short. Check the digits and try again.' }
  }

  if (digits === DECLINE_TEST_CARD) {
    return {
      ok: false,
      error: 'Your card was declined. Try a different card or contact your bank.',
    }
  }

  return { ok: true, ref: demoRef() }
}

/** The real thing: create a PaymentIntent on the server, then confirm it here. */
async function runLiveCharge(
  booking: BookingDetail,
  card?: CardInput
): Promise<PaymentResult> {
  const stripe = await getStripe()
  if (!stripe) {
    return { ok: false, error: 'Stripe did not load. Check the publishable key and try again.' }
  }

  if (!card?.element) {
    return { ok: false, error: 'The card form is not ready yet. Give it a second and try again.' }
  }

  let clientSecret = ''
  try {
    const response = await fetch(PAYMENT_INTENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(booking.price * 100),
        bookingId: booking.id,
        currency: 'usd',
      }),
    })

    if (!response.ok) {
      return { ok: false, error: `The payment service returned ${response.status}. Try again in a moment.` }
    }

    const payload = (await response.json()) as { clientSecret?: string; error?: string }
    if (payload.error) return { ok: false, error: payload.error }
    if (!payload.clientSecret) {
      return { ok: false, error: 'The payment service did not return a client secret.' }
    }
    clientSecret = payload.clientSecret
  } catch {
    return { ok: false, error: 'Could not reach the payment service. Check your connection.' }
  }

  const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: card.element },
  })

  if (error) {
    return { ok: false, error: error.message ?? 'The card was declined.' }
  }

  if (!paymentIntent || paymentIntent.status !== 'succeeded') {
    return {
      ok: false,
      error: `The payment finished as "${paymentIntent?.status ?? 'unknown'}" instead of succeeded.`,
      ref: paymentIntent?.id,
    }
  }

  return { ok: true, ref: paymentIntent.id }
}

/**
 * Single entry point for paying off a booking. Never throws - every path
 * resolves to a result object the caller can render.
 */
export async function payForBooking(
  booking: BookingDetail,
  card?: CardInput
): Promise<PaymentResult> {
  if (!isConfigured.stripe) {
    return { ok: false, error: 'Stripe is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY first.' }
  }

  if (booking.price <= 0) {
    return { ok: false, error: 'This booking has no price on it, so there is nothing to charge.' }
  }

  let result: PaymentResult
  try {
    result = PAYMENT_MODE === 'live' ? await runLiveCharge(booking, card) : await runDemoCharge(card)
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof Error ? error.message : 'Something went wrong taking the payment.',
    }
  }

  if (result.ok && result.ref) {
    await settleSuccess(booking, result.ref)
    return result
  }

  const reason = result.error ?? 'The payment did not go through.'
  await settleFailure(booking, reason, result.ref)
  return { ok: false, error: reason, ref: result.ref }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { StripeCardElement } from '@stripe/stripe-js'
import { CreditCard, Info, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { MissingKeyNotice, Spinner } from '@/components/ui/States'
import { BookingConfirmedAnimation } from '@/components/lottie/Animations'
import { isConfigured, MISSING_KEY_HINT } from '@/config/env'
import {
  DECLINE_TEST_CARD,
  formatCardNumber,
  getStripe,
  maskCard,
  payForBooking,
  PAYMENT_MODE,
  SUCCESS_TEST_CARD,
} from '@/lib/stripe'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import type { BookingDetail } from '@/types/db'

/** Long enough for the confirmation Lottie to land before the modal hands off. */
const HANDOFF_MS = 1600

const SHAKE_CSS = `
@keyframes an-card-shake {
  0%   { transform: translate3d(0, 0, 0);     animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  15%  { transform: translate3d(-6px, 0, 0);  animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  30%  { transform: translate3d(8px, 0, 0);   animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  45%  { transform: translate3d(-8px, 0, 0);  animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  60%  { transform: translate3d(6px, 0, 0);   animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  75%  { transform: translate3d(-6px, 0, 0);  animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  100% { transform: translate3d(0, 0, 0);     animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
}
.an-card-shake { animation: an-card-shake 420ms both; will-change: transform; }
@media (prefers-reduced-motion: reduce) {
  .an-card-shake { animation: none; }
}
`

/** Trim to MM/YY as it is typed. */
function formatExpiry(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function PaymentModal({
  booking,
  open,
  onClose,
  onPaid,
}: {
  booking: BookingDetail
  open: boolean
  onClose: () => void
  onPaid: (ref: string) => void
}) {
  const ready = isConfigured.stripe
  const live = PAYMENT_MODE === 'live'

  const [number, setNumber] = useState(formatCardNumber(SUCCESS_TEST_CARD))
  const [expiry, setExpiry] = useState('12/34')
  const [cvc, setCvc] = useState('123')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [paidRef, setPaidRef] = useState('')
  const [elementsLoading, setElementsLoading] = useState(live)

  const mountRef = useRef<HTMLDivElement | null>(null)
  const cardElementRef = useRef<StripeCardElement | null>(null)
  const payingRef = useRef(false)
  const handedOffRef = useRef(false)

  const expertName = booking.expert?.full_name ?? 'your expert'
  const subject = booking.listing?.subject ?? 'Tutoring session'
  const duration = booking.listing?.duration_min ?? 60

  /* Reset every time the dialog is reopened so a stale error never greets anyone. */
  useEffect(() => {
    if (open) return
    setPaying(false)
    setError('')
    setPaidRef('')
    payingRef.current = false
    handedOffRef.current = false
  }, [open])

  /* Live mode mounts a real Stripe card Element - the digits never touch our state. */
  useEffect(() => {
    if (!open || !live || !ready || paidRef) return

    let disposed = false
    setElementsLoading(true)

    getStripe().then((stripe) => {
      if (disposed || !stripe || !mountRef.current) {
        if (!disposed) setElementsLoading(false)
        return
      }

      const elements = stripe.elements()
      const card = elements.create('card', {
        style: {
          base: {
            color: '#1E293B',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
            '::placeholder': { color: '#94A3B8' },
          },
          invalid: { color: '#DC2626', iconColor: '#DC2626' },
        },
      })
      card.mount(mountRef.current)
      card.on('change', (event) => {
        if (event.error) setError(event.error.message)
      })
      cardElementRef.current = card
      setElementsLoading(false)
    })

    return () => {
      disposed = true
      cardElementRef.current?.unmount()
      cardElementRef.current?.destroy()
      cardElementRef.current = null
    }
  }, [open, live, ready, paidRef])

  const handoff = useCallback(
    (ref: string) => {
      if (handedOffRef.current) return
      handedOffRef.current = true
      onPaid(ref)
    },
    [onPaid]
  )

  /* Belt and braces: if the Lottie never reports completion, hand off anyway. */
  useEffect(() => {
    if (!paidRef) return
    const timer = window.setTimeout(() => handoff(paidRef), HANDOFF_MS)
    return () => window.clearTimeout(timer)
  }, [paidRef, handoff])

  async function handlePay() {
    if (payingRef.current || !ready) return
    payingRef.current = true
    setPaying(true)
    setError('')

    const result = await payForBooking(booking, {
      number: live ? '' : number,
      element: cardElementRef.current ?? undefined,
    })

    payingRef.current = false
    setPaying(false)

    if (result.ok && result.ref) {
      setPaidRef(result.ref)
      return
    }

    setError(result.error ?? 'The payment did not go through.')
    setShakeKey((key) => key + 1)
  }

  const amount = formatCurrency(booking.price)

  return (
    <Modal
      open={open}
      onClose={paying ? () => undefined : onClose}
      title={paidRef ? 'Session confirmed' : 'Pay for this session'}
      description={paidRef ? undefined : `${subject} with ${expertName}`}
    >
      <style>{SHAKE_CSS}</style>

      {paidRef ? (
        <div className="flex flex-col items-center py-4 text-center">
          <BookingConfirmedAnimation onComplete={() => handoff(paidRef)} />
          <h3 className="mt-2 font-heading text-lg font-semibold text-nexus-indigo">
            You are booked in
          </h3>
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">
            {live
              ? `${amount} charged for `
              : `${amount} authorized on ${maskCard(number)} for `}
            {formatDateTime(booking.slot_datetime)} with {expertName}.
            {live ? '' : ' This was a demo authorization, so no money moved.'}
          </p>
          <p className="mt-3 font-mono text-xs text-slate-400">{paidRef}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* What they are paying for */}
          <div className="rounded-card border border-slate-200 bg-cloud p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1 text-sm">
                <p className="font-medium text-nexus-indigo">{expertName}</p>
                <p className="text-slate-500">{subject}</p>
                <p className="text-slate-500">
                  {formatDateTime(booking.slot_datetime)} · {duration} min
                </p>
              </div>
              <p className="shrink-0 font-heading text-3xl font-semibold tabular-nums tracking-tight text-nexus-indigo">
                {amount}
              </p>
            </div>
          </div>

          {!ready ? (
            <MissingKeyNotice feature="Payments" hint={MISSING_KEY_HINT.stripe} />
          ) : (
            <>
              {/* Say plainly which mode this is */}
              {live ? (
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-expert-teal" aria-hidden />
                  Live mode. Your card details go straight to Stripe and this is a real charge.
                </p>
              ) : (
                <div className="flex items-start gap-3 rounded-card border border-status-gold/30 bg-status-gold/5 p-4">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden />
                  <div className="text-sm">
                    <p className="font-medium text-yellow-800">Demo mode - no card is charged</p>
                    <p className="mt-1 leading-relaxed text-yellow-700">
                      This app runs entirely in the browser, and a real charge needs a server to
                      create the payment intent. The authorization below is simulated, but the
                      booking, the payment record, and the logs are all written for real. Set{' '}
                      <code className="rounded bg-yellow-100 px-1 py-0.5 text-[11px]">
                        VITE_STRIPE_PAYMENT_INTENT_URL
                      </code>{' '}
                      to an endpoint that returns a client secret and this switches to real charges.
                    </p>
                  </div>
                </div>
              )}

              <div
                key={shakeKey}
                className={cn('space-y-3', error && shakeKey > 0 && 'an-card-shake')}
              >
                {live ? (
                  <div>
                    <Label>Card details</Label>
                    <div
                      className={cn(
                        'rounded-control border border-slate-200 bg-white px-3 py-3',
                        'transition-[border-color,box-shadow] duration-150 ease-out',
                        error && 'border-status-red'
                      )}
                    >
                      <div ref={mountRef} />
                      {elementsLoading && (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Spinner className="h-4 w-4" />
                          Loading the secure card field
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="card-number">Card number</Label>
                      <div className="relative">
                        <CreditCard
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                          aria-hidden
                        />
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="4242 4242 4242 4242"
                          value={number}
                          disabled={paying}
                          onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                          className={cn('pl-9 font-mono tabular-nums', error && 'border-status-red')}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="card-expiry">Expiry</Label>
                        <Input
                          id="card-expiry"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="MM/YY"
                          value={expiry}
                          disabled={paying}
                          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                          className="font-mono tabular-nums"
                        />
                      </div>
                      <div>
                        <Label htmlFor="card-cvc">CVC</Label>
                        <Input
                          id="card-cvc"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="123"
                          value={cvc}
                          disabled={paying}
                          onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="font-mono tabular-nums"
                        />
                      </div>
                    </div>

                    <p className="text-xs leading-relaxed text-slate-400">
                      Want to see the decline path? Use{' '}
                      <button
                        type="button"
                        onClick={() => setNumber(formatCardNumber(DECLINE_TEST_CARD))}
                        className="font-mono text-slate-500 underline decoration-dotted underline-offset-2 transition-colors hover:text-nexus-indigo"
                      >
                        {formatCardNumber(DECLINE_TEST_CARD)}
                      </button>
                      , the card Stripe always declines.
                    </p>
                  </>
                )}
              </div>

              {error && (
                <p role="alert" className="text-sm leading-relaxed text-status-red">
                  {error}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={onClose} disabled={paying}>
                  Cancel
                </Button>
                <Button onClick={handlePay} loading={paying} disabled={paying || elementsLoading}>
                  {paying ? 'Working on it' : `Pay ${amount}`}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export default PaymentModal

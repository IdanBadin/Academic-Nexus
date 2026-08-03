import Lottie from 'lottie-react'
import matchFound from '@/assets/animations/match-found.json'
import bookingConfirmed from '@/assets/animations/booking-confirmed.json'
import emptyState from '@/assets/animations/empty-state.json'
import aiThinking from '@/assets/animations/ai-thinking.json'
import { cn } from '@/lib/utils'

interface PlayerProps {
  className?: string
  loop?: boolean
  onComplete?: () => void
}

/** Plays in the AI widget the moment it returns ranked experts. */
export function MatchFoundAnimation({ className, loop = true }: PlayerProps) {
  return (
    <Lottie
      animationData={matchFound}
      loop={loop}
      autoplay
      className={cn('h-32 w-32', className)}
      aria-hidden
    />
  )
}

/** Plays once after a payment clears and the booking flips to confirmed. */
export function BookingConfirmedAnimation({ className, onComplete }: PlayerProps) {
  return (
    <Lottie
      animationData={bookingConfirmed}
      loop={false}
      autoplay
      onComplete={onComplete}
      className={cn('h-40 w-40', className)}
      aria-hidden
    />
  )
}

/** Restful loop for lists with nothing in them yet. */
export function EmptyStateAnimation({ className }: PlayerProps) {
  return (
    <Lottie
      animationData={emptyState}
      loop
      autoplay
      className={cn('h-40 w-40', className)}
      aria-hidden
    />
  )
}

/** Typing-indicator dots shown while the assistant is composing a reply. */
export function AiThinkingAnimation({ className }: PlayerProps) {
  return (
    <Lottie
      animationData={aiThinking}
      loop
      autoplay
      className={cn('h-8 w-16', className)}
      aria-hidden
    />
  )
}

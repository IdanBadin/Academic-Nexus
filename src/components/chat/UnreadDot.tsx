import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Amber unread pill. Renders nothing at zero, caps the label at "9+".
 *
 * The entrance is the notification-badge treatment from transitions.dev: a
 * scale and opacity pop on a bouncy curve, skipped entirely when the person
 * has asked for reduced motion (Tailwind's `motion-reduce:` variant compiles
 * to a real `@media (prefers-reduced-motion: reduce)` block).
 */
export function UnreadDot({ count, className }: { count: number; className?: string }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (count <= 0) {
      setShown(false)
      return
    }
    // One frame at the pre-open scale so the transition has something to run from.
    const frame = window.requestAnimationFrame(() => setShown(true))
    return () => window.cancelAnimationFrame(frame)
  }, [count])

  if (count <= 0) return null

  const label = count > 9 ? '9+' : String(count)

  return (
    <span
      role="status"
      aria-label={`${count} unread ${count === 1 ? 'message' : 'messages'}`}
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5',
        'bg-student-amber text-[11px] font-semibold tabular-nums text-nexus-indigo',
        'transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.34,1.36,0.64,1)]',
        'motion-reduce:transition-none',
        shown ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        'motion-reduce:scale-100 motion-reduce:opacity-100',
        className
      )}
    >
      {label}
    </span>
  )
}

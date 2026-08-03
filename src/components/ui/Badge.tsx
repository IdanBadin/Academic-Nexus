import type { ReactNode } from 'react'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { STATUS_CLASSES, STATUS_LABEL } from '@/config/theme'

export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        'border-slate-200 bg-slate-50 text-slate-600',
        className
      )}
    >
      {children}
    </span>
  )
}

/** Booking or payment status, colored by the brand status tokens. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        STATUS_CLASSES[status] ?? 'border-slate-200 bg-slate-50 text-slate-600',
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-expert-teal/30 bg-expert-teal/10 px-2 py-0.5 text-xs font-medium text-expert-teal',
        className
      )}
      title="Identity and credentials checked by Academic Nexus"
    >
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      Verified
    </span>
  )
}

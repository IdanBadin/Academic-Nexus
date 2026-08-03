import type { ReactNode } from 'react'
import { Loader2, KeyRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from './Card'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-slate-400', className)} aria-hidden />
}

export function LoadingBlock({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Spinner />
      {label}
    </div>
  )
}

/** Skeleton row used while lists load. */
export function SkeletonCard() {
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2.5">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </Card>
  )
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
}: {
  title: string
  description: string
  action?: ReactNode
  illustration?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
      {illustration}
      <h3 className="font-heading text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-status-red/20 bg-status-red/5 p-4 text-sm text-red-700">
      {message}
    </div>
  )
}

/**
 * Shown in place of any feature whose API key is not in .env yet.
 * The feature is fully built - it just needs the key to switch on.
 */
export function MissingKeyNotice({
  feature,
  hint,
  className,
}: {
  feature: string
  hint: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-card border border-status-gold/30 bg-status-gold/5 p-4',
        className
      )}
    >
      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600" aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-yellow-800">{feature} needs an API key</p>
        <p className="mt-1 leading-relaxed text-yellow-700">{hint}</p>
      </div>
    </div>
  )
}

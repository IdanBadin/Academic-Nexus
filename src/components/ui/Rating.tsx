import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Rating({
  value,
  count,
  size = 'md',
  className,
}: {
  value: number
  count?: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              dim,
              star <= Math.round(value)
                ? 'fill-student-amber text-student-amber'
                : 'fill-slate-200 text-slate-200'
            )}
            aria-hidden
          />
        ))}
      </span>
      <span className="tabular text-sm font-medium text-nexus-indigo">
        {value > 0 ? value.toFixed(1) : 'New'}
      </span>
      {count !== undefined && count > 0 && (
        <span className="tabular text-sm text-slate-400">({count})</span>
      )}
    </span>
  )
}

/** Interactive 1-5 picker for the review form. */
export function RatingInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className="rounded-md p-1 transition-transform duration-150 ease-out hover:scale-110 active:scale-95"
        >
          <Star
            className={cn(
              'h-7 w-7 transition-colors duration-150',
              star <= value
                ? 'fill-student-amber text-student-amber'
                : 'fill-slate-200 text-slate-200'
            )}
          />
        </button>
      ))}
    </div>
  )
}

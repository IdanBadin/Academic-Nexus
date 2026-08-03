import { cn, avatarTint, initials } from '@/lib/utils'

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-base',
  xl: 'h-20 w-20 text-xl',
}

export function Avatar({
  name,
  url,
  size = 'md',
  className,
}: {
  name: string | null | undefined
  url?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const label = name ?? 'Unknown'

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-heading font-semibold text-white',
        // A hairline inset ring keeps light avatars from bleeding into white cards.
        'ring-1 ring-inset ring-black/10',
        SIZES[size],
        className
      )}
      style={{ backgroundColor: avatarTint(label) }}
      title={label}
    >
      {url ? (
        <img src={url} alt={label} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(label)}</span>
      )}
      <span className="sr-only">{label}</span>
    </div>
  )
}

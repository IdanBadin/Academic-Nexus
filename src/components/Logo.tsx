import { cn } from '@/lib/utils'

/**
 * The mark: two nodes (teal supply, amber demand) joined by a link.
 * The link is the product - the nodes are the two sides of the marketplace.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 24"
      fill="none"
      className={cn('h-6 w-11', className)}
      aria-hidden
      focusable="false"
    >
      <rect x="14" y="10" width="16" height="4" rx="2" fill="#1E293B" opacity="0.9" />
      <circle cx="10" cy="12" r="10" fill="#0D9488" />
      <circle cx="34" cy="12" r="10" fill="#F59E0B" />
    </svg>
  )
}

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string
  showWordmark?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {showWordmark && (
        <span className="font-heading text-lg font-bold tracking-tight text-nexus-indigo">
          Academic Nexus
        </span>
      )}
    </span>
  )
}

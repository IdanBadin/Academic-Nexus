import type { Availability, ListingWithExpert, MatchResult } from '@/types/db'

export interface StudentPrefs {
  subject: string
  level: string
  maxPrice: number
  days: number[]
  formats?: string[]
}

export const WEIGHTS = {
  subject: 0.35,
  level: 0.2,
  rating: 0.2,
  price: 0.15,
  availability: 0.1,
} as const

/** Share of the days a student asked for that the expert actually covers. */
export function computeAvailabilityOverlap(availability: Availability[], days: number[]): number {
  if (days.length === 0) return 1
  if (availability.length === 0) return 0
  const covered = new Set(availability.map((slot) => slot.weekday))
  const hits = days.filter((day) => covered.has(day)).length
  return hits / days.length
}

/**
 * Price fit on a 0-1 scale. At or under budget scores 1. Over budget falls off
 * linearly and bottoms out at 0 once the listing costs double the budget.
 *
 * Note: the original spec wrote this as
 *   1 - Math.min((price - maxPrice) / maxPrice, 1)
 * which returns values above 1 for any listing under budget, letting a cheap
 * listing inflate the total past 100. Clamping to [0, 1] keeps the weights
 * meaningful.
 */
export function computePriceFit(price: number, maxPrice: number): number {
  if (maxPrice <= 0) return 0
  if (price <= maxPrice) return 1
  return Math.max(0, 1 - (price - maxPrice) / maxPrice)
}

export function computeScore(
  listing: ListingWithExpert,
  prefs: StudentPrefs
): MatchResult['breakdown'] & { total: number } {
  const subject_fit = listing.subject === prefs.subject ? 1 : 0.5
  const level_fit = listing.level === prefs.level ? 1 : 0.6
  // An expert with no reviews yet sits at the midpoint rather than at zero,
  // otherwise a brand new expert can never surface above a mediocre one.
  const rating = listing.stats.review_count > 0 ? listing.stats.avg_rating / 5 : 0.6
  const price_fit = computePriceFit(listing.price, prefs.maxPrice)
  const avail_fit = computeAvailabilityOverlap(listing.availability, prefs.days)

  const total =
    WEIGHTS.subject * subject_fit +
    WEIGHTS.level * level_fit +
    WEIGHTS.rating * rating +
    WEIGHTS.price * price_fit +
    WEIGHTS.availability * avail_fit

  return { subject_fit, level_fit, rating, price_fit, avail_fit, total: Math.round(total * 100) }
}

/** One plain sentence saying why this listing placed where it did. */
export function explainMatch(
  listing: ListingWithExpert,
  breakdown: MatchResult['breakdown'],
  prefs: StudentPrefs,
  score: number
): string {
  const points: string[] = []

  points.push(
    breakdown.subject_fit === 1
      ? `teaches ${listing.subject}`
      : `covers ${listing.subject} rather than ${prefs.subject}`
  )

  if (breakdown.level_fit === 1) points.push(`works at ${listing.level} level`)

  if (listing.stats.review_count > 0) {
    points.push(
      `${listing.stats.avg_rating.toFixed(1)} stars across ${listing.stats.review_count} review${
        listing.stats.review_count === 1 ? '' : 's'
      }`
    )
  } else {
    points.push('new to the platform')
  }

  if (breakdown.price_fit === 1) points.push('fits your budget')
  else points.push(`runs $${listing.price}, over your $${prefs.maxPrice} cap`)

  if (prefs.days.length > 0) {
    if (breakdown.avail_fit === 1) points.push('free every day you picked')
    else if (breakdown.avail_fit === 0) points.push('not free on the days you picked')
  }

  const opener = score >= 85 ? 'Strong match' : score >= 65 ? 'Good match' : 'Partial match'

  return `${opener}: ${points.join(', ')}.`
}

export function rankListings(
  listings: ListingWithExpert[],
  prefs: StudentPrefs
): MatchResult[] {
  return listings
    .filter((listing) => !prefs.formats?.length || prefs.formats.includes(listing.format))
    .map((listing) => {
      const { total, ...breakdown } = computeScore(listing, prefs)
      return {
        listing,
        score: total,
        breakdown,
        explanation: explainMatch(listing, breakdown, prefs, total),
      }
    })
    .sort((a, b) => b.score - a.score)
}

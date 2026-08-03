import { supabase } from './supabase'
import type {
  Availability,
  Booking,
  BookingDetail,
  BookingStatus,
  EventLog,
  Listing,
  ListingWithExpert,
  Payment,
  Profile,
  Review,
} from '@/types/db'

/* ------------------------------- profiles ------------------------------- */

export async function getProfile(id: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  return (data as Profile) ?? null
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function updateProfile(id: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id)
  if (error) throw error
}

/* ------------------------------- reviews -------------------------------- */

/** Aggregate rating per expert. Computed client-side so no DB view is needed. */
export async function getExpertRatings(): Promise<Map<string, { avg: number; count: number }>> {
  const { data } = await supabase.from('reviews').select('expert_id, rating')
  const buckets = new Map<string, { total: number; count: number }>()

  for (const row of (data ?? []) as { expert_id: string; rating: number }[]) {
    const bucket = buckets.get(row.expert_id) ?? { total: 0, count: 0 }
    bucket.total += row.rating
    bucket.count += 1
    buckets.set(row.expert_id, bucket)
  }

  const result = new Map<string, { avg: number; count: number }>()
  buckets.forEach((bucket, expertId) => {
    result.set(expertId, { avg: bucket.total / bucket.count, count: bucket.count })
  })
  return result
}

export async function getReviewsForExpert(expertId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Review[]
}

export async function listRecentReviews(limit = 12): Promise<(Review & { student: Profile | null })[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*, student:profiles!reviews_student_id_fkey(*)')
    .gte('rating', 4)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as (Review & { student: Profile | null })[]
}

/* ------------------------------- listings ------------------------------- */

/** Active listings joined with their expert, rating aggregate, and availability. */
export async function listActiveListings(): Promise<ListingWithExpert[]> {
  const [{ data: listings, error }, ratings, { data: availability }] = await Promise.all([
    supabase
      .from('listings')
      .select('*, expert:profiles!listings_expert_id_fkey(*)')
      .eq('is_active', true),
    getExpertRatings(),
    supabase.from('availability').select('*'),
  ])

  if (error) throw error

  const slotsByExpert = new Map<string, Availability[]>()
  for (const slot of (availability ?? []) as Availability[]) {
    const list = slotsByExpert.get(slot.expert_id) ?? []
    list.push(slot)
    slotsByExpert.set(slot.expert_id, list)
  }

  return ((listings ?? []) as (Listing & { expert: Profile })[])
    // A suspended expert's listings stay out of search even if still active.
    .filter((row) => row.expert && !row.expert.is_suspended)
    .map((row) => {
      const rating = ratings.get(row.expert_id) ?? { avg: 0, count: 0 }
      return {
        ...row,
        stats: { avg_rating: rating.avg, review_count: rating.count },
        availability: slotsByExpert.get(row.expert_id) ?? [],
      }
    })
}

export async function getListingsForExpert(expertId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('expert_id', expertId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Listing[]
}

export async function getListing(id: string): Promise<(Listing & { expert: Profile }) | null> {
  const { data } = await supabase
    .from('listings')
    .select('*, expert:profiles!listings_expert_id_fkey(*)')
    .eq('id', id)
    .maybeSingle()
  return (data as Listing & { expert: Profile }) ?? null
}

export async function saveListing(listing: Partial<Listing>): Promise<void> {
  if (listing.id) {
    const { error } = await supabase.from('listings').update(listing).eq('id', listing.id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('listings').insert(listing)
    if (error) throw error
  }
}

/* ----------------------------- availability ----------------------------- */

export async function getAvailability(expertId: string): Promise<Availability[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('*')
    .eq('expert_id', expertId)
    .order('weekday')
    .order('start_time')
  if (error) throw error
  return (data ?? []) as Availability[]
}

export async function addAvailability(slot: Omit<Availability, 'id'>): Promise<void> {
  const { error } = await supabase.from('availability').insert(slot)
  if (error) throw error
}

export async function removeAvailability(id: string): Promise<void> {
  const { error } = await supabase.from('availability').delete().eq('id', id)
  if (error) throw error
}

/* ------------------------------- bookings ------------------------------- */

const BOOKING_JOIN =
  '*, listing:listings(*), student:profiles!bookings_student_id_fkey(*), expert:profiles!bookings_expert_id_fkey(*)'

export async function getBookingsForUser(
  userId: string,
  side: 'student' | 'expert'
): Promise<BookingDetail[]> {
  const column = side === 'student' ? 'student_id' : 'expert_id'
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_JOIN)
    .eq(column, userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BookingDetail[]
}

export async function getBooking(id: string): Promise<BookingDetail | null> {
  const { data } = await supabase.from('bookings').select(BOOKING_JOIN).eq('id', id).maybeSingle()
  if (!data) return null

  const [{ data: review }, { data: payment }] = await Promise.all([
    supabase.from('reviews').select('*').eq('booking_id', id).maybeSingle(),
    supabase
      .from('payments')
      .select('*')
      .eq('booking_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  return {
    ...(data as BookingDetail),
    review: (review as Review) ?? null,
    payment: (payment as Payment) ?? null,
  }
}

export async function createBooking(input: {
  listing_id: string
  student_id: string
  expert_id: string
  slot_datetime: string
  student_note: string
  price: number
}): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({ ...input, status: 'requested' })
    .select()
    .single()
  if (error) throw error
  return data as Booking
}

export async function setBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
  if (error) throw error
}

export async function listAllBookings(): Promise<BookingDetail[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select(BOOKING_JOIN)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BookingDetail[]
}

/* ------------------------------- payments ------------------------------- */

export async function recordPayment(input: {
  booking_id: string
  amount: number
  status: 'paid' | 'failed' | 'pending' | 'refunded'
  stripe_ref?: string | null
}): Promise<void> {
  const { error } = await supabase.from('payments').insert(input)
  if (error) throw error
}

export async function listPayments(): Promise<Payment[]> {
  const { data, error } = await supabase.from('payments').select('*')
  if (error) throw error
  return (data ?? []) as Payment[]
}

/* ------------------------------ event logs ------------------------------ */

export async function listEventLogs(limit = 500): Promise<(EventLog & { user: Profile | null })[]> {
  const { data, error } = await supabase
    .from('event_logs')
    .select('*, user:profiles(*)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as (EventLog & { user: Profile | null })[]
}

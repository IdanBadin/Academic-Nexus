/** TypeScript mirror of the Supabase schema in supabase/migrations/. */

export type AppRole = 'student' | 'expert' | 'admin'

export type BookingStatus =
  | 'requested'
  | 'accepted'
  | 'declined'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'canceled'
  | 'failed'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type ListingFormat = 'lesson' | 'review' | 'exam_prep' | 'project'

export interface Profile {
  id: string
  full_name: string | null
  role: AppRole
  bio: string | null
  avatar_url: string | null
  subjects: string[] | null
  is_verified: boolean
  is_suspended: boolean
  created_at: string
}

export interface Listing {
  id: string
  expert_id: string
  subject: string
  level: string
  format: ListingFormat
  description: string | null
  price: number
  duration_min: number
  is_active: boolean
  created_at: string
}

export interface Availability {
  id: string
  expert_id: string
  weekday: number
  start_time: string
  end_time: string
}

export interface Booking {
  id: string
  listing_id: string
  student_id: string
  expert_id: string
  slot_datetime: string
  status: BookingStatus
  student_note: string | null
  price: number
  created_at: string
}

export interface Payment {
  id: string
  booking_id: string
  amount: number
  status: PaymentStatus
  stripe_ref: string | null
  created_at: string
}

export interface Review {
  id: string
  booking_id: string
  student_id: string
  expert_id: string
  rating: number
  text: string | null
  created_at: string
}

export interface Message {
  id: string
  booking_id: string
  sender_id: string
  body: string
  created_at: string
}

export interface EventLog {
  id: string
  user_id: string | null
  role: AppRole | null
  event_type: string
  entity: string | null
  status: string | null
  message: string | null
  created_at: string
}

/* ---------- Joined shapes returned by the queries in src/lib/queries.ts ---------- */

export interface ExpertStats {
  avg_rating: number
  review_count: number
}

export interface ListingWithExpert extends Listing {
  expert: Profile
  stats: ExpertStats
  availability: Availability[]
}

export interface BookingDetail extends Booking {
  listing: Listing | null
  student: Profile | null
  expert: Profile | null
  review: Review | null
  payment: Payment | null
}

export interface MatchResult {
  listing: ListingWithExpert
  score: number
  explanation: string
  breakdown: {
    subject_fit: number
    level_fit: number
    rating: number
    price_fit: number
    avail_fit: number
  }
}

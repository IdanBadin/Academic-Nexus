/**
 * Single source of truth for brand constants.
 * Tailwind tokens mirror these in tailwind.config.ts - keep both in sync.
 * Use these when a raw hex is required (Recharts, Lottie, inline SVG).
 */

export const COLORS = {
  expertTeal: '#0D9488',
  studentAmber: '#F59E0B',
  nexusIndigo: '#1E293B',
  cloud: '#F8FAFC',
  white: '#FFFFFF',
  statusGreen: '#16A34A',
  statusGold: '#EAB308',
  statusRed: '#DC2626',
  statusSlate: '#64748B',
} as const

export const FONTS = {
  heading: '"Space Grotesk", system-ui, sans-serif',
  body: 'Inter, system-ui, sans-serif',
} as const

/** Booking status -> brand status color. */
export const STATUS_COLOR: Record<string, string> = {
  requested: COLORS.statusGold,
  accepted: COLORS.statusGold,
  declined: COLORS.statusRed,
  confirmed: COLORS.statusGreen,
  in_progress: COLORS.expertTeal,
  completed: COLORS.statusGreen,
  canceled: COLORS.statusSlate,
  failed: COLORS.statusRed,
  pending: COLORS.statusGold,
  paid: COLORS.statusGreen,
  refunded: COLORS.statusSlate,
}

/** Tailwind class sets for status badges. */
export const STATUS_CLASSES: Record<string, string> = {
  requested: 'bg-status-gold/10 text-yellow-700 border-status-gold/30',
  accepted: 'bg-status-gold/10 text-yellow-700 border-status-gold/30',
  declined: 'bg-status-red/10 text-red-700 border-status-red/30',
  confirmed: 'bg-status-green/10 text-green-700 border-status-green/30',
  in_progress: 'bg-expert-teal/10 text-expert-teal border-expert-teal/30',
  completed: 'bg-status-green/10 text-green-700 border-status-green/30',
  canceled: 'bg-status-slate/10 text-slate-600 border-status-slate/30',
  failed: 'bg-status-red/10 text-red-700 border-status-red/30',
  pending: 'bg-status-gold/10 text-yellow-700 border-status-gold/30',
  paid: 'bg-status-green/10 text-green-700 border-status-green/30',
  refunded: 'bg-status-slate/10 text-slate-600 border-status-slate/30',
}

/** Human labels for statuses - never show a raw enum to a user. */
export const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  declined: 'Declined',
  confirmed: 'Confirmed',
  in_progress: 'In progress',
  completed: 'Completed',
  canceled: 'Canceled',
  failed: 'Payment failed',
  pending: 'Pending',
  paid: 'Paid',
  refunded: 'Refunded',
}

export const SUBJECTS = [
  'Math',
  'Computer Science',
  'Statistics',
  'Economics',
  'Physics',
  'Writing',
] as const

export const LEVELS = ['High School', 'Undergraduate', 'Graduate'] as const

export const FORMATS = [
  { value: 'lesson', label: 'Lesson' },
  { value: 'review', label: 'Work review' },
  { value: 'exam_prep', label: 'Exam prep' },
  { value: 'project', label: 'Project help' },
] as const

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

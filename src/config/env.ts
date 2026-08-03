/**
 * Central env access. Every integration checks its own key here so a missing
 * key degrades to a clear "add your key" message instead of a runtime crash.
 */

const read = (key: string): string => (import.meta.env[key] as string | undefined)?.trim() ?? ''

export const ENV = {
  supabaseUrl: read('VITE_SUPABASE_URL'),
  supabaseAnonKey: read('VITE_SUPABASE_ANON_KEY'),
  googleAiApiKey: read('VITE_GOOGLE_AI_API_KEY'),
  elevenLabsApiKey: read('VITE_ELEVENLABS_API_KEY'),
  stripePublishableKey: read('VITE_STRIPE_PUBLISHABLE_KEY'),
  googleClientId: read('VITE_GOOGLE_CLIENT_ID'),
} as const

export const isConfigured = {
  supabase: Boolean(ENV.supabaseUrl && ENV.supabaseAnonKey),
  googleAi: Boolean(ENV.googleAiApiKey),
  elevenLabs: Boolean(ENV.elevenLabsApiKey),
  stripe: Boolean(ENV.stripePublishableKey),
  googleCalendar: Boolean(ENV.googleClientId),
}

/** Shown wherever a feature is gated on a key the project does not have yet. */
export const MISSING_KEY_HINT: Record<keyof typeof isConfigured, string> = {
  supabase: 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file.',
  googleAi: 'Add VITE_GOOGLE_AI_API_KEY to your .env file to turn on the assistant.',
  elevenLabs: 'Add VITE_ELEVENLABS_API_KEY to your .env file to turn on voice.',
  stripe: 'Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file to take payments.',
  googleCalendar: 'Add VITE_GOOGLE_CLIENT_ID to your .env file to sync sessions.',
}

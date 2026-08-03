/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Indexed access - src/config/env.ts reads keys by name.
  readonly [key: string]: string | boolean | undefined
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_GOOGLE_AI_API_KEY?: string
  readonly VITE_ELEVENLABS_API_KEY?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** Endpoint that creates a Stripe PaymentIntent. Set it to switch payments from demo to live. */
  readonly VITE_STRIPE_PAYMENT_INTENT_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

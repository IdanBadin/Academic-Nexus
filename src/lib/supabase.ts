import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ENV, isConfigured } from '@/config/env'
import { demoClient } from '@/demo/client'

/**
 * There are two ways this app can get its data.
 *
 * With VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set, it talks to a real
 * Supabase project. All access is direct from the browser using the anon key,
 * and the row level security policies in supabase/migrations/0001_schema.sql
 * are what actually enforce who can read and write what.
 *
 * Without those keys it runs on the demo dataset in src/demo, served by a
 * stand-in client that implements the same call surface. Every page and hook
 * is identical in both modes - nothing branches on which one is active.
 */
export const isDemoMode = !isConfigured.supabase

export const supabase: SupabaseClient = isDemoMode
  ? (demoClient as unknown as SupabaseClient)
  : createClient(ENV.supabaseUrl, ENV.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'academic-nexus-auth',
      },
    })

/**
 * True whenever there is a working data source behind the app, which in demo
 * mode there always is. Screens check this before running a query.
 */
export const supabaseReady = true

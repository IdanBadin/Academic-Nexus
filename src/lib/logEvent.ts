import { supabase, supabaseReady } from './supabase'
import type { AppRole } from '@/types/db'

export interface LogInput {
  userId?: string | null
  role?: AppRole | null
  eventType: string
  entity?: string | null
  status?: string | null
  message?: string | null
}

/**
 * Append to event_logs. Fire and forget - a logging failure must never take
 * down the action the user was actually trying to perform, so this swallows
 * its own errors and only warns in the console.
 */
export async function logEvent(input: LogInput): Promise<void> {
  if (!supabaseReady) return

  try {
    await supabase.from('event_logs').insert({
      user_id: input.userId ?? null,
      role: input.role ?? null,
      event_type: input.eventType,
      entity: input.entity ?? null,
      status: input.status ?? null,
      message: input.message ?? null,
    })
  } catch (error) {
    console.warn('[event_logs] write failed', error)
  }
}

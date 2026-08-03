import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseReady } from '@/lib/supabase'
import { logEvent } from '@/lib/logEvent'
import type { AppRole, Profile } from '@/types/db'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  role: AppRole | null
  loading: boolean
  signUp: (args: {
    email: string
    password: string
    fullName: string
    role: AppRole
  }) => Promise<{ error: string | null }>
  signIn: (args: { email: string; password: string }) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** Resolves the role from user_roles, falling back to the profiles row. */
async function loadProfile(userId: string): Promise<Profile | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (!profile) return null

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle()

  return { ...profile, role: (roleRow?.role as AppRole) ?? profile.role } as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) {
      setProfile(null)
      return
    }
    setProfile(await loadProfile(session.user.id))
  }, [session?.user?.id])

  useEffect(() => {
    if (!supabaseReady) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let canceled = false
    const userId = session?.user?.id
    if (!userId) return

    setLoading(true)
    loadProfile(userId).then((next) => {
      if (canceled) return
      setProfile(next)
      setLoading(false)
    })

    return () => {
      canceled = true
    }
  }, [session?.user?.id])

  const signUp = useCallback<AuthValue['signUp']>(
    async ({ email, password, fullName, role }) => {
      if (!supabaseReady) return { error: 'Supabase is not configured yet. Check your .env file.' }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // The handle_new_user trigger reads this metadata to create the
        // profiles and user_roles rows, so signup works even if the
        // client-side inserts below are blocked by RLS.
        options: { data: { full_name: fullName, role } },
      })

      if (error) return { error: error.message }

      const userId = data.user?.id
      if (userId) {
        await supabase
          .from('profiles')
          .upsert({ id: userId, full_name: fullName, role }, { onConflict: 'id' })
        await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role }, { onConflict: 'user_id' })
        await logEvent({
          userId,
          role,
          eventType: 'signup',
          entity: 'profiles',
          status: 'success',
          message: `${role} account created`,
        })
      }

      return { error: null }
    },
    []
  )

  const signIn = useCallback<AuthValue['signIn']>(async ({ email, password }) => {
    if (!supabaseReady) return { error: 'Supabase is not configured yet. Check your .env file.' }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }

    if (data.user) {
      const next = await loadProfile(data.user.id)
      if (next?.is_suspended) {
        await supabase.auth.signOut()
        return { error: 'This account is suspended. Contact support to have it reinstated.' }
      }
      await logEvent({
        userId: data.user.id,
        role: next?.role ?? null,
        eventType: 'login',
        entity: 'auth',
        status: 'success',
      })
    }

    return { error: null }
  }, [])

  const signOut = useCallback(async () => {
    if (session?.user?.id) {
      await logEvent({
        userId: session.user.id,
        role: profile?.role ?? null,
        eventType: 'logout',
        entity: 'auth',
        status: 'success',
      })
    }
    await supabase.auth.signOut()
    setProfile(null)
  }, [session?.user?.id, profile?.role])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      role: profile?.role ?? null,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, signUp, signIn, signOut, refreshProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Where each role lands after login. */
export function homeForRole(role: AppRole | null): string {
  if (role === 'expert') return '/expert'
  if (role === 'admin') return '/admin'
  if (role === 'student') return '/student'
  return '/auth/login'
}

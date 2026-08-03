import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, homeForRole } from '@/hooks/useAuth'
import { LoadingBlock } from '@/components/ui/States'
import type { AppRole } from '@/types/db'

/**
 * Gate a route on an authenticated session and, optionally, a specific role.
 * A signed-in user who hits the wrong area is sent to their own home rather
 * than to the login screen - being logged in as the wrong role is not the
 * same problem as not being logged in.
 */
export function ProtectedRoute({
  role,
  children,
}: {
  role?: AppRole
  children: ReactNode
}) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingBlock label="Checking your session" />

  if (!session) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (profile?.is_suspended) {
    return <Navigate to="/suspended" replace />
  }

  if (role && profile?.role !== role) {
    return <Navigate to={homeForRole(profile?.role ?? null)} replace />
  }

  return <>{children}</>
}

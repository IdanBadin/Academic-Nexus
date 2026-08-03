import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  BookOpen,
  CalendarClock,
  Inbox,
  Star,
  UserRound,
  Wallet,
} from 'lucide-react'
import { AppLayout, type NavItem } from '@/components/layout/AppLayout'
import { useAuth } from '@/hooks/useAuth'
import { getBookingsForUser } from '@/lib/queries'

export default function ExpertLayout() {
  const { pathname } = useLocation()
  const { session } = useAuth()
  const expertId = session?.user?.id ?? null
  const [pendingCount, setPendingCount] = useState(0)

  // The badge is read once per mount so the nav does not poll the database.
  useEffect(() => {
    if (!expertId) return
    let canceled = false

    getBookingsForUser(expertId, 'expert')
      .then((bookings) => {
        if (canceled) return
        setPendingCount(bookings.filter((b) => b.status === 'requested').length)
      })
      .catch((error) => {
        console.warn('[expert] request count failed', error)
      })

    return () => {
      canceled = true
    }
  }, [expertId])

  const items: NavItem[] = [
    {
      to: '/expert/requests',
      label: 'Requests',
      icon: <Inbox className="h-4 w-4" />,
      badge: pendingCount || undefined,
    },
    { to: '/expert/listings', label: 'My listings', icon: <BookOpen className="h-4 w-4" /> },
    {
      to: '/expert/availability',
      label: 'Availability',
      icon: <CalendarClock className="h-4 w-4" />,
    },
    { to: '/expert/earnings', label: 'Earnings', icon: <Wallet className="h-4 w-4" /> },
    { to: '/expert/reviews', label: 'Reviews', icon: <Star className="h-4 w-4" /> },
    { to: '/expert/profile', label: 'Profile', icon: <UserRound className="h-4 w-4" /> },
  ]

  // /expert on its own has nothing to show - requests is the daily landing spot.
  if (pathname === '/expert' || pathname === '/expert/') {
    return <Navigate to="/expert/requests" replace />
  }

  return (
    <AppLayout items={items} accent="teal">
      <Outlet />
    </AppLayout>
  )
}

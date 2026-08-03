import { CalendarCheck, Search } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AppLayout, type NavItem } from '@/components/layout/AppLayout'

const NAV: NavItem[] = [
  { to: '/student/search', label: 'Search', icon: <Search className="h-4 w-4" /> },
  { to: '/student/bookings', label: 'My bookings', icon: <CalendarCheck className="h-4 w-4" /> },
]

export default function StudentLayout() {
  const { pathname } = useLocation()

  // /student on its own has nothing to show - send it to search.
  if (pathname === '/student' || pathname === '/student/') {
    return <Navigate to="/student/search" replace />
  }

  return (
    <AppLayout items={NAV} accent="amber">
      <Outlet />
    </AppLayout>
  )
}

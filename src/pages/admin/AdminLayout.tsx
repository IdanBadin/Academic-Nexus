import { Flag, LayoutDashboard, ScrollText, Users } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AppLayout, type NavItem } from '@/components/layout/AppLayout'

const NAV: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: '/admin/users', label: 'Users', icon: <Users className="h-4 w-4" /> },
  { to: '/admin/disputes', label: 'Disputes', icon: <Flag className="h-4 w-4" /> },
  { to: '/admin/logs', label: 'Logs', icon: <ScrollText className="h-4 w-4" /> },
]

export default function AdminLayout() {
  const { pathname } = useLocation()

  // /admin on its own has nothing to render - the dashboard is the landing page.
  if (pathname === '/admin' || pathname === '/admin/') {
    return <Navigate to="/admin/dashboard" replace />
  }

  return (
    <AppLayout items={NAV} accent="indigo">
      <Outlet />
    </AppLayout>
  )
}

import { useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { LogOut, Menu, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

export interface NavItem {
  to: string
  label: string
  icon: ReactNode
  /** Renders the unread dot on the nav entry. */
  badge?: number
  end?: boolean
}

/**
 * Shared shell for the three signed-in areas. `accent` tints the active nav
 * state - teal on expert surfaces, amber on student, indigo for admin.
 */
export function AppLayout({
  items,
  accent,
  children,
}: {
  items: NavItem[]
  accent: 'teal' | 'amber' | 'indigo'
  children: ReactNode
}) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const activeClass = {
    teal: 'bg-expert-teal/10 text-expert-teal',
    amber: 'bg-student-amber/10 text-amber-700',
    indigo: 'bg-nexus-indigo/10 text-nexus-indigo',
  }[accent]

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-control px-3 py-2 text-sm font-medium',
              'transition-[background-color,color] duration-150 ease-out',
              isActive ? activeClass : 'text-slate-600 hover:bg-slate-100 hover:text-nexus-indigo'
            )
          }
        >
          <span className="shrink-0">{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge ? (
            <span className="tabular inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-student-amber px-1.5 text-xs font-semibold text-nexus-indigo">
              {item.badge}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen bg-cloud">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              className="-ml-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/" className="rounded-lg">
              <Logo />
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{profile?.full_name ?? 'Account'}</p>
              <p className="text-xs capitalize text-slate-400">{profile?.role}</p>
            </div>
            <Avatar name={profile?.full_name} url={profile?.avatar_url} size="sm" />
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1800px] gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">{nav}</div>
        </aside>

        {mobileOpen && (
          <div className="fixed inset-x-0 top-16 z-20 animate-fade-in border-b border-slate-200 bg-white p-4 lg:hidden">
            {nav}
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

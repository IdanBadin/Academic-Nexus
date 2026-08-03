import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, GraduationCap, Presentation, ShieldCheck, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FieldError, Input, Label } from '@/components/ui/Field'
import { homeForRole, useAuth } from '@/hooks/useAuth'
import { isDemoMode } from '@/lib/supabase'
import { DEMO_ACCOUNTS } from '@/demo/fixtures'
import { cn } from '@/lib/utils'
import type { AppRole } from '@/types/db'

interface FromState {
  from?: string
}

const ROLE_ICON: Record<AppRole, typeof GraduationCap> = {
  student: GraduationCap,
  expert: Presentation,
  admin: ShieldCheck,
}

/** Each role gets its own accent, matching the area you land in. */
const ROLE_STYLE: Record<AppRole, { ring: string; tint: string; text: string }> = {
  student: {
    ring: 'hover:border-student-amber',
    tint: 'bg-student-amber/10 text-amber-600',
    text: 'text-amber-700',
  },
  expert: {
    ring: 'hover:border-expert-teal',
    tint: 'bg-expert-teal/10 text-expert-teal',
    text: 'text-expert-teal',
  },
  admin: {
    ring: 'hover:border-nexus-indigo',
    tint: 'bg-nexus-indigo/10 text-nexus-indigo',
    text: 'text-nexus-indigo',
  },
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, session, role, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pendingRole, setPendingRole] = useState<AppRole | null>(null)
  const [showForm, setShowForm] = useState(!isDemoMode)

  const from = (location.state as FromState | null)?.from

  // Redirect only once the profile has resolved, so the role is known and we
  // do not bounce someone to the wrong home screen.
  useEffect(() => {
    if (!submitted || loading || !session || !role) return
    navigate(from ?? homeForRole(role), { replace: true })
  }, [submitted, loading, session, role, from, navigate])

  function validate() {
    const next: { email?: string; password?: string } = {}
    if (!email.trim()) next.email = 'Enter the email you signed up with.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'That does not look like an email address.'
    if (!password) next.password = 'Enter your password.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setAuthError(null)
    if (!validate()) return

    setSubmitting(true)
    const { error } = await signIn({ email: email.trim(), password })
    setSubmitting(false)

    if (error) {
      setAuthError(error)
      return
    }
    setSubmitted(true)
  }

  /**
   * One click straight into a seeded account. It goes through the same signIn
   * path as the form, so nothing about the resulting session is special-cased.
   */
  async function enterAs(account: (typeof DEMO_ACCOUNTS)[number]) {
    setAuthError(null)
    setPendingRole(account.role)

    const { error } = await signIn({ email: account.email, password: account.password })

    if (error) {
      setPendingRole(null)
      setAuthError(error)
      return
    }
    setSubmitted(true)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-cloud px-5 py-14">
      <Link to="/" aria-label="Academic Nexus home" className="rounded">
        <Logo />
      </Link>

      <Card className="mt-8 w-full max-w-md animate-scale-in p-7">
        <h1 className="font-heading text-2xl font-bold">
          {isDemoMode ? 'Pick a role to explore' : 'Log in'}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
          {isDemoMode
            ? 'A live demo running on sample data. Choose an account and you are straight in - no signup, nothing to remember.'
            : 'Same email and password you signed up with.'}
        </p>

        {isDemoMode && (
          <div className="mt-6 space-y-2.5">
            {DEMO_ACCOUNTS.map((account) => {
              const Icon = ROLE_ICON[account.role]
              const style = ROLE_STYLE[account.role]
              const busy = pendingRole === account.role

              return (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => void enterAs(account)}
                  disabled={pendingRole !== null}
                  className={cn(
                    'group flex w-full items-center gap-3.5 rounded-card border border-slate-200 bg-white p-4 text-left',
                    'transition-[border-color,transform,box-shadow] duration-200 ease-out',
                    'hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(15,23,42,0.18)]',
                    'disabled:pointer-events-none disabled:opacity-60',
                    style.ring
                  )}
                >
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                      style.tint
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="font-heading text-sm font-semibold capitalize">
                        {account.role}
                      </span>
                      <span className="truncate text-xs text-slate-400">{account.name}</span>
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug text-slate-500">
                      {account.blurb}
                    </span>
                  </span>

                  <span className={cn('shrink-0', style.text)}>
                    {busy ? (
                      <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <ArrowRight
                        className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div aria-live="polite">
          {authError && (
            <div className="mt-4 rounded-card border border-status-red/20 bg-status-red/5 px-4 py-3">
              <FieldError>{authError}</FieldError>
            </div>
          )}
        </div>

        {isDemoMode && (
          <button
            type="button"
            onClick={() => setShowForm((open) => !open)}
            aria-expanded={showForm}
            className="mt-6 flex w-full items-center justify-between border-t border-slate-100 px-1 pt-4 text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-nexus-indigo"
          >
            Or sign in with an email
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-200 ease-out',
                showForm && 'rotate-180'
              )}
              aria-hidden
            />
          </button>
        )}

        {showForm && (
          <>
            <form onSubmit={handleSubmit} noValidate className="mt-5 animate-fade-in space-y-4">
              <div>
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@university.edu"
                  aria-invalid={Boolean(fieldErrors.email)}
                />
                <FieldError>{fieldErrors.email}</FieldError>
              </div>

              <div>
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  aria-invalid={Boolean(fieldErrors.password)}
                />
                <FieldError>{fieldErrors.password}</FieldError>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={submitting || (submitted && loading && pendingRole === null)}
              >
                Log in
              </Button>
            </form>

            {isDemoMode && (
              <p className="mt-3 text-center text-xs text-slate-400">
                Every demo account uses the password{' '}
                <code className="rounded bg-cloud px-1.5 py-0.5 font-mono text-nexus-indigo">
                  password123
                </code>
              </p>
            )}
          </>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          No account yet?{' '}
          <Link
            to="/auth/signup"
            className="rounded font-medium text-expert-teal hover:text-teal-700"
          >
            Create one
          </Link>
        </p>
      </Card>

      {isDemoMode && (
        <p className="mt-6 max-w-md text-center text-xs leading-relaxed text-slate-400">
          Nothing here is saved to a server. The data resets when you reload the page, so click
          around freely - you cannot break anything.
        </p>
      )}
    </main>
  )
}

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookOpen, GraduationCap } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { FieldError, Input, Label } from '@/components/ui/Field'
import { MissingKeyNotice } from '@/components/ui/States'
import { isConfigured, MISSING_KEY_HINT } from '@/config/env'
import { homeForRole, useAuth } from '@/hooks/useAuth'
import type { AppRole } from '@/types/db'

/** Per-segment shake for the auth error. Scoped to this page. */
const SIGNUP_CSS = `
.an-shake { animation: an-shake 280ms linear; }
@keyframes an-shake {
  0%     { transform: translateX(0);    animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  28.57% { transform: translateX(6px);  animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  57.14% { transform: translateX(-6px); animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  78.57% { transform: translateX(8px);  animation-timing-function: cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  100%   { transform: translateX(0); }
}
@media (prefers-reduced-motion: reduce) {
  .an-shake { animation: none; }
}
`

const ROLE_CHOICES: { value: AppRole; label: string; blurb: string; icon: typeof GraduationCap }[] =
  [
    {
      value: 'student',
      label: 'Student',
      blurb: 'Search experts, book sessions, pay per hour.',
      icon: GraduationCap,
    },
    {
      value: 'expert',
      label: 'Expert',
      blurb: 'List what you teach, set your hours, get paid.',
      icon: BookOpen,
    },
  ]

function strengthOf(password: string): { label: string; width: string; tone: string } {
  if (password.length < 8) return { label: 'Too short', width: '25%', tone: 'bg-status-red' }
  const variety =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password))
  if (variety <= 1 || password.length < 10)
    return { label: 'Would hold up for a while', width: '60%', tone: 'bg-status-gold' }
  return { label: 'Hard to guess', width: '100%', tone: 'bg-status-green' }
}

export default function Signup() {
  const navigate = useNavigate()
  const { signUp, session, role: sessionRole, loading } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<AppRole>('student')
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string
    email?: string
    password?: string
  }>({})
  const [authError, setAuthError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const errorRef = useRef<HTMLDivElement>(null)
  const ready = isConfigured.supabase
  const strength = strengthOf(password)

  useEffect(() => {
    if (!submitted || loading || !session) return
    navigate(homeForRole(sessionRole ?? role), { replace: true })
  }, [submitted, loading, session, sessionRole, role, navigate])

  function shakeError() {
    const node = errorRef.current
    if (!node) return
    node.classList.remove('an-shake')
    void node.offsetWidth // force reflow so the animation replays
    node.classList.add('an-shake')
  }

  function validate() {
    const next: { fullName?: string; email?: string; password?: string } = {}
    if (fullName.trim().length < 2) next.fullName = 'Tell us what to call you.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      next.email = 'That does not look like an email address.'
    if (password.length < 8) next.password = 'Use at least 8 characters.'
    setFieldErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setAuthError(null)
    if (!ready || !validate()) return

    setSubmitting(true)
    const { error } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      role,
    })
    setSubmitting(false)

    if (error) {
      setAuthError(error)
      window.requestAnimationFrame(shakeError)
      return
    }
    setSubmitted(true)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-cloud px-5 py-14">
      <style>{SIGNUP_CSS}</style>

      <Link to="/" aria-label="Academic Nexus home" className="rounded">
        <Logo />
      </Link>

      <Card className="mt-8 w-full max-w-md animate-scale-in p-7">
        <h1 className="font-heading text-2xl font-bold">Create your account</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Takes about a minute. You can change your details later.
        </p>

        {!ready && (
          <MissingKeyNotice
            className="mt-5"
            feature="Creating an account"
            hint={MISSING_KEY_HINT.supabase}
          />
        )}

        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
          <fieldset disabled={!ready} className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-nexus-indigo">
              Which side are you on?
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {ROLE_CHOICES.map((choice) => {
                const Icon = choice.icon
                const selected = role === choice.value
                const ring =
                  choice.value === 'student'
                    ? 'border-student-amber ring-2 ring-student-amber/40 bg-student-amber/5'
                    : 'border-expert-teal ring-2 ring-expert-teal/40 bg-expert-teal/5'
                const tint =
                  choice.value === 'student'
                    ? 'bg-student-amber/10 text-student-amber'
                    : 'bg-expert-teal/10 text-expert-teal'

                return (
                  <button
                    key={choice.value}
                    type="button"
                    onClick={() => setRole(choice.value)}
                    aria-pressed={selected}
                    className={`rounded-card border p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out disabled:opacity-50 ${
                      selected ? ring : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${tint}`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="mt-3 block font-heading text-sm font-semibold text-nexus-indigo">
                      {choice.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      {choice.blurb}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="signup-name">Full name</Label>
            <Input
              id="signup-name"
              autoComplete="name"
              disabled={!ready}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Noa Bar-Lev"
              aria-invalid={Boolean(fieldErrors.fullName)}
            />
            <FieldError>{fieldErrors.fullName}</FieldError>
          </div>

          <div>
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              disabled={!ready}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@university.edu"
              aria-invalid={Boolean(fieldErrors.email)}
            />
            <FieldError>{fieldErrors.email}</FieldError>
          </div>

          <div>
            <Label htmlFor="signup-password" hint="8 characters or more">
              Password
            </Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              disabled={!ready}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Something you have not used elsewhere"
              aria-invalid={Boolean(fieldErrors.password)}
            />
            {password.length > 0 && !fieldErrors.password && (
              <div className="mt-2 flex items-center gap-3">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className={`block h-full rounded-full transition-[width] duration-200 ease-out ${strength.tone}`}
                    style={{ width: strength.width }}
                  />
                </span>
                <span className="text-xs text-slate-500">{strength.label}</span>
              </div>
            )}
            <FieldError>{fieldErrors.password}</FieldError>
          </div>

          <div aria-live="polite">
            {authError && (
              <div
                ref={errorRef}
                className="rounded-card border border-status-red/20 bg-status-red/5 px-4 py-3"
              >
                <FieldError>{authError}</FieldError>
              </div>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            variant={role === 'student' ? 'student' : 'primary'}
            className="w-full"
            disabled={!ready}
            loading={submitting || (submitted && loading)}
          >
            Create account
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already signed up?{' '}
          <Link to="/auth/login" className="rounded font-medium text-expert-teal hover:text-teal-700">
            Log in
          </Link>
        </p>
      </Card>
    </main>
  )
}

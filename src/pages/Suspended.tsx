import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useAuth } from '@/hooks/useAuth'

export default function Suspended() {
  const { signOut, profile } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    setSigningOut(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-cloud px-5 py-14">
      <Link to="/" aria-label="Academic Nexus home" className="rounded">
        <Logo />
      </Link>

      <Card className="mt-8 w-full max-w-md animate-scale-in p-7">
        <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-status-gold" aria-hidden />
          Account paused
        </span>

        <h1 className="mt-5 font-heading text-2xl font-bold">
          {profile?.full_name ? `${profile.full_name.split(' ')[0]}, your account is on hold` : 'Your account is on hold'}
        </h1>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600">
          <p>
            An admin suspended this account, so bookings, messages, and listings are switched off
            for now. Nothing has been deleted - everything comes back if the account is reinstated.
          </p>
          <p>
            If you think this is a mistake, write to{' '}
            <a
              href="mailto:support@academicnexus.example"
              className="rounded font-medium text-expert-teal hover:text-teal-700"
            >
              support@academicnexus.example
            </a>{' '}
            with the email you signed up with. A person reads those.
          </p>
        </div>

        <Button
          variant="secondary"
          className="mt-7 w-full"
          onClick={handleSignOut}
          loading={signingOut}
        >
          Sign out
        </Button>
      </Card>
    </main>
  )
}

import { Link } from 'react-router-dom'
import { Logo, LogoMark } from '@/components/Logo'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-cloud px-5 py-14 text-center">
      <Link to="/" aria-label="Academic Nexus home" className="rounded">
        <Logo />
      </Link>

      <div className="mt-12 animate-fade-in">
        <LogoMark className="mx-auto h-10 w-[4.5rem] opacity-30" />

        <p className="mt-8 font-heading text-5xl font-bold tracking-tight text-slate-300">404</p>

        <h1 className="mt-4 font-heading text-2xl font-bold">This page is not here</h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-slate-500">
          The link may be old, or the listing behind it was taken down. Start again from the home
          page and you will get where you were going.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/">
            <Button>Back to the home page</Button>
          </Link>
          <Link
            to="/auth/login"
            className="rounded-control px-4 py-2 text-sm font-medium text-slate-500 transition-colors duration-150 hover:text-nexus-indigo"
          >
            Log in
          </Link>
        </div>
      </div>
    </main>
  )
}

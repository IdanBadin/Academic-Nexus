# Academic Nexus

A two-sided marketplace for academic help. Experts publish what they teach and when they are free; students filter by subject, level, format, price, and rating, then book a real slot. Once a booking is paid the two sides get a live chat thread, and after the session the student leaves a review that feeds back into the expert's rating.

Built as a pure client-side SPA - React 18, Vite, TypeScript, Tailwind, and Supabase. There is no backend service to run. Row level security in Postgres is what enforces who can read and write what.

## What is in here

**Three role-based areas, each with its own accent color**

- **Student** (amber) - search with live filters, expert profiles with a reviews carousel and a weekly availability grid, slot-level booking, a bookings list with per-status actions, and a "Find my best match" scorer.
- **Expert** (teal) - profile editor, listing manager, weekly availability grid with overlap detection, a requests inbox, an earnings dashboard, and a trust score built from real reviews.
- **Admin** (indigo) - four live Recharts visuals, user management with verify and suspend, a disputes queue, and a filterable event log table.

**Integrations**

| Feature | Service | Without a key |
| --- | --- | --- |
| Auth, database, realtime | Supabase | App shows a setup notice |
| AI assistant | Google AI Studio (Gemini) | Widget explains which var to set |
| Voice input and playback | ElevenLabs | Mic and Listen buttons hide |
| Payments | Stripe | Runs in labelled demo mode |
| Calendar sync | Google Calendar | Sync button reports it is unconfigured |

None of these are stubs. Each one checks for its own key at runtime, and the ones without a key say so plainly instead of throwing. You can run the whole app on Supabase alone and add the rest later.

## Running it

```bash
npm install
cp .env.example .env    # fill in at least the two Supabase values
npm run dev
```

Build for production with `npm run build`. The output in `dist/` is static files - deploy it anywhere that serves them.

## Database setup

Two SQL files under `supabase/migrations/`, run in order:

1. `0001_schema.sql` - enums, nine tables, a `has_role()` security-definer helper, RLS policies on every table, indexes, realtime on `messages`, and a trigger that creates the `profiles` and `user_roles` rows when someone signs up.
2. `0002_seed.sql` - demo data: 8 experts, 10 students, 1 admin, 21 listings, 31 bookings across all eight statuses, 18 reviews, chat threads, and around 137 event log entries.

Paste each into the Supabase SQL editor, or run `supabase db push` if you use the CLI.

The seeded accounts all share the password `password123`. They exist so the app has something to show on a fresh database. Delete them before anything real touches this.

## The match score

`src/lib/matchScore.ts` ranks listings 0-100 against a student's stated preferences:

```
0.35 subject fit + 0.20 level fit + 0.20 rating + 0.15 price fit + 0.10 availability overlap
```

Each result comes with a one-line explanation of why it placed where it did. Two deliberate departures from a naive reading of that formula are commented in the file: price fit is clamped to `[0, 1]` so a cheap listing cannot push a total past 100, and an expert with no reviews yet scores at the midpoint instead of zero so new experts are not permanently buried.

## A note on payments

Creating a real Stripe charge requires a server holding the secret key. This app does not have one. So `src/lib/stripe.ts` loads the real Stripe.js SDK and runs the full downstream path - writes the `payments` row, moves the booking to `confirmed`, logs the events - but the authorization itself is simulated and **labelled as a demo in the UI**. Card `4000000000000002` deliberately declines so the failure path is testable.

Set `VITE_STRIPE_PAYMENT_INTENT_URL` to an endpoint that returns a `clientSecret` and it switches to real charges with no other changes.

## Project layout

```
src/
  assets/animations/   4 hand-authored Lottie files
  components/
    ai/                Gemini widget + provider
    booking/           status machine and timeline
    chat/              realtime thread
    layout/            app shell
    lottie/            animation wrappers
    payment/           payment modal
    ui/                Button, Card, Badge, Field, Modal, Toast, DataTable, ...
  config/              ai.ts, env.ts, theme.ts
  hooks/               useAuth, useChat, useUnread, useVoiceRecorder, useTransitions
  lib/                 supabase, queries, matchScore, gemini, elevenlabs, stripe, calendar
  pages/               Landing, auth/, student/, expert/, admin/
  routes/              ProtectedRoute
supabase/migrations/   schema + seed
```

## Security

- Only `VITE_`-prefixed public keys are used client-side. Nothing with a service role or secret key belongs in this repo - anything with that prefix ends up in the JavaScript bundle users download.
- `.gitignore` excludes `.env` and `.env.*` while keeping `.env.example` tracked.
- RLS policies, not client code, are the access control. A user can only read and write their own profile, their own bookings, and messages on threads they belong to.
- OAuth tokens are held in memory only, never in `localStorage`. The only thing stored locally is a per-thread last-read timestamp.

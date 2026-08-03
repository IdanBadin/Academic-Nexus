# Academic Nexus - Build Todo

## Decisions (locked)
- Stack: React 18.3 + Vite 5 + TS 5.6 + Tailwind 3 + Supabase + React Router v6 + Recharts + lottie-react
- Pure client-side SPA. No SSR, no Node server code. Lovable-compatible.
- Supabase: SQL migration + seed files only. NO live DB provisioned.
- API keys: none provided. All integrations wired, guarded by env-key presence checks.
- Deployment status: local development only, not deployed.

## Phase 1 - Scaffold & Design System
- [x] Vite + React 18 + TS scaffold, deps installed and pinned (scaffold defaulted to React 19 / Vite 8 / TS 6; downgraded deliberately)
- [x] tailwind.config.ts with brand tokens + keyframes
- [x] Google Fonts: Space Grotesk + Inter
- [x] src/config/theme.ts brand constants
- [x] Logo SVG component + public/logo.svg favicon
- [x] UI primitives: Button, Card, Badge, Field, Avatar, Rating, Modal, Toast, States, DataTable
- [x] transitions.dev CSS + useTransitions hooks installed

## Phase 2 - Data layer
- [x] supabase/migrations/0001_schema.sql (104 statements, RLS on all tables, has_role, handle_new_user trigger)
- [x] supabase/migrations/0002_seed.sql (21 statements: 19 users, 21 listings, 31 bookings, 18 reviews, ~137 logs)
- [x] src/lib/supabase.ts, src/types/db.ts, src/lib/logEvent.ts, src/lib/queries.ts

## Phase 3 - Auth & Routing
- [x] useAuth hook, signup with role picker, login, ProtectedRoute, role-based redirect
- [x] AppLayout shell with per-role accent

## Phase 4 - Feature areas
- [x] Landing page (hero, HeyGen embed + fallback, role cards, bento grid, testimonials carousel, footer)
- [x] Student: Search + filters, ExpertProfile, Book, Bookings, BookingDetail
- [x] Expert: ProfileEditor, Listings, AvailabilityManager, Requests, Earnings, Reviews, BookingDetail
- [x] Admin: Dashboard (4 Recharts visuals + funnel), Users, Disputes, Logs + DataTable
- [x] Match Score algorithm + Find My Best Match UI
- [x] Booking lifecycle state machine + BookingTimeline
- [x] Realtime chat (supabase.channel, no polling, unread dots)
- [x] AI chat widget (Gemini, grounded in real listing data)
- [x] Voice: ElevenLabs STT (MediaRecorder) + TTS
- [x] Stripe payment (demo/live modes) + Google Calendar OAuth
- [x] 4 Lottie animations

## Phase 5 - Ship
- [x] .env.example with all VITE_ vars
- [x] README
- [x] npm run build passes clean, code-split (charts lazy-loaded)
- [x] Verified: tsc clean, SQL parses under real Postgres grammar, 0 console errors in browser
- [ ] Create public GitHub repo + push  <-- BLOCKED

## Open blockers
- gh CLI not authenticated. User must run: `! gh auth login`
  Then: create public repo `academic-nexus` and push.

## Known gaps / next steps
- SQL syntax verified by parser, but RLS policy BEHAVIOR is unverified (no live DB was provisioned).
  First real test should be: run both migrations on a fresh Supabase project, log in as each seeded role.
- Payments run in demo mode until VITE_STRIPE_PAYMENT_INTENT_URL points at a real PaymentIntent endpoint.
- Footer links (About/Privacy/Terms/Contact) are `#` placeholders.
- Lottie adds 317kB to the initial bundle for 4 small animations. Could be lazy-loaded if size matters.

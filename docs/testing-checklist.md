Prosper App Testing Checklist
============================

This checklist is designed for manual verification of MVP flows. Use a clean browser profile (or incognito) and run the app locally (`npm run dev`). Verify on desktop and a mobile viewport where relevant.

Prereqs
- Node 18+, npm/pnpm
- `.env.local` with OpenAI, Supabase (anon + service), APP_URL; Stripe test keys for billing
- Supabase tables created: `households`, `snapshots`, `net_worth_points`, `actions`, `feedback`
- App running at `http://localhost:3000`
- Optional: set `FREE_SNAPSHOT_LIMIT=3` for free plan testing

Reset (optional)
- Clear localStorage keys: `pp_uses_toast_shown`, `pp_household_id`

## A. Consent & Guardrails
- [ ] If consent modal enabled: “I Agree” dismisses; Terms/Privacy open correctly
- [ ] Moderation: send a message that should trip guardrails; UI shows blocked/redirected content

## B. Auth & Profile Menu
- [ ] Login page: Google OAuth redirects to `/auth/callback`, then home
- [ ] Magic link sent and works; account links to a household
- [ ] Profile menu: shows “Sign in” when logged out; “Log out” when logged in
- [ ] Edit profile (name/email) saves and persists after reload
- [ ] Copy household ID copies and shows a confirmation

## C. Data Deletion
- [ ] Profile → “Delete my data…” removes household, snapshots, actions, net worth; cookie resets
- [ ] Optional (Facebook): `/api/facebook/data-deletion` returns `{ url, confirmation_code }`; status page loads

## D. Realtime Voice & Chat
- [ ] Connect/disconnect toggles work; status transitions are correct
- [ ] Push‑to‑talk: hold and release to send; assistant responds on release
- [ ] Audio playback switch mutes/unmutes as expected

## E. Intake & Compute
- [ ] Provide the core five: net or gross income; essential expenses; housing (rent or mortgage); debt payments; emergency cash
- [ ] Snapshot saves; dashboard updates without errors
- [ ] Recompute occurs on `apply` / `delta` / `update-input`

## F. Currency & Locale
- [ ] With “Melbourne/Australia” or country=AU, currency shows AUD across dashboard
- [ ] Currency persists after reload

## G. Paywall & Entitlements
- [ ] Free plan: after `FREE_SNAPSHOT_LIMIT`, all writes return 402 with upgrade/login
- [ ] Premium: after test checkout, entitlements flip; full net‑worth series returned (no ~90‑day cap)

## H. Dashboard – Net Worth & KPIs
- [ ] Sparkline renders when data exists
- [ ] “Updated” timestamp is friendly; no hydration warnings
- [ ] Net worth delta amount/percent formats correctly
- [ ] KPI bars: values, targets, and colors look logical
- [ ] “Explain this” opens a useful prompt in chat

## I. Level & Progress Insights
- [ ] Level card shows “Level N — Label” with a concise description
- [ ] “Next: Level N+1 …” is a single, plain sentence
- [ ] Progress insights reflect KPI changes and remain readable

## J. Action Plan
- [ ] Recommendations appear (≥1–2 items) with clear titles/steps
- [ ] “Open in chat” injects a helpful prompt
- [ ] “Mark done” persists via `/api/actions/complete` and reorders UI
- [ ] “Remove” persists via `/api/actions/dismiss` and hides item
- [ ] Completed/dismissed items survive reload and deduplicate sensibly

## K. Review Data Editor
- [ ] Opens from profile and dashboard
- [ ] Required fields indicated clearly; asterisk/chip on missing items
- [ ] Popover help toggles on click; outside click closes
- [ ] Dropdowns present for non‑numeric fields
- [ ] Edits persist and KPIs/Level recalc

## L. Header Chips
- [ ] “Free uses left” chip appears when near limit
- [ ] “Missing items” chip appears if core inputs are missing
- [ ] Both chips can display together and wrap on narrow widths

## M. Benchmarks & Sharing
- [ ] “People like you” renders with cohort details
- [ ] Expanded view shows p20/p50/p80 mini bars with your marker
- [ ] Share endpoints render images: `/share/benchmarks/opengraph-image?...`, `/twitter-image?...`
- [ ] Mobile Web Share works; desktop copies link

## N. Billing (Stripe test)
- [ ] `/api/billing/prices` returns data (501 if not configured)
- [ ] Pricing → checkout (use `4242 4242 4242 4242`) completes
- [ ] Webhook updates entitlements/period end (or `/api/billing/confirm` on return)
- [ ] Profile: “Manage plan” opens portal; “Upgrade” routes to checkout

## O. Feedback
- [ ] Submit feedback with category/severity; row created in DB
- [ ] Optional Slack webhook receives a formatted message
- [ ] Admin page lists items and updates severity/priority

## P. APIs (spot checks)
- [ ] GET `/api/prosper/dashboard?householdId=…` returns latest snapshot, series, entitlements, usage, household
- [ ] POST `/api/prosper/update-input` persists and returns KPIs/levels/recs
- [ ] GET `/api/v1/benchmarks?...` returns `{ cohort, n, metrics, fallback }`
- [ ] GET share image endpoints return PNGs
- [ ] GET `/api/session` returns ephemeral `client_secret`

## Q. Rate Limiting & Errors
- [ ] Burst GET `/api/prosper/dashboard` eventually returns 429 with `X‑RateLimit-*`
- [ ] With Upstash envs set, limiter uses Redis; otherwise in‑memory
- [ ] API errors use structured `{ error }` and do not leak stack traces

## R. Accessibility
- [ ] Avatar/button ARIA labels set; menu has `aria-haspopup`/`aria-expanded`
- [ ] Keyboard focus visible; dialogs/menus operable via keyboard
- [ ] Color contrast sufficient for text, chips, badges

## S. Responsiveness
- [ ] iPhone/Android: layout usable; mobile tab bar toggles Chat/Dashboard
- [ ] iPad/narrow desktop: no overflow; grids collapse sensibly

## T. Performance (baseline)
- [ ] Lighthouse on home/app acceptable (LCP/CLS)
- [ ] Realtime perceived latency < ~2s to first audio/text
- [ ] Console free of hydration warnings/errors

## U. Security & AuthZ
- [ ] All writes enforce `assertHouseholdAccess`; anonymous only for unowned households
- [ ] Inputs validated; no crashes on malformed bodies
- [ ] Secrets remain server‑side; tokens not logged

## V. Deployment Smoke (staging/prod)
- [ ] All envs present (OpenAI, Supabase, Stripe, APP_URL, Upstash)
- [ ] Stripe webhook at `/api/stripe/webhook`; secret set
- [ ] OAuth Google configured for prod domain; Additional Redirect URLs include `/auth/callback`
- [ ] Share images render on prod; links valid
- [ ] New user end‑to‑end: connect → inputs → snapshot → dashboard → plan → upgrade → premium

Tips
- For repeatable data: use the dev engine assertions route (`/api/dev/engine-v2`) or seed helpers
- Inspect Network tab for `/api/prosper/update-input` payloads and server responses when in doubt

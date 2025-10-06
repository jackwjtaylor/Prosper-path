Prosper AI — Your Voice‑Powered Money Coach

Prosper is a modern, voice‑first personal finance app built with Next.js and OpenAI Realtime. It combines a clean, modular dashboard, live KPI coaching, and an action plan that celebrates progress (confetti + chime when you mark tasks done). Speak to Prosper, or type — it listens, talks back, and keeps your plan up to date.

Highlights
- Voice‑first UX: Hero voice controls, header mic, and a floating VoiceDock. Connect, talk, mute/unmute, and auto‑send prompts.
- Modular dashboard: Net worth sparkline, Level, peer benchmarks, assets/liabilities, income/expenses, Prosper Insights, action plan, and KPI grid.
- Action plan: “Explain” auto‑sends questions to Prosper, foundational actions pinned, and “Mark done” keeps items inline with a Completed badge and celebration.
- Data review: “My Data” toggle to review and edit the inputs used in calculations.
- Premium & limits: Free uses chip, upgrade/manage via Stripe, realtime refresh on checkout/webhooks.
- Realtime sync: Supabase channels keep the dashboard fresh as snapshots are saved.
- Theming & style: Soft parchment background (#DAD6C9), borderless outer cards (#EFEEEB), standardized card typography.


Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS with CSS variables (see `globals.css`)
- OpenAI Realtime API via server‑issued ephemeral keys
- Supabase (browser + server SDK)
- Stripe Checkout/Portal + webhook


Getting Started
1) Install
   - `npm install`

2) Environment (`.env`)
   - OpenAI
     - `OPENAI_API_KEY` (required)
     - `REALTIME_MODEL` (optional; defaults to `gpt-realtime` with automatic fallback)
   - Supabase
     - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (browser)
     - `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY` (server)
   - Stripe
     - `STRIPE_SECRET_KEY` (billing) and optionally `STRIPE_WEBHOOK_SECRET`

3) Run
   - Dev: `npm run dev`
   - Build: `npm run build`
   - Start: `npm start`

4) Voice
   - Client requests an ephemeral key from `/api/session` (same‑origin + small rate‑limit). Ensure `OPENAI_API_KEY` is set.


Project Structure (selected)
- `src/app/components/SimpleWorkspace.tsx` — Shell (header, layout, voice/session wiring, transcript + dashboard)
- `src/app/components/Dashboard.tsx` — Modular dashboard grid, hero voice controls, action plan, KPI grid
- `src/app/components/TopVoiceControls.tsx` — Hero voice banner (connect/mic/visualizer + sample prompts)
- `src/app/components/VoiceDock.tsx` — Floating voice dock
- `src/app/components/BenchmarksCard.tsx` — Peer benchmarks with +/− details
- `src/app/components/ui/ActionCard.tsx` — Action plan card (Explain/Mark done)
- `src/app/components/ui/Sparkline.tsx` — Responsive sparkline (fills card space)
- `src/app/api/session/route.ts` — Issues ephemeral OpenAI Realtime keys
- `src/app/api/prosper/*` — Dashboard data & snapshots
- `src/app/api/billing/*` — Checkout/Portal/Confirm/Webhook (Stripe)
- `src/app/lib/*` — Normalization (net worth, income/expenses), KPI engine, currency, Supabase clients
- `src/app/state/store.ts` — Global UI/session store
- `tailwind.config.ts`, `src/app/globals.css` — Tailwind + tokenized theme


Core Features
Voice‑First Controls
- Hero banner: Big mic (pulse when listening), Connect/Disconnect, transcript toggle, animated bars, and “Try saying …” sample prompts (auto‑send).
- Header mic: Small mic button beside the avatar for quick connect/mute.
- VoiceDock: Bottom‑right dock to confirm state and toggle quickly.

Dashboard
- Net worth card with a sparkline that fills the card area.
- Row 1: Net Worth (×2), Prosper Insights (×2)
- Row 2: Level, People like you, Assets/Liabilities, Income/Expenses
- Row 3: Action Plan (full width, two‑column items), then KPI Grid (full width)

Action Plan
- Foundational actions pinned on top: Have the Money Talk, Get your $hit Together, Set your Foundations.
- Explain → Auto‑sends to Prosper (no need to press send).
- Mark done → Confetti + warm triad chime + badge; item stays inline.

Details Toggles (+)
- Level → next level hint
- Assets/Liabilities → equity and debt ratio
- Income/Expenses → leftover and savings rate
- People like you → p20/p50/p80 with your percentile

Billing & Limits
- Free uses chip + My Data/Upgrade/Manage buttons in the header.
- Stripe webhook updates subscription state; dashboard refreshes after checkout confirm.


Styling & Theming
- Design tokens in `globals.css`:
  - `--background: #DAD6C9` (also used as nav background)
  - `--card: #EFEEEB` (outer dashboard cards are borderless by default)
  - Helpers: `.card-label`, `.card-value`, `.card-meta`, `.card-section-title`
- Theme toggle: Circular sun/moon icon; header mic reinforces voice‑first branding.


Environment Variables (reference)
- OpenAI: `OPENAI_API_KEY`, `REALTIME_MODEL`
- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` or `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`


Development Notes
- Transcript is hidden by default; toggle from hero, header, or dock.
- Dashboard uses a 4‑column grid with consistent min‑heights by row (120/220/280 px). Net worth sparkline expands to fill remaining card space.
- `/api/session` enforces same‑origin and a small per‑IP rate limit; keep server keys private.


Scripts
- `npm run dev` — Start Next.js dev server
- `npm run build` — Build production assets
- `npm start` — Run production server
- `npm run lint` — Lint (skipped during CI build per config)


Deployment
- Deploy like any Next.js 15 app (Node 18+). Configure env vars in your platform (e.g., Vercel). Add Stripe webhook to `/api/stripe/webhook` if used.


Security & Privacy
- The session endpoint uses same‑origin checks and rate limiting.
- Handle personal data responsibly and according to your privacy policy.


License
See `LICENSE`.

From your terminal, navigate to the project directory and run the following commands:

```bash
# Install all required packages
npm install

# Start the development server
npm run dev
```

The application will be accessible at `http://localhost:3000`.


## Output Guardrails
Assistant messages are checked for safety and compliance before they are shown in the UI. The guardrail call now lives directly inside `src/app/components/SimpleWorkspace.tsx`: when a `response.text.delta` stream starts we mark the message as **IN_PROGRESS**, and once the server emits `guardrail_tripped` or `response.done` we mark the message as **FAIL** or **PASS** respectively. If you want to change how moderation is triggered or displayed, search for `guardrail_tripped` inside `SimpleWorkspace.tsx` and tweak the logic there.

## Waitlist Landing Page (Marketing‑only mode)

- Page: `/waitlist` with a built‑in email form.
- API: `POST /api/waitlist` upserts into `waitlist_signups`.

Supabase table (run in SQL editor):

```sql
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  source text,
  user_agent text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz not null default now(),
  constraint waitlist_email_unique unique (email)
);

alter table public.waitlist_signups enable row level security;
-- No public insert policy required if the API uses the service role key (recommended).
```

Environment (Vercel → Settings → Environment Variables):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only; never expose client‑side)
- `NEXT_PUBLIC_MARKETING_ONLY=1` (redirect all routes to `/waitlist`)

Production behavior with `NEXT_PUBLIC_MARKETING_ONLY=1`:
- Root `/` redirects to `/waitlist`.
- Middleware restricts all pages to the landing page (static assets and `/api/waitlist` allowed).

Local test:
- `NEXT_PUBLIC_MARKETING_ONLY=1 npm run dev` → visit `/` and `/waitlist`.

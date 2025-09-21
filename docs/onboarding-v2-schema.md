# Voice Onboarding V2 – Data Schema & Mapping

This document defines the fields captured during onboarding v2, how they map to UI state, and how they map to engine slots.

## Persona Fields (client store)
- name: string | undefined — first name for conversation.
- city: string | undefined — city name as given.
- country: string | undefined — ISO country or free text; mapped to slot when possible.
- ageDecade: 'teens'|'20s'|'30s'|'40s'|'50s'|'60s'|'70s'|'80s'|'90s'|'100s'|'unspecified'.
- partner: boolean | undefined — whether they manage with a partner.
- childrenCount: number | undefined — integer children count (0..20).
- tone: 'straight'|'relaxed'|'unspecified'.
- primaryGoal: string | undefined — the main money task they want to sort first.
- triedBefore: string | undefined — any prior attempt.
- email: string | undefined — collected with consent.
- phone: string | undefined — collected with consent.

Stored in: `src/app/state/onboarding.ts` (persisted in localStorage).

## Engine Slot Mapping (v2 slots)
- `country` ← persona.country (string)
- `partner` ← persona.partner (boolean)
- `dependants_count` ← persona.childrenCount (number)
- `birth_year` ← derived from ageDecade midpoint (approximate)
- `full_name` ← optional, if provided (used only to personalise UI; trim to first name client-side)

Note: during `/simple` snapshot, additional slots are collected (net income(s), essentials, rent/mortgage, cash, debt payments/total).

## Contact Capture & Leads
- Household email is updated via `POST /api/household/update` when user shares email.
- Lead payload (email/phone/persona) is sent to `POST /api/leads`. API attempts to insert into `prosper_leads` (falls back to server log if table missing).

Suggested table (DDL):
```sql
create table if not exists public.prosper_leads (
  id uuid primary key default gen_random_uuid(),
  household_id uuid null,
  name text null,
  email text null,
  phone text null,
  city text null,
  country text null,
  age_decade text null,
  partner boolean null,
  children_count int null,
  tone text null,
  primary_goal text null,
  tried_before text null,
  status text not null default 'onboarding',
  created_at timestamptz not null default now()
);
```

## Analytics (via feedback API)
- `onboarding_v2_start` — when v2 greeting is sent.
- `lead_saved` — when email/phone submitted (extra: booleans for presence).
- `simple_enter` — user lands on `/simple`.
- `simple_select_action` — when a plan tile is selected (extra: id).
- `simple_build_plan` — snapshot built from `/simple` (extra: selected actions).

Logged via `POST /api/feedback/submit` with `{ category: 'analytics', severity: 'low', message, extra }`.

## Privacy & Guardrails
- Consent: only persist PII (email/phone) after explicit consent; continue anonymously otherwise.
- Scope: educational information only — don’t give personalised financial, legal, tax, or investment advice.
- Storage: local persona is stored in localStorage; server-side persisted data is limited to leads and household email when provided.


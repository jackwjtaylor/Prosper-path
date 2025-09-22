# Repository Guidelines

## Project Structure & Modules
- `src/app`: Next.js App Router pages (`page.tsx`), layouts, and API routes (`api/*/route.ts`).
- `src/app/components` and `components/ui`: Reusable React components (PascalCase files).
- `src/app/lib` and `lib/*`: Business logic, validation, engines, and clients (TypeScript modules).
- `public`: Static assets. `docs/`: supplemental documentation. `scripts/`: local utilities (e.g., engine checks).
- Styling: Tailwind tokens in `src/app/globals.css`; config in `tailwind.config.ts`.

## Build, Test, and Dev Commands
- `npm run dev`: Start the Next.js dev server at `http://localhost:3000`.
- `npm run dev:clean`: Remove `.next/.turbo` and run dev fresh.
- `npm run build`: Production build.
- `npm start`: Serve the production build.
- `npm run lint`: ESLint (Next.js config).
- Engine checks: in one terminal run `NEXT_PUBLIC_PROSPER_ENGINE=v2 npm run dev`; in another run `npm run engine:test`.

## Coding Style & Naming
- Language: TypeScript + React 19 + Next.js 15 (App Router).
- Linting: ESLint (`eslint.config.mjs`). Aim for zero warnings before PR.
- Indentation: 2 spaces; prefer explicit types for exported functions.
- Naming: Components `PascalCase` (e.g., `TopVoiceControls.tsx`); functions/vars `camelCase`; route folders `kebab-case`; API handlers use `route.ts`.
- Tailwind: Use semantic utility groups; prefer tokens defined in `globals.css`.

## Testing Guidelines
- Framework: No unit test harness is bundled yet. Use `npm run engine:test` to assert engine scenarios against `/api/dev/engine-v2`.
- Local flow: start dev with `NEXT_PUBLIC_PROSPER_ENGINE=v2`, then run the engine test script.
- Suggested pattern (when adding tests): colocate `*.test.ts(x)` near modules or under `src/__tests__`.

## Commit & PR Guidelines
- Commits: Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`). Use imperative mood and keep scope small.
- PRs must include: concise description, linked issues, screenshots/GIFs for UI changes, testing steps, and any env/config notes.
- Keep diffs focused; run `npm run lint` before requesting review.

## Security & Configuration
- Secrets: Never commit `.env`. Use `.env.sample` as reference. Required keys include `OPENAI_API_KEY`, Supabase, and Stripe variables (see README).
- Realtime keys: `/api/session` issues ephemeral OpenAI keys; keep server-side keys private and respect same-origin checks.
- Guardrails: Output moderation is handled in `src/app/App.tsx` (search `guardrail_tripped`).

---

# Voice Agents, Onboarding V2, and App Flow

This section documents the new voice‑first onboarding, agent structure, runtime events, and how the Simple workspace integrates with the agents.

## Feature Flags & Entry
- `NEXT_PUBLIC_VOICE_ONBOARDING_V2=true` enables the redesigned onboarding.
- Landing entry: `/landingsimple` → Start → routes to `/app?source=landing-simple&agentConfig=onboardingV2`.
- Default voice is `cedar`. Users can still select another voice in state (`useAppStore().voice`).

## Agents & Prompts

### 1) Onboarding V2 Agent
- File: `src/app/agentConfigs/onboardingV2.ts`
- Voice: `cedar` (default)
- Tools:
  - `update_profile` (onboarding variant): stages persona fields and emits a UI event (`pp:onboarding_profile`) so the client can prefill downstream.
  - `store_user_profile` (onboarding variant): persists email/full name after explicit consent. Resolves/creates `householdId` before calling `/api/household/update`.
  - `finish_session`: signals the UI handoff at the end of Act IV.
- System intent:
  - Warm, human voice; British English; short turns (1–3 sentences).
  - Don’t give personalised financial/tax/legal/investment advice; educational only.
  - Turn‑taking policy: acknowledge each answer briefly, then immediately ask the next question; call `update_profile` when inferring fields; skip answered items.
  - Email dictation normalisation: “at/dot” → `@`/`.`; brief confirmation after save.
  - Handoff: after saying “I’ll open your Prosper workspace…”, call `finish_session` and stop.

### 2) Realtime Coach Agent (Main coach)
- File: `src/app/agentConfigs/realtimeOnly.ts`
- Voice: `cedar` (default)
- Tools include compute/persist/update functions and analytics; see file for full list.
- Important change: `update_profile` now also emits a `pp:onboarding_profile` event so the Simple workspace can prefill fields live when you speak numbers in that view.

## Runtime Flow

### A) `/app` with onboarding overlay
1. App connects to the onboarding agent (when `agentConfig=onboardingV2` and `source=landing-simple`).
2. As the user speaks, the onboarding agent calls `update_profile` (onboarding) → client receives `pp:onboarding_profile` events.
3. When the agent says it will open the workspace, it calls `finish_session`.
4. The app waits for the current assistant utterance to complete, then navigates to `/simple` and disconnects the background session.

### B) `/simple` (Simple workspace)
- Plain background (video removed for reduced distraction during testing).
- Card reveal: fades/lifts in after route for a polished transition.
- Prefill:
  - Uses the `OnboardingDraft` store in `src/app/state/onboarding.ts` to capture persona + financial slots.
  - Listens for:
    - `pp:onboarding_profile` (live slot updates to prefill any still‑empty inputs)
    - `pp:snapshot_saved` (re‑fetches `/api/prosper/dashboard` and backfills inputs if needed)
- Voice coach:
  - Upon arrival from onboarding, a lightweight coach session prompts the first Money Snapshot question (take‑home pay), then continues.
  - If preferred, this can be changed to a “Start voice guidance” CTA.
- Action tiles:
  - Full tile click: opens an inline explain dialog (voice + transcript) — no navigation.
  - Small `+ / ✓` toggle: select/deselect up to two actions without opening the dialog.
  - The dialog includes a 2–3 step checklist tailored per action.
  - “Mark done”: calls `POST /api/actions/complete`, plays a brief voice reflection, and local confetti.
- Post‑snapshot gating:
  - After “Build my Prosper Plan”, the page fetches `/api/prosper/dashboard` and unlocks tiles using provisional rules (e.g., `ef_months` ≥ 1 → “Prosper Pots”, ≥ 3 → “Increase EF” + “Automate investing”, etc.).
  - This will be replaced with deterministic engine gates.

## Global Client Events
- Emitted by agents/clients:
  - `pp:onboarding_profile` — payload `{ inputs, slots }`; used to prefill `/simple`.
  - `pp:onboarding_finish` — onboarding handoff; the app waits for current turn to complete, then routes to `/simple`.
  - `pp:snapshot_saved` — fired after snapshot/create; dashboards and `/simple` can refresh data.
  - `pp:disconnect_voice` — instructs any active voice session to disconnect (prevents overlapping audio when opening dialogs).
  - `pp:send_chat` — programmatic send to the coach agent; used for voice celebration and “Explain this” prompts.

## UI Components & Pages (key)
- Overlay: `src/app/components/VoiceOnboardingOverlay.tsx`
- App shell: `src/app/App.tsx` (session wiring, transcript, handoff logic, guardrails)
- Simple workspace: `src/app/components/SimpleWorkspace.tsx`
  - Inline explain dialog: lightweight realtime session, transcript, checklist, confetti on complete.

## Admin & Analytics
- Feedback Admin: `/feedback/admin` — filter by “Analytics”.
  - Key events: `onboarding_v2_start`, `lead_saved`, `simple_enter`, `simple_select_action`, `simple_build_plan`.
- Leads Admin: `/leads-admin?key=YOUR_ADMIN_KEY` (guarded by `NEXT_PUBLIC_ADMIN_KEY`).
  - `POST /api/leads` stores leads (best effort); `POST /api/leads/update` edits status/notes.

## API Endpoints (selected)
- `/api/session` — returns ephemeral voice model key (client‑side voice sessions only).
- `/api/household/update` — updates email/full_name; onboarding tool resolves/creates `householdId` first.
- `/api/prosper/snapshots` — compute+persist a snapshot; fires `pp:snapshot_saved`.
- `/api/prosper/dashboard` — latest snapshot + KPIs/levels/entitlements; used for gating and dashboards.
- `/api/actions/complete` — marks an action complete (used by Simple dialog and dashboard actions).

## Developer Notes
- Voice handoff timing: we defer routing until the assistant’s current utterance completes to avoid mid‑sentence cuts.
- Overlap prevention: opening any inline voice UI (e.g., explain dialog) sends `pp:disconnect_voice` so only one session is active at a time.
- Default voice: `cedar` across onboarding and coach; persisted via `useAppStore().voice`.
- Test hygiene: if dev HMR complains about missing chunks (e.g., `./8548.js`), run `npm run dev:clean`.

## QA Happy Flow Summary
1. `/landingsimple` → Start → voice onboarding (Act I–IV).
2. Provide persona answers; email saved by voice (if consented).
3. Prosper says it will open the workspace → app routes to `/simple` after the line completes.
4. `/simple` reveals smoothly; voice coach prompts Money Snapshot; spoken numbers auto‑fill fields.
5. Tile click → inline explain dialog + checklist; mark done → voice reflection + confetti.
6. Build plan → snapshot saved → gating unlocks (provisional rules) → tiles update.
7. Analytics visible in Feedback Admin.


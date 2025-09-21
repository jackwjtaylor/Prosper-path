# Onboarding V2 – Rollout Plan

## Flags
- `NEXT_PUBLIC_VOICE_ONBOARDING_V2=true` enables v2 flow from `/landingsimple`.
- Keep `NEXT_PUBLIC_VOICE_ONBOARDING` intact for legacy.

## Phased Rollout
1) Internal QA (dev only)
   - Desktop Chrome/Safari + iOS Safari.
   - Mic permissions (granted/denied), reconnect, mute/unmute.
   - Transcript readability and auto-scroll.
   - Persona chips show from voice answers.
   - `/simple` snapshot completes and routes to `/app/app`.
2) Pilot (10–20% traffic)
   - Gate via site routing (temporary param) or environment.
   - Monitor funnel: start → lead_saved → simple_enter → simple_build_plan.
3) Full roll
   - Set flag to true for all; keep fallback to legacy by removing `agentConfig=onboardingV2` if needed.

## Revert Path
- Toggle off `NEXT_PUBLIC_VOICE_ONBOARDING_V2` to return to legacy greeting.
- Remove `agentConfig=onboardingV2` from `/landingsimple` route.

## Observability
- Feedback admin → filter `Analytics` to see events.
- Add Supabase dashboard for `prosper_leads` if used.

## Success Criteria
- ≥70% get through Act II basics.
- ≥40% submit email/phone (lead_saved).
- ≥30% complete the `/simple` snapshot (simple_build_plan).

## Risks
- Mic permission friction → provide clear “Prefer to type?” path.
- Overlong voice turns → keep responses to 1–3 short sentences.


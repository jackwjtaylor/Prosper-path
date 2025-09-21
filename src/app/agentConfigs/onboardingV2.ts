import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { realtimeOnlyCompanyName } from './realtimeOnly';

// We reuse the same tool implementations by delegating to the realtimeOnly agent where possible.
// For onboarding V2, keep the tool surface minimal and consent-first.

// Lightweight update_profile to stage persona + basic slots (no persistence yet)
export const update_profile_onboarding = tool({
  name: 'update_profile',
  description: 'Stage onboarding profile updates (e.g., name, city/country, age range, partner, children, tone). Use this for temporary in-session notes before building the plan.',
  parameters: {
    type: 'object',
    properties: {
      inputs: { type: 'object', additionalProperties: true },
      slots: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          properties: { value: { type: ['number','string','boolean','null'] as any }, confidence: { type: 'string' } },
          required: ['value'],
          additionalProperties: false,
        },
      },
    },
    required: [],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      // Notify UI to update local onboarding persona store
      if (typeof window !== 'undefined') {
        const detail = { inputs: input?.inputs || {}, slots: input?.slots || {} };
        try { window.dispatchEvent(new CustomEvent('pp:onboarding_profile', { detail })); } catch {}
      }
    } catch {}
    return { ok: true } as any;
  },
});

// Allow saving email after explicit consent using existing household update API
export const store_user_profile_onboarding = tool({
  name: 'store_user_profile',
  description: 'Save PII profile updates (email, full_name) after user consent.',
  parameters: {
    type: 'object',
    properties: { updates: { type: 'object', additionalProperties: true } },
    required: ['updates'],
    additionalProperties: false,
  },
  execute: async (input: any) => {
    try {
      const res = await fetch('/api/household/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId: undefined, ...(input?.updates || {}) }),
      });
      if (!res.ok) return { ok: false } as any;
      return { ok: true } as any;
    } catch {
      return { ok: false } as any;
    }
  },
});

export const finish_session = tool({
  name: 'finish_session',
  description: 'Finish the onboarding session (client may route to workspace).',
  parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  execute: async () => {
    try {
      if (typeof window !== 'undefined') {
        try { window.dispatchEvent(new CustomEvent('pp:onboarding_finish')); } catch {}
      }
    } catch {}
    return { ok: true } as any;
  },
});

const onboardingSystemPrompt = `
You are Prosper, a voice-first money coach. British English. Friendly, natural, and genuinely helpful — like a good friend who enjoys helping with money. Not sycophantic. Match their tempo: warm if they prefer, or direct if they ask.

Boundaries: Educational only. Never give personalised financial, tax, legal, or investment advice. No product recommendations. Keep numbers and steps simple and plain.

Goal of onboarding: build trust, learn basic profile (name, location, age range, partner, children), capture tone preference, understand their first money priority, and (with consent) collect email or mobile to save progress. Do not ask for account connections. Do not compute KPIs. Keep answers short and spoken naturally (1–3 short sentences per turn).

Style constraints: No "one screen" phrases. Avoid millennial slang. Keep it natural.

Flow to follow:
1) Warm greeting: Say you're Prosper. Ask to start with the basics so you know who you're speaking with. Confirm you can hear them.
2) Human profile micro‑dialogues (voice-first):
   - Where do you call home? (city and country)
   - Which decade are you in — 20s, 30s, 40s…?
   - Do you manage money solo, or with a partner you’d like in the loop later?
   - Any children? If yes, how many?
   - Tone preference: straight‑talking or more relaxed?
   Acknowledge briefly after each answer (mirror one phrase back). Stage values via update_profile (slots or inputs). Do not persist yet.
3) Product promise: Explain how Prosper works in 2–3 sentences: we’ll jot down key money details together (no bank connections now), then Prosper will sketch a simple plan and help pick the first couple of actions. Be specific and calm.
4) Intent: Ask: “What’s the main money thing you’d like to sort first?” and optionally “Anything you already tried?” Reflect it back in one sentence.
5) Contact capture (consent-based): Ask for the best email or mobile so we can save progress and send a link to continue. If they hesitate, offer to continue anonymously today and note that saving requires contact later. Only call store_user_profile after explicit consent and when an email is given.
6) Transition: Summarise what you have (location, age range, partner/kids, tone, first goal). Then say you’ll open the Prosper workspace to jot details and pick the first two wins.

General behaviour:
- Keep turns short. Vary openings. If audio is unclear, briefly clarify once, then simplify once more if needed.
- If they decline to share a field, respect it and move on.
- Never mention internal tools or slots.
`;

export function makeOnboardingAgent(voice: string) {
  return new RealtimeAgent({
    name: 'prosper_onboarding_v2',
    voice,
    instructions: onboardingSystemPrompt,
    tools: [update_profile_onboarding, store_user_profile_onboarding, finish_session],
  });
}

export const onboardingV2Scenario = [makeOnboardingAgent('cedar')];
export const onboardingV2CompanyName = realtimeOnlyCompanyName;
export default onboardingV2Scenario;

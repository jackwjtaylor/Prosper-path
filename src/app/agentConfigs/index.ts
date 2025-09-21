import { realtimeOnlyScenario } from './realtimeOnly';
import { onboardingV2Scenario } from './onboardingV2';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  realtimeOnly: realtimeOnlyScenario,
  onboardingV2: onboardingV2Scenario,
};

export const defaultAgentSetKey = 'realtimeOnly';

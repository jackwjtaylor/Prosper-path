import { realtimeOnlyScenario } from './realtimeOnly';

import type { RealtimeAgent } from '@openai/agents/realtime';

// Map of scenario key -> array of RealtimeAgent objects
export const allAgentSets: Record<string, RealtimeAgent[]> = {
  realtimeOnly: realtimeOnlyScenario,
};

export const defaultAgentSetKey = 'realtimeOnly';

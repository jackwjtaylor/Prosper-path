"use client";

import { useSyncExternalStore } from 'react';

export type TonePreference = 'straight' | 'relaxed' | 'unspecified';
export type AgeDecade = 'teens'|'20s'|'30s'|'40s'|'50s'|'60s'|'70s'|'80s'|'90s'|'100s'|'unspecified';

export type OnboardingPersona = {
  name?: string;
  city?: string;
  country?: string;
  ageDecade?: AgeDecade;
  partner?: boolean;
  childrenCount?: number;
  tone?: TonePreference;
  primaryGoal?: string;
  triedBefore?: string;
  email?: string;
  phone?: string;
};

export type OnboardingStage = 'intro'|'profile'|'promise'|'intent'|'contact'|'summary'|'done';

export type OnboardingDraft = {
  netIncomeSelf?: number;
  netIncomePartner?: number;
  essentialExp?: number;
  housing?: 'rent'|'own'|'other';
  rent?: number;
  mortgagePmt?: number;
  cash?: number;
  debtPmts?: number;
  debtTotal?: number;
  rawSlots?: Record<string, { value: any; confidence?: string }>;
};

type OnboardingState = {
  stage: OnboardingStage;
  persona: OnboardingPersona;
  draft: OnboardingDraft;
};

type OnboardingActions = {
  setStage: (s: OnboardingStage) => void;
  updatePersona: (p: Partial<OnboardingPersona>) => void;
  updateDraft: (d: Partial<OnboardingDraft>) => void;
  reset: () => void;
};

export type OnboardingStore = OnboardingState & OnboardingActions;

const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

let obState: OnboardingStore = {
  stage: typeof window !== 'undefined' ? read<OnboardingStage>('ob_stage', 'intro') : 'intro',
  persona: typeof window !== 'undefined' ? read<OnboardingPersona>('ob_persona', {}) : {},
  draft: typeof window !== 'undefined' ? read<OnboardingDraft>('ob_draft', {}) : {},
  setStage: (s) => setState({ stage: s }),
  updatePersona: (p) => setState({ persona: { ...obState.persona, ...(p || {}) } }),
  updateDraft: (d) => setState({ draft: { ...obState.draft, ...(d || {}) } }),
  reset: () => setState({ stage: 'intro', persona: {} }),
};

function setState(partial: Partial<OnboardingState>) {
  obState = { ...obState, ...partial } as OnboardingStore;
  try {
    localStorage.setItem('ob_stage', JSON.stringify(obState.stage));
    localStorage.setItem('ob_persona', JSON.stringify(obState.persona));
    localStorage.setItem('ob_draft', JSON.stringify(obState.draft));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): OnboardingStore { return obState; }

export function useOnboardingStore<T>(selector: (s: OnboardingStore) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}

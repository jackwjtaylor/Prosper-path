"use client";

import { useSyncExternalStore } from 'react';
import { SessionStatus } from "@/app/types";

type AppStoreState = {
  sessionStatus: SessionStatus;
  selectedAgentName: string;
  isPTTActive: boolean;
  isPTTUserSpeaking: boolean;
  isAudioPlaybackEnabled: boolean;
  voice: string;
  isMicMuted: boolean;
  isTranscriptVisible: boolean;
};

type AppStoreActions = {
  setSessionStatus: (s: SessionStatus) => void;
  setSelectedAgentName: (name: string) => void;
  setIsPTTActive: (v: boolean) => void;
  setIsPTTUserSpeaking: (v: boolean) => void;
  setIsAudioPlaybackEnabled: (v: boolean) => void;
  setVoice: (v: string) => void;
  setIsMicMuted: (v: boolean) => void;
  setIsTranscriptVisible: (v: boolean) => void;
};

export type AppStore = AppStoreState & AppStoreActions;

function readPersistedBoolean(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}

function readPersistedString(key: string, fallback: string): string {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : String(v);
  } catch {
    return fallback;
  }
}

const listeners = new Set<() => void>();

let state: AppStore = {
  sessionStatus: "DISCONNECTED",
  selectedAgentName: "",
  isPTTActive: typeof window !== 'undefined' ? readPersistedBoolean('pushToTalkUI', false) : false,
  isPTTUserSpeaking: false,
  isAudioPlaybackEnabled: typeof window !== 'undefined' ? readPersistedBoolean('audioPlaybackEnabled', true) : true,
  voice: typeof window !== 'undefined' ? readPersistedString('voice', 'cedar') : 'cedar',
  isMicMuted: typeof window !== 'undefined' ? readPersistedBoolean('micMuted', false) : false,
  isTranscriptVisible: typeof window !== 'undefined' ? readPersistedBoolean('transcriptVisible', false) : false,

  setSessionStatus: (s) => setState({ sessionStatus: s }),
  setSelectedAgentName: (name) => setState({ selectedAgentName: name }),
  setIsPTTActive: (v) => setState({ isPTTActive: v }),
  setIsPTTUserSpeaking: (v) => setState({ isPTTUserSpeaking: v }),
  setIsAudioPlaybackEnabled: (v) => setState({ isAudioPlaybackEnabled: v }),
  setVoice: (v) => setState({ voice: v }),
  setIsMicMuted: (v) => setState({ isMicMuted: v }),
  setIsTranscriptVisible: (v) => setState({ isTranscriptVisible: v }),
};

function setState(partial: Partial<AppStoreState>) {
  state = { ...state, ...partial };
  // Persist selected toggles
  try {
    if (partial.hasOwnProperty('isPTTActive')) localStorage.setItem('pushToTalkUI', String(state.isPTTActive));
    if (partial.hasOwnProperty('isAudioPlaybackEnabled')) localStorage.setItem('audioPlaybackEnabled', String(state.isAudioPlaybackEnabled));
    if (partial.hasOwnProperty('voice')) localStorage.setItem('voice', String(state.voice));
    if (partial.hasOwnProperty('isMicMuted')) localStorage.setItem('micMuted', String(state.isMicMuted));
    if (partial.hasOwnProperty('isTranscriptVisible')) localStorage.setItem('transcriptVisible', String(state.isTranscriptVisible));
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): AppStore { return state; }

export function useAppStore<T>(selector: (s: AppStore) => T): T {
  return useSyncExternalStore(subscribe, () => selector(getState()), () => selector(getState()));
}

"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import Link from "next/link";

import Transcript from "./components/Transcript";
import Dashboard from "./components/Dashboard";
import LeftPaneControls from "./components/LeftPaneControls";
import ChatPanel from "./components/ChatPanel";
import VoiceDock from "./components/VoiceDock";
import ThemeToggle from "./components/ThemeToggle";
import VoiceOnboardingOverlay, { VoiceOnboardingPhase } from "./components/VoiceOnboardingOverlay";

import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { realtimeOnlyCompanyName, makeRealtimeAgent } from "@/app/agentConfigs/realtimeOnly";
import { makeOnboardingAgent } from "@/app/agentConfigs/onboardingV2";

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import { ensureHouseholdId } from "@/app/lib/householdLocal";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { useAppStore } from "@/app/state/store";
import { useOnboardingStore } from "@/app/state/onboarding";
import { hapticToggle } from "@/app/lib/haptics";

const sdkScenarioMap: Record<string, RealtimeAgent[]> = allAgentSets;

function App() {
  const router = useRouter();
  const searchParams = useSearchParams()!;
  // codec selection UI removed; keep default codec via SDK

  const { addTranscriptMessage, addTranscriptBreadcrumb } = useTranscript();
  const { logClientEvent, logServerEvent } = useEvent();

  // Global app state (Zustand)
  const selectedAgentName = useAppStore(s => s.selectedAgentName);
  const setSelectedAgentName = useAppStore(s => s.setSelectedAgentName);
  const sessionStatus = useAppStore(s => s.sessionStatus);
  const setSessionStatus = useAppStore(s => s.setSessionStatus);
  const isPTTActive = useAppStore(s => s.isPTTActive);
  const setIsPTTActive = useAppStore(s => s.setIsPTTActive);
  const isPTTUserSpeaking = useAppStore(s => s.isPTTUserSpeaking);
  const setIsPTTUserSpeaking = useAppStore(s => s.setIsPTTUserSpeaking);
  const isAudioPlaybackEnabled = useAppStore(s => s.isAudioPlaybackEnabled);
  const setIsAudioPlaybackEnabled = useAppStore(s => s.setIsAudioPlaybackEnabled);
  const selectedVoice = useAppStore(s => s.voice);
  const isMicMuted = useAppStore(s => s.isMicMuted);
  const setIsMicMuted = useAppStore(s => s.setIsMicMuted);
  const setIsTranscriptVisible = useAppStore(s => s.setIsTranscriptVisible);

  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<RealtimeAgent[] | null>(null);

  const [householdId, setHouseholdId] = useState<string>("");
  // Track auth state locally only where needed in ProfileMenu
  const [isReturningUser, setIsReturningUser] = useState<boolean>(false);
  const [entitlements, setEntitlements] = useState<{ plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string } | null>(null);
  const [usage, setUsage] = useState<{ free_limit?: number; used?: number; remaining?: number } | null>(null);
  const [isUserDataOpen, setIsUserDataOpen] = useState<boolean>(false);
  const [missingRequiredCount, setMissingRequiredCount] = useState<number>(0);
  const [householdInfo, setHouseholdInfo] = useState<{ email?: string; full_name?: string } | null>(null);
  const voiceOnboardingFlag = (process.env.NEXT_PUBLIC_VOICE_ONBOARDING || "").toLowerCase();
  const voiceOnboardingV2Flag = (process.env.NEXT_PUBLIC_VOICE_ONBOARDING_V2 || "").toLowerCase();
  const isVoiceOnboardingEnabled =
    voiceOnboardingFlag === "1" || voiceOnboardingFlag === "true" || voiceOnboardingFlag === "yes" ||
    voiceOnboardingV2Flag === "1" || voiceOnboardingV2Flag === "true" || voiceOnboardingV2Flag === "yes";
  const isLandingSimpleSource = (searchParams.get("source") || "").toLowerCase() === "landing-simple";
  const shouldShowVoiceIntroInitially = isVoiceOnboardingEnabled && isLandingSimpleSource;
  const [showVoiceIntro, setShowVoiceIntro] = useState<boolean>(shouldShowVoiceIntroInitially);
  const [voiceIntroPhase, setVoiceIntroPhase] = useState<VoiceOnboardingPhase>("idle");
  const [voiceIntroError, setVoiceIntroError] = useState<string | null>(null);
  const voiceIntroTriggeredRef = useRef(false);
  const voiceIntroGreetingSentRef = useRef(false);
  const voiceIntroEngagedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [voiceIntroSegments, setVoiceIntroSegments] = useState<Array<{ speaker: 'assistant' | 'user'; text: string }>>([]);
  const [voiceIntroName, setVoiceIntroName] = useState<string>("");
  const updatePersona = useOnboardingStore(s => s.updatePersona);
  useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);
  useEffect(() => {
    if (!isVoiceOnboardingEnabled) return;
    if (!isLandingSimpleSource) return;
    if (voiceIntroTriggeredRef.current) return;
    voiceIntroTriggeredRef.current = true;
    voiceIntroGreetingSentRef.current = false;
    setVoiceIntroPhase("idle");
    setVoiceIntroSegments([]);
    setVoiceIntroName("");
    setShowVoiceIntro(true);
    // overlay remains until user chooses to switch modes
  }, [isVoiceOnboardingEnabled, isLandingSimpleSource]);

  useEffect(() => {
    if (showVoiceIntro) {
      setIsTranscriptVisible(true);
    }
  }, [showVoiceIntro, setIsTranscriptVisible]);

  // Listen for onboarding v2 tool events to update persona and finish onboarding
  useEffect(() => {
    const onProfile = (e: any) => {
      try {
        const inputs = (e?.detail?.inputs || {}) as Record<string, any>;
        const slots = (e?.detail?.slots || {}) as Record<string, any>;
        const persona: any = {};
        // Name
        const fullName = inputs.full_name || slots.full_name?.value || inputs.name;
        if (typeof fullName === 'string' && fullName.trim()) persona.name = fullName.trim().split(' ')[0];
        // City/Country
        if (typeof inputs.city === 'string') persona.city = inputs.city;
        if (typeof inputs.country === 'string') persona.country = inputs.country;
        if (typeof slots.country?.value === 'string') persona.country = slots.country.value;
        // Partner
        const partnerVal = (typeof inputs.partner === 'boolean') ? inputs.partner : slots.partner?.value;
        if (typeof partnerVal === 'boolean') persona.partner = partnerVal;
        // Children
        const kids = inputs.childrenCount ?? inputs.children ?? slots.dependants_count?.value;
        if (kids != null && Number.isFinite(Number(kids))) persona.childrenCount = Number(kids);
        // Tone
        const tone = (inputs.tone || inputs.tone_preference || '').toString().toLowerCase();
        if (tone.includes('straight')) persona.tone = 'straight';
        else if (tone.includes('relax') || tone.includes('laid')) persona.tone = 'relaxed';
        // Goals
        if (typeof inputs.primaryGoal === 'string' && inputs.primaryGoal.trim()) persona.primaryGoal = inputs.primaryGoal.trim();
        else if (typeof inputs.goal === 'string' && inputs.goal.trim()) persona.primaryGoal = inputs.goal.trim();
        if (typeof inputs.triedBefore === 'string' && inputs.triedBefore.trim()) persona.triedBefore = inputs.triedBefore.trim();
        // Age decade from birth_year if present
        const by = slots.birth_year?.value || inputs.birth_year;
        if (by && Number.isFinite(Number(by))) {
          const yr = Number(by);
          const now = new Date().getUTCFullYear();
          const age = Math.max(0, now - yr);
          const decade = Math.floor(age / 10) * 10;
          if (decade >= 10) persona.ageDecade = (decade.toString() + 's') as any;
        }
        updatePersona(persona);
      } catch {}
    };
    const onFinish = () => {
      try {
        const url = new URL(window.location.href);
        const agentConfig = (url.searchParams.get('agentConfig') || '').toLowerCase();
        const source = (url.searchParams.get('source') || '').toLowerCase();
        const v2 = agentConfig === 'onboardingv2' && source === 'landing-simple';
        if (v2) router.push('/simple');
      } catch {}
    };
    window.addEventListener('pp:onboarding_profile', onProfile as any);
    window.addEventListener('pp:onboarding_finish', onFinish as any);
    return () => {
      window.removeEventListener('pp:onboarding_profile', onProfile as any);
      window.removeEventListener('pp:onboarding_finish', onFinish as any);
    };
  }, [router, updatePersona]);
  // Track auth status and auto-link household when signed in
  useEffect(() => {
    const supa = getSupabaseClient();
    if (!supa) return;
    (async () => {
      const sessRes = await supa.auth.getSession();
      const data = 'data' in sessRes ? sessRes.data : undefined;
      const authed = !!data?.session;
      if (authed) {
        try {
          const token = data?.session?.access_token;
          await fetch('/api/household/ensure', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
        } catch {}
      }
    })();
    const { data: sub } = supa.auth.onAuthStateChange(async (_event, session) => {
      const authed = !!session;
      if (authed) {
        try { await fetch('/api/household/ensure', { method: 'POST', headers: { Authorization: `Bearer ${session!.access_token}` } }); } catch {}
      }
    });
    return () => { sub.subscription?.unsubscribe(); };
  }, []);

  // Allow UI components to toggle the voice connection globally
  useEffect(() => {
    const onToggle = () => { onToggleConnection(); };
    window.addEventListener('pp:toggle_connection', onToggle as any);
    return () => window.removeEventListener('pp:toggle_connection', onToggle as any);
  }, [sessionStatus]);
  useEffect(() => {
    (async () => {
      if (!householdId) return;
      try {
        const headers: any = {};
        try {
          const supa = getSupabaseClient();
          if (supa) {
            const { data } = await supa.auth.getSession();
            const token = data?.session?.access_token;
            if (token) headers.Authorization = `Bearer ${token}`;
          }
        } catch {}
        const res = await fetch(`/api/prosper/dashboard?householdId=${householdId}`, { cache: 'no-store', headers });
        const json = await res.json();
        const inputs = json?.latestSnapshot?.inputs || {};
        const hasInputs = inputs && typeof inputs === 'object' && Object.keys(inputs).length > 0;
        setIsReturningUser(!!hasInputs);
        setEntitlements(json?.entitlements || null);
        setUsage(json?.usage || null);
        setHouseholdInfo(json?.household || null);
      } catch {}
    })();
  }, [householdId]);

  // Receive dashboard's data-view and missing-required indicators for header UI
  useEffect(() => {
    const onState = (e: any) => {
      const open = !!(e?.detail?.open);
      const missing = Number(e?.detail?.missingRequired ?? 0);
      setIsUserDataOpen(open);
      setMissingRequiredCount(Number.isFinite(missing) ? missing : 0);
    };
    window.addEventListener('pp:user_data_state', onState as any);
    return () => window.removeEventListener('pp:user_data_state', onState as any);
  }, []);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [handoffTriggered, setHandoffTriggered] = useState<boolean>(false);

  const sdkAudioElement = React.useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    const el = document.createElement('audio');
    el.autoplay = true;
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    if (sdkAudioElement && !audioElementRef.current) {
      audioElementRef.current = sdkAudioElement;
    }
  }, [sdkAudioElement]);

  const { connect, disconnect, sendUserText, sendEvent, interrupt, mute } = useRealtimeSession({
    onConnectionChange: (s) => setSessionStatus(s as SessionStatus),
    onAgentHandoff: (agentName: string) => {
      setHandoffTriggered(true);
      setSelectedAgentName(agentName);
    },
    onTranscriptDelta: (delta: string, speaker) => {
      if (!delta) return;
      if (speaker !== 'assistant') return;
      setVoiceIntroSegments(prev => {
        const next = [...prev];
        if (!next.length || next[next.length - 1].speaker !== 'assistant') {
          next.push({ speaker: 'assistant', text: '' });
        }
        const last = next[next.length - 1];
        next[next.length - 1] = { speaker: 'assistant', text: last.text + delta };
        return next;
      });
    },
    onTranscriptCompleted: (text: string, speaker) => {
      if (!text) return;
      if (speaker === 'assistant') {
        setVoiceIntroSegments(prev => {
          const next = [...prev];
          if (!next.length || next[next.length - 1].speaker !== 'assistant') {
            next.push({ speaker: 'assistant', text });
          } else {
            next[next.length - 1] = { speaker: 'assistant', text };
          }
          return next;
        });
      } else {
        setVoiceIntroSegments(prev => [...prev, { speaker: 'user', text }]);
      }
      if (!voiceIntroName) {
        const match = text.match(/\b(?:i'm|i am|my name is)\s+([A-Z][a-zA-Z-' ]+)/i);
        const candidate = match?.[1];
        if (candidate && candidate.toLowerCase() !== 'prosper') {
          setVoiceIntroName(candidate.trim());
        }
      }
    },
  });
  const [userText, setUserText] = useState<string>("");

  const { startRecording, stopRecording } = useAudioDownload();

  const sendClientEvent = useCallback((eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  }, [sendEvent, logClientEvent]);

  useHandleSessionHistory();

  // Initial scenario/agent selection
  useEffect(() => {
    let finalAgentConfig = searchParams.get("agentConfig");
    if (!finalAgentConfig || !allAgentSets[finalAgentConfig]) {
      finalAgentConfig = defaultAgentSetKey;
      const url = new URL(window.location.toString());
      url.searchParams.set("agentConfig", finalAgentConfig);
      window.history.replaceState({}, "", url.toString());
    }
    const agents = allAgentSets[finalAgentConfig!];
    const agentKeyToUse = agents[0]?.name || "";
    setSelectedAgentName(agentKeyToUse);
    setSelectedAgentConfigSet(agents);
  }, [searchParams]);

  useEffect(() => {
    // Auto-connect when an agent is selected; consent now handled in-greeting
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && selectedAgentConfigSet && selectedAgentName) {
      const currentAgent = selectedAgentConfigSet.find((a) => a.name === selectedAgentName);
      addTranscriptBreadcrumb(`Agent: ${selectedAgentName}`, currentAgent);
      // Configure session detection, then send initial simulated message
      updateSession();
      (async () => {
        if (isReturningUser) {
          try {
            const res = await fetch(`/api/prosper/dashboard?householdId=${householdId}`, { cache: 'no-store' });
            const json = await res.json();
            const inputs = json?.latestSnapshot?.inputs || {};
            const tracker = { householdId, slots: inputs?.slots || {}, locale: 'en-GB', currency: inputs?.currency || 'USD' };
            const msg = `ACTION=RECAP; RETURNING_USER=TRUE; DO_NOT_REASK_BASICS=TRUE; tracker=${JSON.stringify(tracker)}`;
            sendSimulatedUserMessage(msg);
          } catch {
            sendSimulatedUserMessage('ACTION=RECAP; RETURNING_USER=TRUE; DO_NOT_REASK_BASICS=TRUE');
          }
        } else if (!handoffTriggered) {
          sendSimulatedUserMessage('hi');
        }
        setHandoffTriggered(false);
      })();
    }
  }, [selectedAgentConfigSet, selectedAgentName, sessionStatus, isReturningUser, householdId, handoffTriggered]);

  // Post-checkout confirmation: if we have session_id, confirm and refresh entitlements
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    (async () => {
      if (checkout === 'success' && sessionId) {
        try {
          await fetch(`/api/billing/confirm?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
          // Nudge dashboard to refresh
          try {
            window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { billing: true } }));
            window.dispatchEvent(new CustomEvent('pp:billing_confirmed', { detail: { sessionId } }));
          } catch {}
          // Add a friendly assistant message in transcript
          try {
            const id = uuidv4().slice(0, 32);
            addTranscriptMessage(id, 'assistant', 'Thanks — your Prosper Premium is now active. You now have full net‑worth history, saved plans, and deeper action checklists. Would you like to review your dashboard or continue in chat?');
          } catch {}
        } catch {}
      }
    })();
  }, [searchParams]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED") {
      updateSession();
    }
  }, [isPTTActive, isMicMuted]);

  const fetchEphemeralKey = async (): Promise<{ key: string; model?: string } | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    const data = await tokenResponse.json();
    logServerEvent(data, "fetch_session_token_response");
    if (!data.client_secret?.value) {
      logClientEvent(data, "error.no_ephemeral_key");
      console.error("No ephemeral key provided by the server");
      setSessionStatus("DISCONNECTED");
      return null;
    }
    return { key: data.client_secret.value as string, model: (data.model as string | undefined) };
  };

  const connectToRealtime = async () => {
    const agentSetKey = searchParams.get("agentConfig") || defaultAgentSetKey;
    if (sdkScenarioMap[agentSetKey]) {
      if (sessionStatus !== "DISCONNECTED") return;
      setSessionStatus("CONNECTING");
      try {
        const EK = await fetchEphemeralKey();
        if (!EK) return;

        const reorderedAgents = [...sdkScenarioMap[agentSetKey]];
        const idx = reorderedAgents.findIndex((a) => a.name === selectedAgentName);
        if (idx > 0) {
          const [agent] = reorderedAgents.splice(idx, 1);
          reorderedAgents.unshift(agent);
        }
        // Apply selected voice to the root agent by constructing a fresh instance
        const agentsToUse: RealtimeAgent[] = reorderedAgents.map((a, i) => {
          if (i === 0) {
            const key = agentSetKey;
            if (key === 'onboardingV2') {
              // Recreate onboarding agent with selected voice
              return makeOnboardingAgent(selectedVoice || 'cedar');
            }
            // Default realtime coaching agent
            return makeRealtimeAgent(selectedVoice || 'cedar');
          }
          return a;
        });

        const companyName = realtimeOnlyCompanyName;
        const guardrail = createModerationGuardrail(companyName);

        await connect({
          getEphemeralKey: async () => EK,
          initialAgents: agentsToUse,
          audioElement: sdkAudioElement,
          outputGuardrails: [guardrail],
          extraContext: { addTranscriptBreadcrumb, sessionState: {} },
        });
      } catch (err) {
        console.error("Error connecting via SDK:", err);
        setSessionStatus("DISCONNECTED");
      }
      return;
    }
  };

  useEffect(() => {
    if (!showVoiceIntro || !isVoiceOnboardingEnabled) return;
    let cancelled = false;

    const start = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setVoiceIntroError("Microphone access is not supported in this browser.");
        setVoiceIntroPhase("error");
        return;
      }
      try {
        setVoiceIntroError(null);
        setVoiceIntroPhase("requesting");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
        if (cancelled) return;

        setVoiceIntroPhase("connecting");
        setIsAudioPlaybackEnabled(true);
        setIsMicMuted(false);
        setVoiceIntroSegments([]);
        setVoiceIntroName("");
      } catch (err) {
        if (cancelled) return;
        console.error("Microphone permission denied", err);
        setVoiceIntroError("Microphone permission is required to talk with Prosper.");
        setVoiceIntroPhase("error");
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [showVoiceIntro, isVoiceOnboardingEnabled, setIsAudioPlaybackEnabled, setIsMicMuted]);

  useEffect(() => {
    if (!showVoiceIntro || voiceIntroPhase === "error" || !isVoiceOnboardingEnabled) return;

    if (sessionStatus === "CONNECTING") {
      setVoiceIntroPhase((prev) => (prev === "requesting" ? "requesting" : "connecting"));
    }

    if (sessionStatus === "CONNECTED") {
      setVoiceIntroPhase((prev) => {
        if (prev === "connecting" || prev === "requesting" || prev === "idle") {
          return "listening";
        }
        return prev;
      });
      if (!voiceIntroGreetingSentRef.current) {
        voiceIntroGreetingSentRef.current = true;
        try {
          // If onboarding V2 agent is selected, use the richer welcome aligned to the new flow
          const url = new URL(window.location.href);
          const agentConfig = url.searchParams.get('agentConfig') || '';
          const isV2 = agentConfig === 'onboardingV2';
          const instructions = isV2
            ? "Hey, I’m Prosper. I get most excited when I can help someone get their money pointed where they want it. Mind if we start with the basics so I know who I’m speaking with? First, can you tell me your first name?"
            : "You are Prosper, a warm and trustworthy money coach. Greet the user in a friendly tone, confirm you can hear them clearly, ask for their first name, and keep your greeting concise. Include the user's name in future responses once provided.";
          sendClientEvent({ type: 'response.create', instructions }, 'voice_onboarding_intro');
          // Analytics: onboarding v2 start
          if (isV2) {
            try { fetch('/api/feedback/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'analytics', severity: 'low', message: 'onboarding_v2_start' }) }); } catch {}
          }
        } catch (err) {
          console.error('Failed to send onboarding greeting', err);
        }
        if (voiceIntroEngagedTimeoutRef.current) {
          clearTimeout(voiceIntroEngagedTimeoutRef.current);
        }
        voiceIntroEngagedTimeoutRef.current = setTimeout(() => {
          setVoiceIntroPhase("engaged");
          voiceIntroEngagedTimeoutRef.current = null;
        }, 400);
      }
    }
  }, [showVoiceIntro, voiceIntroPhase, sessionStatus, isVoiceOnboardingEnabled, sendClientEvent]);

  useEffect(() => {
    return () => {
      if (voiceIntroEngagedTimeoutRef.current) {
        clearTimeout(voiceIntroEngagedTimeoutRef.current);
        voiceIntroEngagedTimeoutRef.current = null;
      }
    };
  }, []);

  const disconnectFromRealtime = () => {
    disconnect();
    setSessionStatus("DISCONNECTED");
    setIsPTTUserSpeaking(false);
  };

  const sendSimulatedUserMessage = (text: string) => {
    const id = uuidv4().slice(0, 32);
    addTranscriptMessage(id, "user", text, true);
    sendClientEvent({
      type: 'conversation.item.create',
      item: { id, type: 'message', role: 'user', content: [{ type: 'input_text', text }] },
    });
    sendClientEvent({ type: 'response.create' }, '(simulated user text message)');
  };

  const handleSkipVoiceIntro = () => {
    setShowVoiceIntro(false);
    setVoiceIntroPhase('idle');
    setVoiceIntroError(null);
    voiceIntroGreetingSentRef.current = true;
    if (voiceIntroEngagedTimeoutRef.current) {
      clearTimeout(voiceIntroEngagedTimeoutRef.current);
      voiceIntroEngagedTimeoutRef.current = null;
    }
    setVoiceIntroSegments([]);
    setVoiceIntroName("");
    // If onboarding V2 is active, proceed to simplified workspace route
    try {
      const agentConfig = (searchParams.get('agentConfig') || '').toLowerCase();
      const source = (searchParams.get('source') || '').toLowerCase();
      const v2 = agentConfig === 'onboardingv2' && source === 'landing-simple';
      if (v2) router.push('/simple');
    } catch {}
  };

  const handleOverlayToggleVoice = () => {
    const next = !isAudioPlaybackEnabled;
    setIsAudioPlaybackEnabled(next);
    try {
      const msg = next ? 'voice_unmuted' : 'voice_muted';
      fetch('/api/feedback/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: 'analytics', severity: 'low', message: msg }) });
    } catch {}
  };

  const updateSession = () => {
    const turnDetection = (!isPTTActive && !isMicMuted)
      ? { type: 'server_vad', threshold: 0.9, prefix_padding_ms: 300, silence_duration_ms: 500, create_response: true }
      : null;

    sendEvent({ type: 'session.update', session: { turn_detection: turnDetection } });
    // Initial message handled separately based on isReturningUser
    return;
  };

  const handleSendTextMessage = () => {
    if (!userText.trim()) return;
    interrupt();
    try {
      sendUserText(userText.trim());
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
    setUserText("");
  };

  // PTT controls
  const handleTalkButtonDown = () => {
    if (sessionStatus !== 'CONNECTED') return;
    interrupt();
    setIsPTTUserSpeaking(true);
    sendClientEvent({ type: 'input_audio_buffer.clear' }, 'clear PTT buffer');
  };
  const handleTalkButtonUp = () => {
    if (sessionStatus !== 'CONNECTED' || !isPTTUserSpeaking) return;
    setIsPTTUserSpeaking(false);
    sendClientEvent({ type: 'input_audio_buffer.commit' }, 'commit PTT');
    sendClientEvent({ type: 'response.create' }, 'trigger response PTT');
  };

  const onToggleConnection = () => {
    if (sessionStatus === "CONNECTED" || sessionStatus === "CONNECTING") {
      disconnectFromRealtime();
      setSessionStatus("DISCONNECTED");
    } else {
      connectToRealtime();
    }
  };

  // UI toggles now persisted via Zustand store (no extra effects needed)

  // Audio playback & recording
  useEffect(() => {
    if (audioElementRef.current) {
      if (isAudioPlaybackEnabled) {
        audioElementRef.current.muted = false;
        audioElementRef.current.play().catch(() => {});
      } else {
        audioElementRef.current.muted = true;
        audioElementRef.current.pause();
      }
    }
    try { mute(!isAudioPlaybackEnabled); } catch {}
  }, [isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === 'CONNECTED') {
      try { mute(!isAudioPlaybackEnabled); } catch {}
    }
  }, [sessionStatus, isAudioPlaybackEnabled]);

  useEffect(() => {
    if (sessionStatus === "CONNECTED" && audioElementRef.current?.srcObject) {
      const remoteStream = audioElementRef.current.srcObject as MediaStream;
      startRecording(remoteStream);
    }
    return () => { stopRecording(); };
  }, [sessionStatus]);

  const [activeTab, setActiveTab] = useState('chat' as 'chat' | 'dashboard');
  const isTranscriptVisible = useAppStore(s => s.isTranscriptVisible);
  const [shouldRenderChat, setShouldRenderChat] = useState(true);
  const [showChatColumn, setShowChatColumn] = useState(true);

  // Animate transcript hide: slide left then collapse column
  useEffect(() => {
    if (isTranscriptVisible) {
      setShowChatColumn(true);
      setShouldRenderChat(true);
    } else {
      // keep rendered for animation, then collapse
      const t = setTimeout(() => {
        setShowChatColumn(false);
        setShouldRenderChat(false);
      }, 320);
      return () => clearTimeout(t);
    }
  }, [isTranscriptVisible]);

  // Allow dashboard to request opening chat with prefilled text
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const text = e?.detail?.text as string | undefined;
        if (typeof text === 'string' && text.trim()) {
          setActiveTab('chat');
          setUserText(text);
        } else {
          setActiveTab('chat');
        }
      } catch {
        setActiveTab('chat');
      }
    };
    window.addEventListener('pp:open_chat', handler as any);
    return () => window.removeEventListener('pp:open_chat', handler as any);
  }, []);

  // Allow other components to programmatically send a message (auto-send)
  // Use the SDK helper so the agent responds in voice as well as text.
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      try {
        const text = e?.detail?.text as string | undefined;
        if (typeof text === 'string' && text.trim()) {
          setActiveTab('chat');
          interrupt();
          try {
            sendUserText(text.trim());
            // Explicitly request a response so TTS/audio is produced.
            sendEvent({ type: 'response.create' });
          } catch {}
        }
      } catch {}
    };
    window.addEventListener('pp:send_chat', handler as any);
    return () => window.removeEventListener('pp:send_chat', handler as any);
  }, [sendUserText, sendEvent, interrupt]);

  return (
    <div className="text-base flex flex-col h-screen bg-app text-foreground">
      {/* Header */}
      <div className="px-2 py-3 max-w-7xl mx-auto w-full">
        <div className="nav-shell text-lg font-semibold flex justify-between items-center">
          <Link href="/home" className="flex items-center">
            <Image
              src="/prosper_wordmark.svg"
              alt="Prosper wordmark"
              width={192}
              height={40}
              className="h-8 w-auto md:h-10"
              priority
            />
            <span className="sr-only">Prosper</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/feedback"
              className="btn-cta btn-pill h-8 leading-none inline-flex items-center gap-2 text-xs shadow-sm"
            >
              Give Feedback
            </Link>
          </nav>
          <div className="flex items-center gap-2">
          {/* Free uses chip (non-premium only) */}
          {entitlements?.plan !== 'premium' && typeof usage?.remaining === 'number' && (
            <div className="chip shrink-0" title="Free uses remaining">
              Free uses: <b>{Math.max(0, Number(usage?.remaining ?? 0))}</b>
            </div>
          )}

          {/* My Data / Dashboard toggle (same size as Upgrade) */}
          <button
            type="button"
            className="btn-outline btn-pill h-8 inline-flex items-center gap-2 text-xs shadow-sm shrink-0"
            onClick={() => { try { window.dispatchEvent(new CustomEvent('pp:open_user_data')); } catch {} }}
            title="View and edit the data used for your calculations"
          >
            {isUserDataOpen ? 'Dashboard' : 'My Data'}
            {missingRequiredCount > 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-red-600 text-white text-[10px]"
                title={`${missingRequiredCount} required item${missingRequiredCount === 1 ? '' : 's'} missing`}
                aria-label={`Missing required: ${missingRequiredCount}`}
              >
                !
              </span>
            )}
          </button>

          {/* Manage/Upgrade plan */}
          {householdId && entitlements?.plan === 'premium' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await fetch('/api/billing/create-portal-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
                  const j = await res.json();
                  if (j?.url) window.location.href = j.url;
                } catch {}
              }}
              className="btn-outline btn-pill h-8 inline-flex items-center gap-2 text-xs shadow-sm"
            >
              Manage plan
            </button>
          )}
          {householdId && entitlements?.plan !== 'premium' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  const email = householdInfo?.email;
                  const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email }) });
                  const j = await res.json();
                  if (j?.url) window.location.href = j.url;
                } catch {}
              }}
              className="btn-cta btn-pill h-8 inline-flex items-center gap-2 text-xs shadow-sm"
            >
              Upgrade
            </button>
          )}

          {/* Header mic icon */}
          <button
            onClick={() => {
              if (sessionStatus === 'CONNECTED') {
                setIsMicMuted(!isMicMuted);
              } else {
                onToggleConnection();
              }
            }}
            aria-pressed={sessionStatus === 'CONNECTED' && !isMicMuted}
            aria-label={sessionStatus === 'CONNECTED' ? (isMicMuted ? 'Unmute microphone' : 'Mute microphone') : 'Connect voice'}
            title={sessionStatus === 'CONNECTED' ? (isMicMuted ? 'Unmute mic' : 'Mute mic') : 'Connect voice'}
            className={`relative h-9 w-9 rounded-full border flex items-center justify-center transition-colors ${
              sessionStatus !== 'CONNECTED'
                ? 'bg-gray-200 text-gray-500 border-gray-200'
                : isMicMuted
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-emerald-600 text-white border-emerald-600'
            }`}
          >
            {sessionStatus === 'CONNECTED' && !isMicMuted && (
              <span className="animate-ping absolute inline-flex h-9 w-9 rounded-full bg-emerald-400 opacity-30"></span>
            )}
            <span className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"/>
                <path d="M5 11a7 7 0 0 0 14 0" fill="none" stroke="currentColor" strokeWidth="1.8"/>
                <path d="M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.8"/>
              </svg>
            </span>
          </button>

            <ThemeToggle />
            <ProfileMenu
              householdId={householdId}
              entitlements={entitlements}
              household={householdInfo}
            />
          </div>
        </div>
      </div>

      {/* BODY: centered 2-col grid so the left pane sizes cleanly */}
      <div className="flex-1 w-full min-h-0">
        <div className="max-w-7xl mx-auto px-2 h-full min-h-0 pb-16 lg:pb-0">
          <div className={`hidden lg:grid grid-cols-1 ${showChatColumn ? 'lg:grid-cols-[520px_1fr]' : 'lg:grid-cols-1'} gap-4 h-full min-h-0`}>
            {/* Left column: Integrated Chat Panel (animates out) */}
            {showChatColumn && (
              <div className={`transition-all duration-300 ease-out ${isTranscriptVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                {shouldRenderChat && (
                  <ChatPanel
                    userText={userText}
                    setUserText={setUserText}
                    onSendMessage={handleSendTextMessage}
                    onToggleConnection={onToggleConnection}
                  />
                )}
              </div>
            )}

            {/* Right column: Dashboard expands to full width when transcript hidden */}
            <Dashboard />
          </div>

          {/* Mobile: single view with tabs */}
          <div className="block lg:hidden h-full min-h-0">
            {activeTab === 'chat' ? (
              <ChatPanel
                userText={userText}
                setUserText={setUserText}
                onSendMessage={handleSendTextMessage}
                onToggleConnection={onToggleConnection}
              />
            ) : (
              <Dashboard />
            )}
          </div>
        </div>

        {/* Bottom mobile voice-first nav */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-sm z-40">
          <div className="max-w-7xl mx-auto px-3">
            <div className="flex items-center justify-between py-2 gap-2">
              <button
                className={`flex-1 px-3 py-2 rounded-md text-sm ${activeTab === 'chat' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}
                onClick={() => setActiveTab('chat')}
                aria-label="Chat"
              >
                Chat
              </button>
              <button
                className={`shrink-0 h-12 w-12 rounded-full border shadow-sm ${
                  isMicMuted ? 'bg-red-600 border-red-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white'
                }`}
                onClick={() => { setIsMicMuted(!isMicMuted); hapticToggle(!isMicMuted); }}
                disabled={sessionStatus !== 'CONNECTED'}
                aria-pressed={!isMicMuted}
                aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                title={sessionStatus !== 'CONNECTED' ? 'Connect to control mic' : (isMicMuted ? 'Unmute mic' : 'Mute mic')}
              >
                <span className="relative inline-flex items-center justify-center h-full w-full">
                  {!isMicMuted && (
                    <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-40"></span>
                  )}
                  <span className="relative">{isMicMuted ? 'Unmute' : 'Mute'}</span>
                </span>
              </button>
              <button
                className={`flex-1 px-3 py-2 rounded-md text-sm ${activeTab === 'dashboard' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'}`}
                onClick={() => setActiveTab('dashboard')}
                aria-label="Dashboard"
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
      <VoiceOnboardingOverlay
        visible={showVoiceIntro}
        phase={voiceIntroPhase}
        status={sessionStatus}
        error={voiceIntroError}
        onSkip={handleSkipVoiceIntro}
        segments={voiceIntroSegments}
        greetingName={voiceIntroName}
        onToggleVoice={handleOverlayToggleVoice}
        voiceEnabled={isAudioPlaybackEnabled}
      />

      {/* Desktop Voice Dock */}
      <VoiceDock onToggleConnection={onToggleConnection} />
      {/* Consent modal removed; greet-and-consent handled by agent */}
    </div>
  );
}

export default App;

function ProfileMenu({ householdId, entitlements, household }: { householdId: string; entitlements: { plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string } | null; household: { email?: string; full_name?: string } | null }) {
  const [open, setOpen] = React.useState(false);
  const [showEdit, setShowEdit] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [fullName, setFullName] = React.useState(household?.full_name || '');
  const [email, setEmail] = React.useState(household?.email || '');
  const [authed, setAuthed] = React.useState(false);
  React.useEffect(() => { setFullName(household?.full_name || ''); setEmail(household?.email || ''); }, [household?.full_name, household?.email]);
  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#pp_profile_menu')) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);
  React.useEffect(() => {
    const supa = getSupabaseClient();
    if (!supa) { setAuthed(false); return; }
    (async () => {
      try { const { data } = await supa.auth.getSession(); setAuthed(!!data?.session); } catch { setAuthed(false); }
    })();
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => setAuthed(!!session));
    return () => { sub.subscription?.unsubscribe(); };
  }, []);

  const plan = entitlements?.plan || 'free';
  const managePlan = async () => {
    try {
      const res = await fetch('/api/billing/create-portal-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
      const j = await res.json();
      if (j?.url) window.location.href = j.url;
    } catch {}
  };
  const upgrade = async () => {
    try {
      const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email }) });
      const j = await res.json();
      if (j?.url) window.location.href = j.url;
    } catch {}
  };
  const openUserData = () => { try { window.dispatchEvent(new CustomEvent('pp:open_user_data')); } catch {} setOpen(false); };
  const copyHouseholdId = async () => { try { await navigator.clipboard.writeText(householdId); alert('Household ID copied'); } catch {} };
  const saveProfile = async () => {
    try {
      await fetch('/api/household/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email, full_name: fullName }) });
      setShowEdit(false);
    } catch {}
  };
  const deleteData = async () => {
    try {
      const res = await fetch('/api/household/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
      if (res.ok) {
        try { localStorage.removeItem('pp_household_id'); } catch {}
        window.location.href = '/home';
      }
    } catch {}
  };

  // Compute initials for avatar
  const initials = React.useMemo(() => {
    const name = (fullName || '').trim();
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    const mail = (email || '').trim();
    if (mail && mail.includes('@')) return mail[0].toUpperCase();
    return 'U';
  }, [fullName, email]);

  return (
    <div id="pp_profile_menu" className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="h-9 w-9 rounded-full border bg-gray-900 text-white flex items-center justify-center hover:opacity-90"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={fullName ? `Profile: ${fullName}` : (email ? `Profile: ${email}` : 'Profile')}
        title={fullName || email || 'Profile'}
      >
        <span className="text-[11px] font-semibold">{initials}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-sm font-medium text-foreground truncate">{fullName || 'Guest'}</div>
            <div className="text-xs text-muted truncate">{email || 'No email'}</div>
            <div className="text-[11px] text-muted mt-1">Plan: <b className={plan === 'premium' ? 'text-emerald-600' : 'text-foreground'}>{plan}</b></div>
          </div>
          <div className="py-1 text-sm">
            <button className="w-full text-left px-3 py-2 hover:opacity-90" onClick={() => { setShowEdit(true); setOpen(false); }}>Edit profile</button>
            <button className="w-full text-left px-3 py-2 hover:opacity-90" onClick={openUserData}>Review data</button>
            <button className="w-full text-left px-3 py-2 hover:opacity-90 text-red-600" onClick={() => { setShowDelete(true); setOpen(false); }}>Delete my data…</button>
            {plan === 'premium' ? (
              <button className="w-full text-left px-3 py-2 hover:opacity-90" onClick={managePlan}>Manage plan</button>
            ) : (
              <button className="w-full text-left px-3 py-2 hover:opacity-90" onClick={upgrade}>Upgrade to Premium</button>
            )}
            <a className="block px-3 py-2 hover:opacity-90" href="/feedback">Send feedback</a>
            <a className="block px-3 py-2 hover:opacity-90" href="/contact">Contact us</a>
            <a className="block px-3 py-2 hover:opacity-90" href="/terms" target="_blank" rel="noreferrer">Terms</a>
            <a className="block px-3 py-2 hover:opacity-90" href="/privacy" target="_blank" rel="noreferrer">Privacy</a>
            {!authed ? (
              <a className="block px-3 py-2 hover:opacity-90" href="/login" onClick={() => setOpen(false)}>Sign in</a>
            ) : (
              <button
                className="w-full text-left px-3 py-2 hover:opacity-90"
                onClick={async () => { try { await getSupabaseClient()?.auth.signOut(); } catch {}; setOpen(false); }}
              >
                Log out
              </button>
            )}
          </div>
          <div className="px-3 py-2 border-t border-border flex items-center justify-between">
            <div className="text-[11px] text-muted truncate">ID: {householdId?.slice(0, 6)}…</div>
            <button className="text-xs px-2 py-1 rounded border border-border bg-card hover:opacity-90" onClick={copyHouseholdId}>Copy</button>
          </div>
        </div>
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium text-foreground mb-2">Edit profile</div>
            <label className="block text-xs text-muted">Full name</label>
            <input className="w-full border rounded px-3 py-2 text-sm mb-2" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            <label className="block text-xs text-muted">Email</label>
            <input className="w-full border rounded px-3 py-2 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            <div className="mt-3 flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border border-border bg-card hover:opacity-90" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="text-xs px-3 py-1.5 rounded border bg-gray-900 text-white hover:bg-gray-800" onClick={saveProfile}>Save</button>
            </div>
          </div>
        </div>
      )}

      {showDelete && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setShowDelete(false)}>
          <div className="bg-card rounded-lg border border-border shadow-lg w-full max-w-sm p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium text-foreground mb-2">Delete my data</div>
            <p className="text-xs text-muted">
              This will permanently delete your household, snapshots, actions, and net-worth history from Prosper.
            </p>
            <p className="text-xs text-muted mt-2">This cannot be undone.</p>
            <div className="mt-3 flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border border-border bg-card hover:opacity-90" onClick={() => setShowDelete(false)}>Cancel</button>
              <button className="text-xs px-3 py-1.5 rounded border bg-red-600 text-white hover:bg-red-700" onClick={deleteData}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

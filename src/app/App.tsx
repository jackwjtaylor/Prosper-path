"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import Image from "next/image";
import Link from "next/link";

import Transcript from "./components/Transcript";
import Dashboard from "./components/Dashboard";
import LeftPaneControls from "./components/LeftPaneControls";
import ChatPanel from "./components/ChatPanel";
import VoiceDock from "./components/VoiceDock";
import ThemeToggle from "./components/ThemeToggle";

import { SessionStatus } from "@/app/types";
import type { RealtimeAgent } from "@openai/agents/realtime";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { createModerationGuardrail } from "@/app/agentConfigs/guardrails";

import { allAgentSets, defaultAgentSetKey } from "@/app/agentConfigs";
import { realtimeOnlyCompanyName, makeRealtimeAgent } from "@/app/agentConfigs/realtimeOnly";

import useAudioDownload from "./hooks/useAudioDownload";
import { useHandleSessionHistory } from "./hooks/useHandleSessionHistory";
import { ensureHouseholdId } from "@/app/lib/householdLocal";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { useAppStore } from "@/app/state/store";
import { hapticToggle } from "@/app/lib/haptics";

const sdkScenarioMap: Record<string, RealtimeAgent[]> = allAgentSets;

function App() {
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

  const [selectedAgentConfigSet, setSelectedAgentConfigSet] = useState<RealtimeAgent[] | null>(null);

  const [householdId, setHouseholdId] = useState<string>("");
  // Track auth state locally only where needed in ProfileMenu
  const [isReturningUser, setIsReturningUser] = useState<boolean>(false);
  const [entitlements, setEntitlements] = useState<{ plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string } | null>(null);
  const [usage, setUsage] = useState<{ free_limit?: number; used?: number; remaining?: number } | null>(null);
  const [isUserDataOpen, setIsUserDataOpen] = useState<boolean>(false);
  const [missingRequiredCount, setMissingRequiredCount] = useState<number>(0);
  const [householdInfo, setHouseholdInfo] = useState<{ email?: string; full_name?: string } | null>(null);
  useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);
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
  });
  const [userText, setUserText] = useState<string>("");

  const { startRecording, stopRecording } = useAudioDownload();

  const sendClientEvent = (eventObj: any, eventNameSuffix = "") => {
    try {
      sendEvent(eventObj);
      logClientEvent(eventObj, eventNameSuffix);
    } catch (err) {
      console.error('Failed to send via SDK', err);
    }
  };

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
          if (i === 0) return makeRealtimeAgent(selectedVoice || 'sage');
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

  return (
    <div className="text-base flex flex-col h-screen bg-app text-foreground">
      {/* Header */}
      <div className="p-5 text-lg font-semibold flex justify-between items-center max-w-7xl mx-auto w-full relative border-b border-border bg-card backdrop-blur">
        <Link href="/home" className="flex items-center">
          <Image src="2D76K394.eps.svg" alt="Prosper Logo" width={20} height={20} className="mr-2" />
          <span>Prosper AI <span className="text-gray-400">your personal wealth coach</span></span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link
            href="/feedback"
            className="h-8 px-3 inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 text-xs shadow-sm"
          >
            Give Feedback
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          {/* Free uses chip (non-premium only) */}
          {entitlements?.plan !== 'premium' && typeof usage?.remaining === 'number' && (
            <div
              className={`text-xs shrink-0 ${Math.max(0, Number(usage?.remaining ?? 0)) <= 3 ? 'text-red-600' : 'text-gray-600'}`}
              title="Free uses remaining"
            >
              Free uses left: <b>{Math.max(0, Number(usage?.remaining ?? 0))}</b>
            </div>
          )}

          {/* My Data / Dashboard toggle (same size as Upgrade) */}
          <button
            type="button"
            className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:opacity-90 text-xs shadow-sm shrink-0"
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
              className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border border-border bg-card hover:opacity-90 text-xs shadow-sm"
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
              className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-gray-900 text-white hover:bg-gray-800 text-xs shadow-sm"
            >
              Upgrade
            </button>
          )}

          <ThemeToggle />
          <ProfileMenu
            householdId={householdId}
            entitlements={entitlements}
            household={householdInfo}
          />
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

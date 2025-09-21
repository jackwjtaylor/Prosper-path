"use client";

import React from "react";
import { SessionStatus } from "@/app/types";

export type VoiceOnboardingPhase =
  | "idle"
  | "requesting"
  | "connecting"
  | "listening"
  | "engaged"
  | "error";

type Props = {
  visible: boolean;
  phase: VoiceOnboardingPhase;
  status: SessionStatus;
  error?: string | null;
  onSkip: () => void;
  segments?: Array<{ speaker: 'assistant' | 'user'; text: string }>;
  greetingName?: string;
  onToggleVoice: () => void;
  voiceEnabled: boolean;
};

const phaseCopy: Record<VoiceOnboardingPhase, { label: string; tone: "neutral" | "active" | "success" | "error" }> = {
  idle: { label: "Preparing your session…", tone: "neutral" },
  requesting: { label: "Please allow microphone access to continue", tone: "neutral" },
  connecting: { label: "Connecting you...", tone: "active" },
  listening: { label: "Listening", tone: "success" },
  engaged: { label: "Connected", tone: "success" },
  error: { label: "We couldn't access your microphone", tone: "error" },
};

function StatusDot({ phase }: { phase: VoiceOnboardingPhase }) {
  const tone = phaseCopy[phase].tone;
  const base = "h-3 w-3 rounded-full transition-all duration-600 ease-out";
  if (tone === "error") {
    return <span className={`${base} bg-red-400`} />;
  }
  if (tone === "success") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className={`${base} bg-emerald-300/60 animate-ping absolute opacity-50`} />
        <span className={`${base} bg-emerald-300 relative shadow-[0_0_15px_rgba(16,185,129,0.4)]`} />
      </span>
    );
  }
  if (tone === "active") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className={`${base} bg-[#EFEEEB]/60 animate-pulse absolute opacity-50`} />
        <span className={`${base} bg-[#EFEEEB]/80 relative`} />
      </span>
    );
  }
  return <span className={`${base} bg-[#EFEEEB]/60`} />;
}

function TypewriterText({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = React.useState<string>("");
  const displayRef = React.useRef<string>("");

  const setDisplayState = React.useCallback((value: string) => {
    displayRef.current = value;
    setDisplay(value);
  }, []);

  React.useEffect(() => {
    if (!text) {
      setDisplayState("");
      return;
    }

    const current = displayRef.current;
    if (text === current) return;

    if (text.length <= current.length) {
      setDisplayState(text);
      return;
    }

    const isIncremental = text.startsWith(current);
    const base = isIncremental ? current : "";
    const remainder = text.slice(base.length);

    if (!remainder) {
      setDisplayState(text);
      return;
    }

    let i = 0;
    setDisplayState(base);
    const interval = window.setInterval(() => {
      i += 1;
      setDisplayState(base + remainder.slice(0, i));
      if (i >= remainder.length) {
        window.clearInterval(interval);
      }
    }, 18);

    return () => window.clearInterval(interval);
  }, [text, setDisplayState]);

  if (!text && !display) return null;
  return (
    <p className={className ?? "max-w-[min(420px,88vw)] text-sm md:text-base leading-relaxed text-[#EFEEEB]/80 font-medium"}>
      <span className="whitespace-pre-wrap">{display}</span>
      {display && <span className="inline-block w-2 animate-pulse">▋</span>}
    </p>
  );
}

export default function VoiceOnboardingOverlay({ visible, phase, status, error, onSkip, segments, greetingName, onToggleVoice, voiceEnabled }: Props) {
  const copy = phaseCopy[phase];
  const heading = greetingName ? `Hey ${greetingName}` : "Hey there...";
  const lastAssistantIndex = React.useMemo(() => {
    if (!segments?.length) return -1;
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      if (segments[i].speaker === 'assistant') return i;
    }
    return -1;
  }, [segments]);
  const transcriptRef = React.useRef<HTMLDivElement | null>(null);
  const serializedSegments = React.useMemo(
    () => (segments?.map((segment) => `${segment.speaker}:${segment.text}`).join('|') ?? ''),
    [segments]
  );

  React.useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    });
  }, [serializedSegments]);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[70] overflow-hidden transition-opacity duration-500 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <video
        className="absolute inset-0 h-full w-full object-cover blur-lg scale-110"
        src="/landing.mp4"
        poster="/og.png"
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-[#041613]/70" />
      <div className="relative z-10 flex min-h-full flex-col items-center justify-center gap-8 px-6 text-center text-[#EFEEEB]">
        <img src="/prosper_wordmark_offwhite.svg" alt="Prosper" className="h-12 w-auto md:h-14" />
        <div className="flex flex-col items-center gap-4 max-w-xl">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight transition-all duration-500">
            {heading}
          </h2>
          {phase === 'requesting' && (
            <p className="text-base md:text-lg text-[#EFEEEB]/80">
              If you're able to talk, please allow your mic.
            </p>
          )}
        </div>
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 text-sm md:text-base text-[#EFEEEB]/80">
            <StatusDot phase={phase} />
            <span>{copy.label}</span>
          </div>
          {error && (
            <p className="text-sm text-red-300 max-w-sm">
              {error}
            </p>
          )}
        </div>
        {segments?.length ? (
          <div className="mt-2 flex w-full max-w-[min(460px,90vw)] flex-col items-center text-left text-[#EFEEEB]/80">
            <div className="relative w-full overflow-hidden rounded-xl bg-[#041613]/40">
              <div ref={transcriptRef} className="flex max-h-[140px] md:max-h-[180px] flex-col gap-3 overflow-y-auto px-5 py-4">
                {segments.map((segment, index) => {
                  const isAssistant = segment.speaker === 'assistant';
                  const isAnimated = isAssistant && index === lastAssistantIndex;
                  return (
                    <div key={`${segment.speaker}-${index}`} className="w-full">
                      <span className="block text-[10px] uppercase tracking-[0.3em] text-[#EFEEEB]/50">
                        {isAssistant ? 'Prosper' : 'You'}
                      </span>
                      {isAnimated ? (
                        <TypewriterText text={segment.text} className="max-w-full text-sm md:text-base leading-relaxed text-[#EFEEEB]/90" />
                      ) : (
                        <p className="max-w-full text-sm md:text-base leading-relaxed text-[#EFEEEB]/70 whitespace-pre-wrap">
                          {segment.text}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggleVoice}
          className="inline-flex items-center gap-2 rounded-full border border-[#EFEEEB]/40 bg-transparent px-5 py-2 text-xs md:text-sm font-medium text-[#EFEEEB]/80 hover:bg-[#EFEEEB]/10"
        >
          {voiceEnabled ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#EFEEEB"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
            >
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="#EFEEEB"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="opacity-90"
            >
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
              <path d="M4 4l16 16" />
            </svg>
          )}
          {voiceEnabled ? 'Mute' : 'Unmute'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="text-sm md:text-base text-[#EFEEEB]/70 underline-offset-4 hover:underline"
        >
          Prefer to type instead?
        </button>
      </div>
    </div>
  );
}

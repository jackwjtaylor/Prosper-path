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
  onContinue: () => void;
  canContinue: boolean;
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
  const base = "h-3 w-3 rounded-full";
  if (tone === "error") {
    return <span className={`${base} bg-red-400`} />;
  }
  if (tone === "success") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className={`${base} bg-emerald-300 animate-ping absolute opacity-60`} />
        <span className={`${base} bg-emerald-300 relative`} />
      </span>
    );
  }
  if (tone === "active") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className={`${base} bg-[#EFEEEB]/70 animate-pulse absolute opacity-50`} />
        <span className={`${base} bg-[#EFEEEB]/80 relative`} />
      </span>
    );
  }
  return <span className={`${base} bg-[#EFEEEB]/60`} />;
}

export default function VoiceOnboardingOverlay({ visible, phase, status, error, onSkip, onContinue, canContinue }: Props) {
  const copy = phaseCopy[phase];

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[70] transition-opacity duration-500 ease-out ${
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      <video
        className="absolute inset-0 h-full w-full object-cover blur-lg"
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
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Hey there...</h2>
          <p className="text-base md:text-lg text-[#EFEEEB]/80">
            If you're able to talk, please allow your mic.
          </p>
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
        <button
          type="button"
          onClick={onSkip}
          className="text-sm md:text-base text-[#EFEEEB]/70 underline-offset-4 hover:underline"
        >
          Prefer to type instead?
        </button>
        {canContinue && (
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center justify-center rounded-full bg-[#EFEEEB] px-8 py-3 text-sm font-semibold text-[#083630] shadow-sm transition hover:opacity-90"
          >
            Continue to Prosper workspace
          </button>
        )}
      </div>
    </div>
  );
}

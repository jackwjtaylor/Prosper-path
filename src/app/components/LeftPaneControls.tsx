"use client";
import React from "react";
import { SessionStatus } from "@/app/types";

interface LeftPaneControlsProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;

  isPTTActive: boolean;
  setIsPTTActive: (v: boolean) => void;
  isPTTUserSpeaking: boolean;
  handleTalkButtonDown: () => void;
  handleTalkButtonUp: () => void;

  isAudioPlaybackEnabled: boolean;
  setIsAudioPlaybackEnabled: (v: boolean) => void;

  codec: string;
  onCodecChange: (codec: string) => void;
}

/**
 * Polished compact toolbar that sits above the transcript.
 * - Sticky, blurred, and responsive
 * - Keeps the dashboard untouched
 */
export default function LeftPaneControls({
  sessionStatus,
  onToggleConnection,
  isPTTActive,
  setIsPTTActive,
  isPTTUserSpeaking,
  handleTalkButtonDown,
  handleTalkButtonUp,
  isAudioPlaybackEnabled,
  setIsAudioPlaybackEnabled,
  codec,
  onCodecChange,
}: LeftPaneControlsProps) {
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";

  return (
    <div className="sticky top-0 z-10">
      <div className="backdrop-blur bg-prosper-neutral-background/80 border border-prosper-neutral-divider rounded-xl px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onToggleConnection}
            disabled={isConnecting}
            className={`px-3 h-9 rounded-lg text-sm font-medium shadow-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-prosper-neutral-background ${
              isConnected
                ? "bg-prosper-semantic-error text-white border-prosper-semantic-error hover:bg-prosper-semantic-error/90 focus:ring-prosper-semantic-error/40"
                : isConnecting
                ? "bg-prosper-neutral-divider text-prosper-neutral-text border-prosper-neutral-divider cursor-wait"
                : "bg-prosper-green-main text-white border-prosper-green-main hover:bg-prosper-green-dark focus:ring-prosper-green-light"
            }`}
            aria-pressed={isConnected}
          >
            {isConnected ? "Disconnect" : isConnecting ? "Connecting…" : "Connect"}
          </button>

          {/* PTT toggle + hold-to-talk */}
          <label className="inline-flex items-center gap-2 text-sm select-none text-prosper-neutral-text">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={isPTTActive}
              onChange={(e) => setIsPTTActive(e.target.checked)}
              disabled={!isConnected}
            />
            <span>Push to talk</span>
          </label>

          <button
            type="button"
            onMouseDown={handleTalkButtonDown}
            onMouseUp={handleTalkButtonUp}
            onTouchStart={handleTalkButtonDown}
            onTouchEnd={handleTalkButtonUp}
            disabled={!isConnected || !isPTTActive}
            aria-label="Hold to talk"
            className={`h-9 px-3 rounded-lg border text-sm transition-colors ${
              !isConnected || !isPTTActive
                ? "bg-prosper-neutral-background text-prosper-neutral-divider cursor-not-allowed border-prosper-neutral-divider"
                : isPTTUserSpeaking
                ? "bg-prosper-neutral-divider border-prosper-neutral-divider"
                : "bg-white hover:bg-prosper-neutral-background border-prosper-neutral-divider"
            }`}
          >
            {isPTTUserSpeaking ? "Release to send" : "Talk"}
          </button>

          {/* Audio playback */}
          <label className="inline-flex items-center gap-2 text-sm select-none text-prosper-neutral-text">
            <input
              type="checkbox"
              className="h-4 w-4 rounded"
              checked={isAudioPlaybackEnabled}
              onChange={(e) => setIsAudioPlaybackEnabled(e.target.checked)}
              disabled={!isConnected}
            />
            <span>Audio playback</span>
          </label>

          {/* Codec selector */}
          <div className="ml-auto inline-flex items-center gap-2 text-sm">
            <label htmlFor="codec-select" className="text-prosper-neutral-text">Codec</label>
            <select
              id="codec-select"
              className="h-9 rounded-lg border border-prosper-neutral-divider bg-white px-2 text-sm"
              value={codec}
              onChange={(e) => onCodecChange(e.target.value)}
            >
              <option value="opus">Opus</option>
              <option value="pcm">PCM</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

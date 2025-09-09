"use client";
import React from "react";
import { useAppStore } from "@/app/state/store";

type VoiceDockProps = {
  onToggleConnection: () => void;
};

/**
 * Bottom-right floating voice dock: connection state + mic toggle.
 * Hidden on small screens (mobile has its own nav).
 */
export default function VoiceDock({ onToggleConnection }: VoiceDockProps) {
  const sessionStatus = useAppStore(s => s.sessionStatus);
  const isMicMuted = useAppStore(s => s.isMicMuted);
  const setIsMicMuted = useAppStore(s => s.setIsMicMuted);
  const connected = sessionStatus === "CONNECTED";
  const connecting = sessionStatus === "CONNECTING";

  return (
    <div className="hidden lg:block fixed bottom-4 right-4 z-40">
      <div className="card-surface shadow-sm p-2 pl-3 flex items-center gap-2">
        <div className="text-xs ink-muted mr-1">{connecting ? 'Connecting…' : connected ? 'Listening' : 'Disconnected'}</div>
        <button
          onClick={onToggleConnection}
          disabled={connecting}
          className={`h-8 px-3 rounded-md text-xs font-medium border shadow-sm ${
            connected
              ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
              : connecting
              ? 'bg-gray-300 text-gray-700 border-gray-300 cursor-wait'
              : 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800'
          }`}
        >
          {connected ? 'Disconnect' : connecting ? 'Connecting…' : 'Connect'}
        </button>
        <button
          onClick={() => connected && setIsMicMuted(!isMicMuted)}
          disabled={!connected}
          aria-pressed={isMicMuted}
          aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`relative h-8 w-8 rounded-full border flex items-center justify-center ${
            !connected
              ? 'bg-gray-100 text-gray-400'
              : isMicMuted
              ? 'bg-red-600 text-white border-red-600'
              : 'bg-emerald-600 text-white border-emerald-600'
          }`}
        >
          {!isMicMuted && connected && (
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-40"></span>
          )}
          <span className="relative text-[10px]">{isMicMuted ? 'M' : 'Mic'}</span>
        </button>
      </div>
    </div>
  );
}


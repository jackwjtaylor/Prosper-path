"use client";

import React from "react";
import Transcript from "./Transcript";
import { useAppStore } from "@/app/state/store";
import { SessionStatus } from "@/app/types";
import { hapticToggle } from "@/app/lib/haptics";

type ChatPanelProps = {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  onToggleConnection: () => void;
};

export default function ChatPanel({ userText, setUserText, onSendMessage, onToggleConnection }: ChatPanelProps) {
  const sessionStatus = useAppStore(s => s.sessionStatus);
  const isConnected = sessionStatus === "CONNECTED";
  const isConnecting = sessionStatus === "CONNECTING";
  const isMicMuted = useAppStore(s => s.isMicMuted);
  const setIsMicMuted = useAppStore(s => s.setIsMicMuted);

  return (
    <div className="min-w-0 flex flex-col gap-3 h-full min-h-0">
      {/* Integrated header: connection + mic status */}
      <div className="sticky top-0 z-10">
        <div className="backdrop-blur bg-white/80 border rounded-xl px-3 py-2 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onToggleConnection}
              disabled={isConnecting}
              className={`px-3 h-9 rounded-lg text-sm font-medium shadow-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isConnected
                  ? "bg-red-600 text-white border-red-600 hover:bg-red-700 focus:ring-red-300"
                  : isConnecting
                  ? "bg-gray-300 text-gray-700 border-gray-300 cursor-wait"
                  : "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 focus:ring-gray-300"
              }`}
              aria-pressed={isConnected}
            >
              {isConnected ? "Disconnect" : isConnecting ? "Connecting…" : "Connect"}
            </button>

            {/* Mic mute/unmute */}
            <button
              type="button"
              onClick={() => { if (isConnected) { setIsMicMuted(!isMicMuted); hapticToggle(!isMicMuted); } }}
              disabled={!isConnected}
              aria-pressed={isMicMuted}
              className={`h-9 px-4 rounded-lg text-sm font-medium border shadow-sm transition-colors ${
                !isConnected
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : isMicMuted
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
              }`}
              title={isMicMuted ? 'Unmute mic' : 'Mute mic'}
            >
              {isMicMuted ? 'Unmute' : 'Mute'}
            </button>

            {/* Mic state chip */}
            <div className="inline-flex items-center gap-2 text-xs select-none px-2 py-1 rounded-full border bg-white">
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isMicMuted ? 'bg-red-600' : 'bg-emerald-500'}`}>
                {!isMicMuted && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50"></span>
                )}
              </span>
              <span>{isMicMuted ? 'Muted' : 'Listening'}</span>
            </div>

            <div className="ml-auto" />
          </div>
        </div>
      </div>

      {/* Transcript area */}
      <Transcript
        userText={userText}
        setUserText={setUserText}
        onSendMessage={onSendMessage}
        canSend={sessionStatus === ("CONNECTED" as SessionStatus)}
      />
    </div>
  );
}


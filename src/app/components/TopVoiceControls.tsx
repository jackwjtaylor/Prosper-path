"use client";
import React from "react";
import { useAppStore } from "@/app/state/store";

export default function TopVoiceControls() {
  const sessionStatus = useAppStore(s => s.sessionStatus);
  const isMicMuted = useAppStore(s => s.isMicMuted);
  const setIsMicMuted = useAppStore(s => s.setIsMicMuted);
  const isTranscriptVisible = useAppStore(s => s.isTranscriptVisible);
  const setIsTranscriptVisible = useAppStore(s => s.setIsTranscriptVisible);

  const connected = sessionStatus === "CONNECTED";
  const connecting = sessionStatus === "CONNECTING";

  const toggleConnection = () => {
    try { window.dispatchEvent(new CustomEvent('pp:toggle_connection')); } catch {}
  };

  const sendPrompt = (text: string) => {
    try { window.dispatchEvent(new CustomEvent('pp:send_chat', { detail: { text } })); } catch {}
  };

  return (
    <div className="w-full flex items-center justify-center mb-4">
      <div className="bg-card rounded-3xl shadow-md px-5 py-4 md:px-8 md:py-6 w-full">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="min-w-0">
              <div className="text-2xl font-semibold text-foreground">Talk to Prosper</div>
              <div className="card-meta mt-1">Your voice‑powered money coach</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleConnection}
                disabled={connecting}
                className={`h-10 px-4 rounded-md text-sm font-medium border shadow-sm ${
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
                type="button"
                onClick={() => connected && setIsMicMuted(!isMicMuted)}
                disabled={!connected}
                aria-pressed={!isMicMuted}
                aria-label={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                title={connected ? (isMicMuted ? 'Unmute mic' : 'Mute mic') : 'Connect to enable mic'}
                className={`relative h-12 w-12 rounded-full border flex items-center justify-center transition-colors ${
                  !connected
                    ? 'bg-gray-200 text-gray-400 border-gray-200'
                    : isMicMuted
                    ? 'bg-red-600 text-white border-red-600'
                    : 'bg-emerald-600 text-white border-emerald-600'
                }`}
              >
                {!isMicMuted && connected && (
                  <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-30"></span>
                )}
                <span className="relative font-semibold text-xs">{isMicMuted ? 'Muted' : 'Mic'}</span>
              </button>
              <button
                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                aria-pressed={isTranscriptVisible}
                className="h-10 px-3 rounded-md text-xs font-medium border shadow-sm bg-card"
                title={isTranscriptVisible ? 'Hide transcript' : 'Show transcript'}
              >
                {isTranscriptVisible ? 'Hide transcript' : 'Show transcript'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            {/* Animated bars (visualizer) */}
            <div className="flex items-end gap-1 h-10" aria-hidden="true">
              {[0,1,2,3,4,5,6].map(i => (
                <span
                  key={i}
                  className={`inline-block w-1.5 rounded ${connected && !isMicMuted ? 'bg-emerald-600 animate-[vbar_900ms_ease-in-out_infinite]' : 'bg-gray-400 opacity-40'}`}
                  style={{ height: connected && !isMicMuted ? `${8 + (i%4)*10}px` : '6px', animationDelay: `${i*80}ms` }}
                />
              ))}
              <style jsx global>{`
                @keyframes vbar { 0%,100%{ transform: scaleY(0.6);} 50%{ transform: scaleY(1.8);} }
              `}</style>
            </div>
            {/* Sample prompts */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="card-meta mr-1">Try saying:</span>
              {[
                "What’s my net worth trend?",
                "How can I boost my cash buffer?",
                "Plan my next money moves",
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => sendPrompt(t)}
                  className="text-xs px-2.5 py-1 rounded-full border bg-card hover:opacity-90"
                  title={`Send: ${t}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="card-meta mt-2">
            {connecting ? 'Connecting…' : connected ? (isMicMuted ? 'Connected — mic muted' : 'Listening — say “Hey Prosper”') : 'Disconnected'}
          </div>
        </div>
      </div>
    </div>
  );
}

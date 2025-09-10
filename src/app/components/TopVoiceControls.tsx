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
      <div className="panel-contrast shadow-md px-5 py-4 md:px-8 md:py-6 w-full">
        <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_320px] gap-4 items-center">
          {/* Left: heading + controls */}
          <div className="min-w-0">
            <div className="text-2xl font-semibold text-white">Talk to Prosper</div>
            <div className="text-white/80 text-sm mt-1">Your voice‑powered money coach</div>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <button
                onClick={toggleConnection}
                disabled={connecting}
                className={`h-10 px-4 rounded-md text-sm font-medium border shadow-sm ${connected
                  ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
                  : connecting
                  ? 'bg-gray-300 text-gray-700 border-gray-300 cursor-wait'
                  : 'bg-white text-gray-900 border-white hover:opacity-95'}`}
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
                className={`relative h-12 w-12 rounded-full border flex items-center justify-center transition-colors ${!connected
                  ? 'bg-white/20 text-white/70 border-white/20'
                  : isMicMuted
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-emerald-600 text-white border-emerald-600'}`}
              >
                {!isMicMuted && connected && <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-30"></span>}
                <span className="relative font-semibold text-xs">{isMicMuted ? 'Muted' : 'Mic'}</span>
              </button>
              <button
                onClick={() => setIsTranscriptVisible(!isTranscriptVisible)}
                aria-pressed={isTranscriptVisible}
                className="h-10 px-3 rounded-md text-xs font-medium border shadow-sm bg-white text-gray-900"
                title={isTranscriptVisible ? 'Hide transcript' : 'Show transcript'}
              >
                {isTranscriptVisible ? 'Hide transcript' : 'Show transcript'}
              </button>
            </div>
            {/* Animated bars (visualizer) */}
            <div className="mt-3 flex items-end gap-1 h-10" aria-hidden="true">
              {[0,1,2,3,4,5,6].map(i => (
                <span
                  key={i}
                  className={`inline-block w-1.5 rounded ${connected && !isMicMuted ? 'bg-white animate-[vbar_900ms_ease-in-out_infinite]' : 'bg-white/40'}`}
                  style={{ height: connected && !isMicMuted ? `${8 + (i%4)*10}px` : '6px', animationDelay: `${i*80}ms` }}
                />
              ))}
              <style jsx global>{`
                @keyframes vbar { 0%,100%{ transform: scaleY(0.6);} 50%{ transform: scaleY(1.8);} }
              `}</style>
            </div>
            {/* Sample prompts */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-xs mr-1">Try saying:</span>
              {["What’s my net worth trend?","How can I boost my cash buffer?","Plan my next money moves"].map((t) => (
                <button key={t} onClick={() => sendPrompt(t)} className="text-xs px-2.5 py-1 rounded-full border border-white/30 text-white hover:bg-white/10" title={`Send: ${t}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="text-white/80 text-xs mt-2">
              {connecting ? 'Connecting…' : connected ? (isMicMuted ? 'Connected — mic muted' : 'Listening — say “Hey Prosper”') : 'Disconnected'}
            </div>
          </div>

          {/* Right: video avatar placeholder */}
          <div className="hidden md:block">
            <div className="rounded-xl bg-tealdeep/70 border border-white/20 aspect-video overflow-hidden relative flex items-center justify-center">
              <div className="absolute top-2 right-2 text-white/70 text-[10px] bg-black/30 rounded px-2 py-0.5">Avatar</div>
              <div className="flex items-center justify-center">
                <div className="h-20 w-20 rounded-full bg-white/20 border border-white/30" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

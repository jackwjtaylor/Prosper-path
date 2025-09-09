"use client";

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TranscriptItem } from "@/app/types";
import Image from "next/image";
import { useTranscript } from "@/app/contexts/TranscriptContext";
import { GuardrailChip } from "./GuardrailChip";

export interface TranscriptProps {
  userText: string;
  setUserText: (val: string) => void;
  onSendMessage: () => void;
  canSend: boolean;
}

function Transcript({
  userText,
  setUserText,
  onSendMessage,
  canSend,
}: TranscriptProps) {
  const { transcriptItems, toggleTranscriptItemExpand } = useTranscript();
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const [prevLogs, setPrevLogs] = useState<TranscriptItem[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function scrollToBottom() {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }

  useEffect(() => {
    const hasNewMessage = transcriptItems.length > prevLogs.length;
    const hasUpdatedMessage = transcriptItems.some((newItem, index) => {
      const oldItem = prevLogs[index];
      return (
        oldItem &&
        (newItem.title !== oldItem.title || newItem.data !== oldItem.data)
      );
    });

    if (hasNewMessage || hasUpdatedMessage) scrollToBottom();
    setPrevLogs(transcriptItems);
  }, [transcriptItems]);

  useEffect(() => {
    if (canSend && inputRef.current) inputRef.current.focus();
  }, [canSend]);

  return (
    <div className="flex flex-col flex-1 bg-card min-h-0 rounded-xl">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between px-4 py-2 sticky top-0 z-10 text-base border-b border-border bg-card rounded-t-xl">
          <span className="font-semibold flex items-center gap-2">
  <span className="relative inline-flex items-center justify-center">
    {canSend ? (
      <>
        <span className="animate-ping absolute inline-flex h-5 w-5 rounded-full bg-emerald-400 opacity-50"></span>
        <span className="relative inline-flex rounded-full h-5 w-5 bg-emerald-500"></span>
      </>
    ) : (
      <span className="relative inline-flex rounded-full h-5 w-5 bg-gray-300"></span>
    )}
  </span>
  Transcript
</span>
          <div />
        </div>

        {/* Scrollable transcript content */}
        <div
          ref={transcriptRef}
          data-test-transcript-frame
          className="flex-1 min-h-0 overflow-auto p-4 flex flex-col gap-y-4"
        >
          {[...transcriptItems]
            .sort((a, b) => a.createdAtMs - b.createdAtMs)
            .map((item) => {
              const {
                itemId,
                type,
                role,
                data,
                expanded,
                timestamp,
                title = "",
                isHidden,
                guardrailResult,
              } = item;

              if (isHidden) return null;

              if (type === "MESSAGE") {
                const isUser = role === "user";
                const containerClasses = `flex justify-end flex-col ${isUser ? "items-end" : "items-start"}`;
                const bubbleBase = `max-w-lg p-3 ${isUser ? "bg-gray-900 text-gray-100" : "bg-white border border-border text-foreground"}`;
                const isBracketedMessage = title.startsWith("[") && title.endsWith("]");
                const messageStyle = isBracketedMessage ? "italic text-gray-400" : "";
                const displayTitle = isBracketedMessage ? title.slice(1, -1) : title;

                return (
                  <div key={itemId} className={containerClasses}>
                    <div className="max-w-lg">
                      <div className={`${bubbleBase} rounded-t-xl ${guardrailResult ? "" : "rounded-b-xl"}`}>
                        <div className={`text-xs ${isUser ? "text-gray-400" : "text-gray-500"} font-mono`}>{timestamp}</div>
                        <div className={`whitespace-pre-wrap ${messageStyle}`}>
                          <ReactMarkdown>{displayTitle}</ReactMarkdown>
                        </div>
                      </div>
                      {guardrailResult && (
                        <div className="bg-gray-200 px-3 py-2 rounded-b-xl">
                          <GuardrailChip guardrailResult={guardrailResult} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              } else if (type === "BREADCRUMB") {
                const hasData = !!data;
                if (!hasData) {
                  // Friendly status line (no JSON payload for users)
                  return (
                    <div key={itemId} className="flex items-center text-gray-600 text-sm">
                      <span>{title}</span>
                    </div>
                  );
                }
                // Developer breadcrumbs with expandable JSON payload
                return (
                  <div key={itemId} className="flex flex-col justify-start items-start text-gray-500 text-sm">
                    <span className="text-xs font-mono">{timestamp}</span>
                    <div
                      className={`whitespace-pre-wrap flex items-center font-mono text-sm text-gray-800 ${data ? "cursor-pointer" : ""}`}
                      onClick={() => data && toggleTranscriptItemExpand(itemId)}
                    >
                      {data && (
                        <span
                          className={`text-gray-400 mr-1 transform transition-transform duration-200 select-none font-mono ${
                            expanded ? "rotate-90" : "rotate-0"
                          }`}
                        >
                          ▶
                        </span>
                      )}
                      {title}
                    </div>
                    {expanded && data && (
                      <div className="text-gray-800 text-left">
                        <pre className="border-l-2 ml-1 border-gray-200 whitespace-pre-wrap break-words font-mono text-xs mb-2 mt-2 pl-2">
                          {JSON.stringify(data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              } else {
                return (
                  <div key={itemId} className="flex justify-center text-gray-500 text-sm italic font-mono">
                    Unknown item type: {type} <span className="ml-2 text-xs">{timestamp}</span>
                  </div>
                );
              }
            })}
        </div>
      </div>

      <div className="p-4 flex items-center gap-x-2 flex-shrink-0 border-t border-border bg-card rounded-b-xl">
        <input
          ref={inputRef}
          type="text"
          value={userText}
          onChange={(e) => setUserText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSend) onSendMessage();
          }}
          className="flex-1 px-4 py-2 focus:outline-none"
          placeholder="Type a message..."
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || !userText.trim()}
          className="bg-gray-900 text-white rounded-full px-2 py-2 disabled:opacity-50"
        >
          <Image src="arrow.svg" alt="Send" width={24} height={24} />
        </button>
      </div>
    </div>
  );
}

export default Transcript;

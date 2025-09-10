"use client";
import React from "react";

type ActionCardProps = {
  title: string;
  why?: string;
  steps?: string[];
  recommended?: boolean;
  completed?: boolean;
  onOpenChat?: () => void;
  onDone?: () => void;
  onDismiss?: () => void;
};

export default function ActionCard({ title, why, steps, recommended, completed, onOpenChat, onDone, onDismiss }: ActionCardProps) {
  return (
    <div className={`border border-border rounded-md p-2 bg-card`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate text-foreground`}>
            {title}{' '}
            {recommended ? (
              <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">Recommended</span>
            ) : null}
            {completed ? (
              <span className="ml-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Completed</span>
            ) : null}
          </div>
          {why && <div className="text-[11px] mt-0.5 ink-muted">{why}</div>}
          {steps && steps.length > 0 && (
            <div className="text-[11px] text-foreground mt-1">
              <ul className="list-disc pl-4 space-y-0.5">
                {steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-1">
          {!completed ? (
            <>
              {onOpenChat && (
                <button className="text-xs px-2 py-1 rounded border bg-card hover:bg-white" onClick={onOpenChat}>Explain</button>
              )}
              {onDone && (
                <button className="text-xs px-2 py-1 rounded border bg-card hover:bg-white" onClick={onDone}>Mark done</button>
              )}
              {/* Remove button intentionally omitted */}
            </>
          ) : (
            onOpenChat ? (
              <button className="text-xs px-2 py-1 rounded border bg-card hover:bg-white" onClick={onOpenChat}>Ask what’s next</button>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}

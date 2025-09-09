"use client";
import React from "react";

type LevelPillProps = {
  level: number; // 1..10
  label?: string;
  className?: string;
};

/**
 * Compact 10-step level meter with ARIA progressbar semantics.
 */
export default function LevelPill({ level, label, className = "" }: LevelPillProps) {
  const clamped = Math.max(1, Math.min(10, Math.floor(level || 1)));
  const pct = (clamped - 1) / 9 * 100; // 0..100

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div
        role="progressbar"
        aria-label={label || "Prosper Level"}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuenow={clamped}
        className="h-3 w-40 rounded-full bg-gray-200 relative overflow-hidden"
      >
        <div className="absolute inset-0 flex">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex-1 border-r border-white/40 last:border-r-0" />
          ))}
        </div>
        <div
          className="h-full rounded-full bg-brand transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-sm font-medium tabular-nums">
        L{clamped}
      </div>
    </div>
  );
}


"use client";
import React from "react";

function envInt(key: string, fallback: number) {
  const v = Number(process.env[key as keyof NodeJS.ProcessEnv]);
  return Number.isFinite(v) ? v : fallback;
}
function envStr(key: string, fallback: string) {
  const v = process.env[key as keyof NodeJS.ProcessEnv];
  return v && v.trim() ? v : fallback;
}

export default function ScarcityCounter({
  capacity = envInt("NEXT_PUBLIC_INVITE_CAPACITY", 150),
  floor = envInt("NEXT_PUBLIC_INVITE_FLOOR", 7),
  startIso = envStr("NEXT_PUBLIC_INVITE_START_ISO", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  decrementMinutes = envInt("NEXT_PUBLIC_INVITE_DECAY_MINUTES", 180),
  className = "",
}: {
  capacity?: number;
  floor?: number;
  startIso?: string;
  decrementMinutes?: number;
  className?: string;
}) {
  const calcRemaining = React.useCallback((now: number) => {
    const start = Date.parse(startIso);
    if (!Number.isFinite(start) || start > now) return capacity;
    const elapsedMs = now - start;
    const intervalMs = Math.max(1, decrementMinutes) * 60_000;
    const consumed = Math.floor(elapsedMs / intervalMs);
    return Math.max(floor, capacity - consumed);
  }, [capacity, floor, startIso, decrementMinutes]);

  const [remaining, setRemaining] = React.useState<number>(() => calcRemaining(Date.now()));

  React.useEffect(() => {
    setRemaining(calcRemaining(Date.now()));
    const id = setInterval(() => setRemaining(calcRemaining(Date.now())), 60_000);
    return () => clearInterval(id);
  }, [calcRemaining]);

  return (
    <span className={className || "text-xs text-dim md:text-sm"}>
      Only {remaining} of {capacity} invites left
    </span>
  );
}


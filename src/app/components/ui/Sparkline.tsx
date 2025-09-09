"use client";
import React from "react";

export type SparkPoint = { ts?: string; value: number };

export default function Sparkline({ points, size = 'md' }: { points: SparkPoint[]; size?: 'sm' | 'md' }) {
  const w = 600;
  const h = 120;
  const { d, areaD } = React.useMemo(() => {
    if (!points || points.length === 0) return { d: "", areaD: "" };
    const vals = points.map((p) => Number(p.value || 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const norm = (v: number) => (max === min ? 0.5 : (v - min) / (max - min));
    const step = vals.length > 1 ? w / (vals.length - 1) : w;
    const coords = vals.map((v, i) => [i * step, h - norm(v) * h] as const);
    const path = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
    const areaPath = `${path} L ${w},${h} L 0,${h} Z`;
    return { d: path, areaD: areaPath };
  }, [points]);

  if (!d) {
    return (
      <div className="h-20 w-full bg-card rounded-md border border-border flex items-center justify-center text-xs ink-muted">
        <div className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" /></svg>
          No data
        </div>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={`w-full ${size === 'sm' ? 'h-12 md:h-16' : 'h-28 md:h-36'}`}
      role="img"
      aria-label="Net worth trend"
      color="var(--brand)"
    >
      <defs>
        <linearGradient id="slope" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#slope)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

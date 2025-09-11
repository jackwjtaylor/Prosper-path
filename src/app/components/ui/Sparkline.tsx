"use client";
import React from "react";

export type SparkPoint = { ts?: string; value: number };

export default function Sparkline({ points, size = 'md' }: { points: SparkPoint[]; size?: 'sm' | 'md' | 'lg' | 'fill' }) {
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

    // Smooth curve using a simple Catmull-Rom → cubic Bézier conversion
    const C = (p0: readonly [number, number], p1: readonly [number, number], p2: readonly [number, number], p3: readonly [number, number], t = 0.5) => {
      const d1x = (p2[0] - p0[0]) * t, d1y = (p2[1] - p0[1]) * t;
      const d2x = (p3[0] - p1[0]) * t, d2y = (p3[1] - p1[1]) * t;
      const cp1: [number, number] = [p1[0] + d1x / 3, p1[1] + d1y / 3];
      const cp2: [number, number] = [p2[0] - d2x / 3, p2[1] - d2y / 3];
      return { cp1, cp2 };
    };

    let path = '';
    if (coords.length === 1) {
      const [x, y] = coords[0];
      path = `M${x},${y}`;
    } else if (coords.length === 2) {
      path = `M${coords[0][0]},${coords[0][1]} L${coords[1][0]},${coords[1][1]}`;
    } else {
      path = `M${coords[0][0]},${coords[0][1]}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[Math.max(0, i - 1)];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[Math.min(coords.length - 1, i + 2)];
        const { cp1, cp2 } = C(p0, p1, p2, p3, 0.5);
        path += ` C${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${p2[0]},${p2[1]}`;
      }
    }
    const areaPath = `${path} L ${w},${h} L 0,${h} Z`;
    return { d: path, areaD: areaPath };
  }, [points]);

  if (!d) {
    return (
      <div className={`w-full bg-card rounded-md border border-border flex items-center justify-center text-xs ink-muted ${size === 'sm' ? 'h-16 md:h-20' : size === 'lg' ? 'h-40 md:h-56' : size === 'fill' ? 'h-full' : 'h-28 md:h-36'}`}>
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
      className={`w-full ${size === 'sm' ? 'h-16 md:h-20' : size === 'lg' ? 'h-40 md:h-56' : size === 'fill' ? 'h-full' : 'h-28 md:h-36'}`}
      role="img"
      aria-label="Net worth trend"
      preserveAspectRatio="none"
      color="var(--brand)"
    >
      <defs>
        <linearGradient id="slope" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#slope)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

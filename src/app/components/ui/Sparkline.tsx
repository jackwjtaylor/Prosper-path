"use client";
import React from "react";

export type SparkPoint = { ts?: string; value: number };

type Props = {
  points: SparkPoint[];
  forecast?: SparkPoint[];
  size?: 'sm' | 'md' | 'lg' | 'fill';
  showAxis?: boolean;
  showYAxis?: boolean;
  currency?: string; // e.g., 'USD' for compact labels
};

export default function Sparkline({ points, forecast = [], size = 'md', showAxis = true, showYAxis = true, currency }: Props) {
  const w = 600;
  const axisH = showAxis ? 18 : 0;
  const axisW = showYAxis ? 48 : 0;
  const h = 120;
  const chartH = h - axisH;
  const plotW = w - axisW;

  const { d, areaD, dForecast, ticks, yTicks, minYp, maxYp } = React.useMemo(() => {
    if (!points || points.length === 0) return { d: "", areaD: "", dForecast: "", ticks: [] as Array<{ x: number; label: string }>, yTicks: [] as Array<{ y: number; v: number }>, minYp: 0, maxYp: 1 };

    const all = [...points, ...forecast];
    const hasTs = all.some(p => p.ts);
    const parseTs = (p: SparkPoint, i: number) => p.ts ? new Date(p.ts).getTime() : i;

    const xs = points.map(parseTs);
    const ys = points.map(p => Number(p.value || 0));
    const xf = forecast.map(parseTs);
    const yf = forecast.map(p => Number(p.value || 0));

    const minX = Math.min(...(hasTs ? [...xs, ...xf] : xs));
    const maxX = Math.max(...(hasTs ? [...xs, ...xf] : xs));
    let minY = Math.min(...[...ys, ...(yf.length ? yf : [ys[0]])]);
    let maxY = Math.max(...[...ys, ...(yf.length ? yf : [ys[0]])]);
    // Add headroom/padding for readability
    let rangeY = maxY - minY;
    if (!Number.isFinite(rangeY) || rangeY === 0) rangeY = Math.abs(maxY) * 0.1 || 1;
    const pad = Math.max(1, rangeY * 0.08);
    const minYp = minY - pad;
    const maxYp = maxY + pad;

    const nx = (x: number, i: number, isForecast = false) => {
      if (!hasTs) {
        const arr = isForecast ? forecast : points;
        const step = arr.length > 1 ? plotW / (arr.length - 1) : plotW;
        return axisW + i * step;
      }
      return axisW + ((maxX === minX) ? plotW : ((x - minX) / Math.max(1, (maxX - minX))) * plotW);
    };
    const ny = (v: number) => chartH - ((v - minYp) / Math.max(1e-9, (maxYp - minYp))) * chartH;

    const coords = points.map((p, i) => [nx(xs[i], i, false), ny(ys[i])] as const);
    const coordsF = forecast.map((p, i) => [nx(xf[i], i, true), ny(yf[i])] as const);

    const C = (p0: readonly [number, number], p1: readonly [number, number], p2: readonly [number, number], p3: readonly [number, number], t = 0.5) => {
      const d1x = (p2[0] - p0[0]) * t, d1y = (p2[1] - p0[1]) * t;
      const d2x = (p3[0] - p1[0]) * t, d2y = (p3[1] - p1[1]) * t;
      const cp1: [number, number] = [p1[0] + d1x / 3, p1[1] + d1y / 3];
      const cp2: [number, number] = [p2[0] - d2x / 3, p2[1] - d2y / 3];
      return { cp1, cp2 };
    };

    const buildPath = (c: ReadonlyArray<readonly [number, number]>) => {
      if (c.length === 0) return '';
      if (c.length === 1) return `M${c[0][0]},${c[0][1]}`;
      if (c.length === 2) return `M${c[0][0]},${c[0][1]} L${c[1][0]},${c[1][1]}`;
      let path = `M${c[0][0]},${c[0][1]}`;
      for (let i = 0; i < c.length - 1; i++) {
        const p0 = c[Math.max(0, i - 1)];
        const p1 = c[i];
        const p2 = c[i + 1];
        const p3 = c[Math.min(c.length - 1, i + 2)];
        const { cp1, cp2 } = C(p0 as any, p1 as any, p2 as any, p3 as any, 0.5);
        path += ` C${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${p2[0]},${p2[1]}`;
      }
      return path;
    };

    const path = buildPath(coords);
    const areaPath = `${path} L ${axisW + plotW},${chartH} L ${axisW},${chartH} Z`;
    const pathF = buildPath(coordsF);

    // Build time axis ticks
    const ticks: Array<{ x: number; label: string }> = [];
    if (showAxis && hasTs) {
      const tickCount = 4;
      for (let i = 0; i < tickCount; i++) {
        const t = minX + (i / (tickCount - 1)) * (maxX - minX);
        const x = nx(t, i);
        const d = new Date(t);
        const totalDays = (maxX - minX) / (1000 * 60 * 60 * 24);
        const label = totalDays > 330
          ? d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
          : totalDays > 60
          ? d.toLocaleDateString(undefined, { month: 'short' })
          : d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' });
        ticks.push({ x, label });
      }
    }

    // Y ticks: 3 markers (min/mid/max) using padded domain
    const yTicks: Array<{ y: number; v: number }> = [];
    const yCount = 3;
    for (let i = 0; i < yCount; i++) {
      const v = minYp + (i / (yCount - 1)) * (maxYp - minYp);
      yTicks.push({ v, y: ny(v) });
    }

    return { d: path, areaD: areaPath, dForecast: pathF, ticks, yTicks, minYp, maxYp };
  }, [points, forecast, chartH, showAxis]);

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
      <g transform={`translate(0,0)`}>
        <path d={areaD} fill="url(#slope)" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {dForecast && dForecast.length > 0 && (
          <path d={dForecast} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" opacity="0.7" />
        )}
      </g>
      {showAxis && (
        <g transform={`translate(0,${chartH})`}>
          <line x1={axisW} y1="0.5" x2={axisW + plotW} y2="0.5" stroke="#e5e7eb" />
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={t.x} y1="0" x2={t.x} y2="4" stroke="#cbd5e1" />
              <text x={t.x} y="14" fontSize="10" textAnchor="middle" fill="#64748b">{t.label}</text>
            </g>
          ))}
        </g>
      )}
      {showYAxis && (
        <g>
          <line x1={axisW} y1="0" x2={axisW} y2={chartH} stroke="#e5e7eb" />
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={axisW - 3} y1={t.y} x2={axisW} y2={t.y} stroke="#cbd5e1" />
              <text x={axisW - 6} y={t.y + 3} fontSize="10" textAnchor="end" fill="#64748b">
                {formatTick(t.v, currency)}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  );
}

function formatTick(v: number, currency?: string): string {
  const abs = Math.abs(v);
  let compact = '';
  if (abs >= 1_000_000_000) compact = `${(v/1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) compact = `${(v/1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) compact = `${(v/1_000).toFixed(1)}k`;
  else compact = `${Math.round(v)}`;
  if (currency) {
    try {
      // Use Intl if available for currency symbol
      const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 });
      const sym = (fmt.formatToParts ? fmt.formatToParts(0).find(p => p.type === 'currency')?.value : '') || '';
      return `${sym}${compact}`;
    } catch {}
  }
  return compact;
}

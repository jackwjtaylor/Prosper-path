"use client";
import React from "react";

type KpiStatProps = {
  label: string;
  value: string;
  delta?: number; // positive or negative percentage (e.g., 0.034 for +3.4%)
  hint?: string;
  className?: string;
};

export default function KpiStat({ label, value, delta, hint, className = "" }: KpiStatProps) {
  const pct = Number.isFinite(delta as number) ? Math.round((delta as number) * 1000) / 10 : null;
  const color = pct == null ? "text-muted" : pct >= 0 ? "text-emerald-600" : "text-rose-600";
  const sign = pct == null ? "" : pct >= 0 ? "+" : "";

  return (
    <div className={`rounded-md border border-[color:var(--border)] p-3 bg-[color:var(--card)] ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-xl font-semibold num">{value}</div>
      {pct != null && (
        <div className={`text-xs mt-0.5 ${color}`}>{sign}{Math.abs(pct).toFixed(1)}%</div>
      )}
      {hint && <div className="text-[11px] text-muted mt-1">{hint}</div>}
    </div>
  );
}


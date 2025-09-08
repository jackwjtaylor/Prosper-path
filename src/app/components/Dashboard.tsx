"use client";
import React from "react";
import { ensureHouseholdId } from "@/app/lib/householdLocal";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { getProsperLevelLabel } from "@/app/lib/prosperLevelLabels";
import { normaliseCurrency } from "@/app/lib/validate";
import { normaliseSlots } from "@/app/lib/normalise";
import BenchmarksCard from "@/app/components/BenchmarksCard";

/** ===== Types expected from /api/prosper/dashboard ===== */
export type SeriesPoint = { ts: string; value: number };

export type Snapshot = {
  id?: string;
  created_at?: string;
  inputs?: any;
  kpis?: Record<string, any> | null;
  levels?: any;
  recommendations?: any;
  provisional_keys?: string[];
};

export type DashboardPayload = {
  householdId?: string;
  latestSnapshot?: Snapshot | null;
  /** convenience mirrors from latestSnapshot (server may include) */
  kpis?: Record<string, any> | null;
  levels?: any;
  recommendations?: any;
  series?: SeriesPoint[];
  entitlements?: { plan: 'free'|'premium'; subscription_status?: string; current_period_end?: string };
  usage?: { free_limit?: number; used?: number; remaining?: number };
  household?: { email?: string; full_name?: string };
};

/** ===== Helpers ===== */
const fmtCurrency = (n: number, currency = "AUD") =>
  new Intl.NumberFormat('en-US', { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${(Number.isFinite(n) ? Math.round(n * 1000) / 10 : 0).toFixed(1)}%`;

// Short, friendly timestamp like "31 Aug, 14:30" (locale-aware)
function fmtShortDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.toLocaleString('en-US', { day: '2-digit', timeZone: 'UTC' });
    const mon = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    return `${day} ${mon}, ${time}`;
  } catch {
    return new Date(iso).toLocaleString('en-US', { timeZone: 'UTC' });
  }
}

// One-word level names proposal (L1..L10 maps to indices 0..9)
const LEVEL_SHORT_NAMES = [
  'Triage',       // L1
  'Surviving',    // L2
  'Steady',       // L3
  'Starter',      // L4
  'Buffer',       // L5
  'Builder',      // L6
  'Resilient',    // L7
  'Secure',       // L8
  'Work-Optional',// L9
  'Abundant',     // L10
] as const;

const LEVEL_DESCRIPTIONS = [
  'Money is tight; stabilize bills and build a tiny safety buffer.',
  'Current on bills with a tiny buffer—build consistency and avoid new debt.',
  'A starter buffer and basic control over spending.',
  'Building habits and a clear plan to knock out costly debt.',
  'Everyday shocks are covered with a 3‑month buffer.',
  'Savings are compounding and harmful debts are gone.',
  'Costs are right‑sized and buffers are strong—hard to knock off course.',
  'Secure for the medium term: low debt and retirement on track.',
  'Investments can likely cover your lifestyle.',
  'Beyond financial independence with room for flexibility and giving.',
];

/** Minimal sparkline (no deps) */
function Sparkline({ points }: { points: SeriesPoint[] }) {
  const w = 600; // wider internal coordinate space for better scaling
  const h = 120; // taller internal height
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
      <div className="h-20 w-full bg-white rounded-md border flex items-center justify-center text-xs text-gray-500">
        <div className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="#9CA3AF" /></svg>
          No data
        </div>
      </div>
    );
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28 md:h-36" role="img" aria-label="Net worth trend">
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

/** ===== Dashboard ===== */
export default function Dashboard() {
  const [data, setData] = React.useState<DashboardPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [householdId, setHouseholdId] = React.useState<string | null>(null);
  const [showUsesToast, setShowUsesToast] = React.useState(false);
  const [showSavedToast, setShowSavedToast] = React.useState(false);
  const [showPremiumBanner, setShowPremiumBanner] = React.useState(false);
  const [showUserData, setShowUserData] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id = await ensureHouseholdId();
      setHouseholdId(id);
      // Attach auth token if available
      const headers: any = {};
      try {
        const supa = getSupabaseClient();
        if (supa) {
          const sessRes = await supa.auth.getSession();
          const token = 'data' in (sessRes as any) ? (sessRes as any).data?.session?.access_token : undefined;
          if (token) headers.Authorization = `Bearer ${token}`;
        }
      } catch {}

      let res = await fetch(`/api/prosper/dashboard?householdId=${id}`, { cache: "no-store", headers });
      // If unauthorized and we are authed, try to link cookie household then retry once
      if ((res.status === 401 || res.status === 403) && headers.Authorization) {
        try {
          await fetch('/api/household/ensure', { method: 'POST', headers });
          res = await fetch(`/api/prosper/dashboard?householdId=${id}`, { cache: 'no-store', headers });
        } catch {}
      }
      if (!res.ok) {
        if (res.status === 401) throw new Error('Please sign in to access your dashboard.');
        if (res.status === 403) throw new Error('This device is linked to a different account. Please sign in again.');
        const jj = await res.json().catch(() => ({}));
        throw new Error((jj as any)?.error || 'Failed to load dashboard');
      }
      const json = (await res.json()) as DashboardPayload;
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      await load();
      if (!mounted) return;
    })();
    return () => {
      mounted = false;
    };
  }, [load]);

  // Supabase realtime: refresh on new snapshots for this household when anon key is configured
  React.useEffect(() => {
    const supa = getSupabaseClient();
    if (!supa || !householdId) return;
    const channel = supa
      .channel(`snapshots:${householdId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'snapshots', filter: `household_id=eq.${householdId}` }, () => {
        setShowSavedToast(true);
        setTimeout(() => setShowSavedToast(false), 3500);
        load();
      })
      .subscribe();
    return () => { try { channel.unsubscribe(); } catch {} };
  }, [householdId, load]);

  // Auto-refresh when a snapshot is saved via chat
  React.useEffect(() => {
    const onSaved = () => {
      load();
      setShowSavedToast(true);
      setTimeout(() => setShowSavedToast(false), 3500);
    };
    const onBilling = () => { setShowPremiumBanner(true); setTimeout(() => setShowPremiumBanner(false), 8000); };
    const onOpenUserData = () => setShowUserData(true);
    window.addEventListener('pp:snapshot_saved', onSaved as any);
    window.addEventListener('pp:billing_confirmed', onBilling as any);
    window.addEventListener('pp:open_user_data', onOpenUserData as any);
    return () => {
      window.removeEventListener('pp:snapshot_saved', onSaved as any);
      window.removeEventListener('pp:billing_confirmed', onBilling as any);
      window.removeEventListener('pp:open_user_data', onOpenUserData as any);
    };
  }, [load]);

  const series = data?.series ?? [];
  const latest = data?.latestSnapshot ?? null;
  const kpis = data?.kpis ?? latest?.kpis ?? {};
  const levels = data?.levels ?? latest?.levels ?? {};
  const recs = (data?.recommendations ?? latest?.recommendations) as any;
  const entitlements = data?.entitlements ?? { plan: 'free' } as any;
  // v2 markers available via kpis.gates when present

  const last = series[series.length - 1]?.value;
  const prev = series.length > 1 ? series[series.length - 2]?.value : undefined;
  const delta = last != null && prev != null ? last - prev : undefined;
  const deltaPct = last != null && prev != null && prev !== 0 ? ((last - prev) / prev) * 100 : undefined;

  const currency = React.useMemo(() => {
    const cur = (latest as any)?.inputs?.currency as string | undefined;
    if (cur) return cur;
    const iso = (latest as any)?.inputs?.slots?.country?.value as string | undefined;
    if (iso) return normaliseCurrency(iso).code;
    return "AUD";
  }, [latest]);
  // Friendly name if needed in future (unused in current UI)
  /* const name: string | null = React.useMemo(() => {
    const inputs = (latest as any)?.inputs || {};
    const slots = inputs?.slots || {};
    const cand = [
      slots?.full_name?.value,
      slots?.names?.value,
      inputs?.full_name,
      inputs?.names,
      data?.household?.full_name,
      data?.household?.email,
    ].filter(Boolean);
    let n: any = cand[0] ?? null;
    if (Array.isArray(n)) n = n.filter(Boolean).join(' & ');
    if (typeof n === 'string') {
      const s = n.trim();
      // If email, display local-part capitalized
      if (s.includes('@')) {
        const local = s.split('@')[0] || '';
        if (local) return local.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      }
      return s.length > 0 ? s : null;
    }
    return null;
  }, [latest]); */
  const overallLevelCode = (levels?.overall?.level as string) || "L1";
  const overallLevelLabel = getProsperLevelLabel(overallLevelCode);
  const levelNumber = Number(overallLevelCode.match(/\d+/)?.[0] ?? 1); // 1..10
  const overallIdx = Math.max(1, Math.min(10, levelNumber));

  // Show uses-left toast once when remaining <= 3 on free plan
  React.useEffect(() => {
    const remaining = Number((data as any)?.usage?.remaining ?? Infinity);
    if (entitlements?.plan === 'free' && remaining <= 3) {
      const key = 'pp_uses_toast_shown';
      let shown = false;
      try { shown = localStorage.getItem(key) === '1'; } catch {}
      if (!shown) {
        setShowUsesToast(true);
        try { localStorage.setItem(key, '1'); } catch {}
        const t = setTimeout(() => setShowUsesToast(false), 6000);
        return () => clearTimeout(t);
      }
    }
  }, [data, entitlements]);

  // Compute missing required inputs count for the indicator
  const inputsAny = (latest as any)?.inputs || {};
  const slotsAny = inputsAny?.slots || {};
  const anyVal = (keys: string[]): any => {
    for (const k of keys) {
      const v = (slotsAny?.[k]?.value ?? inputsAny?.[k]);
      if (v != null && v !== '') return v;
    }
    return null;
  };
  const missingRequired = [
    // income: net OR gross
    !(anyVal(['net_income_monthly_self']) != null || anyVal(['income_net_monthly']) != null || anyVal(['gross_income_annual_self']) != null || anyVal(['income_gross_monthly']) != null),
    // essentials
    !(anyVal(['essential_expenses_monthly']) != null || anyVal(['essentials_monthly']) != null),
    // housing: rent OR mortgage OR housing_total
    !(anyVal(['rent_monthly']) != null || anyVal(['mortgage_payment_monthly']) != null || anyVal(['housing_total_monthly']) != null),
    // debt payments
    !(anyVal(['other_debt_payments_monthly_total']) != null || anyVal(['debt_required_payments_monthly']) != null),
    // quick cash / EF
    !(anyVal(['cash_liquid_total']) != null || anyVal(['emergency_savings_liquid']) != null),
  ].reduce((acc, isMissing) => acc + (isMissing ? 1 : 0), 0);
  // Show hint only if overrides are present AND components are missing (i.e., override is actually in use)
  const componentsAssetsPresent = (slotsAny?.home_value?.value != null) || (slotsAny?.investments_ex_home_total?.value != null) || (slotsAny?.cash_liquid_total?.value != null) || (slotsAny?.pension_balance_total?.value != null);
  const componentsLiabsPresent = (slotsAny?.mortgage_balance?.value != null) || (slotsAny?.other_debt_balances_total?.value != null);
  const assetsOverrideUsed = (slotsAny?.assets_total?.value != null) && !componentsAssetsPresent;
  const debtsOverrideUsed = (slotsAny?.debts_total?.value != null) && !componentsLiabsPresent;
  // const hasNwOverrides = assetsOverrideUsed || debtsOverrideUsed; // presently unused

  return (
    <>
    <div className="w-full h-full">
      {showPremiumBanner && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          Premium unlocked — thanks for supporting Prosper! Your full history and premium features are enabled.
        </div>
      )}
      <header className="flex items-start justify-between mb-4 gap-3">
        <div />
        <div className="flex items-center gap-2 gap-y-1 flex-wrap justify-end">
          {/* Free uses left nudge */}
          {data?.usage && entitlements?.plan !== 'premium' && (
            <div className={`text-xs shrink-0 ${Math.max(0, Number((data?.usage as any)?.remaining ?? 0)) <= 3 ? 'text-red-600' : 'text-gray-600'}`}>
              Free uses left: <b>{Math.max(0, Number((data?.usage as any)?.remaining ?? 0))}</b>
            </div>
          )}
          {/* Missing data indicator (always visible when applicable) */}
          {missingRequired > 0 && (
            <div className="text-xs shrink-0 text-red-600 inline-flex items-center gap-1" title="Some required items are missing">
              <span className="inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-red-500 text-white">
                {missingRequired}
              </span>
              <span>Missing items</span>
            </div>
          )}
          <button
            onClick={() => setShowUserData(v => !v)}
            className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-white hover:bg-gray-50 text-xs shadow-sm shrink-0"
            aria-pressed={showUserData}
            title="Review the data used for your calculations"
          >
            {showUserData ? 'Hide data' : 'Review data'}
          </button>
          {householdId && entitlements?.plan === 'premium' && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/billing/create-portal-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId }) });
                  const j = await res.json();
                  if (j?.url) window.location.href = j.url;
                } catch {}
              }}
              className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-white hover:bg-gray-50 text-xs shadow-sm"
            >
              Manage plan
            </button>
          )}
          {householdId && entitlements?.plan !== 'premium' && (
            <button
              onClick={async () => {
                try {
                  const email = (latest as any)?.inputs?.slots?.email?.value || (latest as any)?.inputs?.email || data?.household?.email;
                  const res = await fetch('/api/billing/create-checkout-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, email }) });
                  const j = await res.json();
                  if (j?.url) window.location.href = j.url;
                } catch {}
              }}
              className="h-8 px-2.5 inline-flex items-center gap-2 rounded-lg border bg-gray-900 text-white hover:bg-gray-800 text-xs shadow-sm"
            >
              Upgrade
            </button>
          )}
        </div>
      </header>

      {error && (
        <div role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div aria-busy="true" aria-live="polite" className="grid grid-cols-1 xl:grid-cols-5 gap-4 animate-pulse">
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-36" />
          <div className="xl:col-span-3 bg-white border rounded-xl shadow-sm h-64" />
          <div className="xl:col-span-2 bg-white border rounded-xl shadow-sm h-64" />
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-28" />
          <div className="xl:col-span-5 bg-white border rounded-xl shadow-sm h-72" />
        </div>
      ) : (
        showUserData ? (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <div className="xl:col-span-5">
              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm text-gray-600 font-medium">Your data (for calculations)</div>
                  <div className="text-xs text-gray-500">Spot anything off? Edit via chat</div>
                </div>
                <UserDataCard latest={latest} currency={currency} />
              </Card>
            </div>
          </div>
        ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-3">
          {/* ===== Net Worth (full width) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-600">Net worth</div>
                  <div className="text-2xl font-semibold leading-tight">
                    {Number.isFinite(last as number) ? fmtCurrency(last as number, currency) : '—'}
                  </div>
                  <div className="text-[11px] text-gray-600 mt-1">
                    {series?.length ? (
                      <>
                        Updated{' '}
                        <time suppressHydrationWarning dateTime={series[series.length-1].ts}>
                          {fmtShortDateTime(series[series.length-1].ts)}
                        </time>
                      </>
                    ) : ''}
                    {delta != null && (
                      <>
                        {' '}
                        • {delta >= 0 ? '+' : ''}{fmtCurrency(Math.abs(delta as number), currency)}
                        {deltaPct != null ? ` (${deltaPct >= 0 ? '+' : ''}${(Math.round(Math.abs(deltaPct) * 10) / 10).toFixed(1)}%)` : ''}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <RangeNetWorth series={series} latest={latest} currency={currency} />
              </div>
            </Card>
          </div>

          {/* ===== People like you (benchmarks, full width below net worth) ===== */}
          <div className="xl:col-span-5">
            <BenchmarksCard latest={latest} kpis={kpis} />
          </div>

          {/* ===== Level (full width below net worth) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-gray-600">Level</div>
                  <div className="text-sm font-semibold leading-tight">Level {overallIdx} — {overallLevelLabel}</div>
                  <div className="text-xs text-gray-600 mt-1">{LEVEL_DESCRIPTIONS[overallIdx - 1]}</div>
                </div>
              </div>
              {/* Journey bar across full width with 10 steps labeled 1-10 */}
              <div className="mt-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 10 }).map((_, i) => {
                    const curIndex = overallIdx - 1;
                    const completed = i < curIndex;
                    const current = i === curIndex;
                    const next = i === Math.min(9, curIndex + 1);
                    const cls = current
                      ? 'bg-emerald-500'
                      : completed
                      ? 'bg-emerald-200'
                      : next
                      ? 'bg-yellow-400'
                      : 'bg-gray-200';
                    return <div key={i} className={`h-2 flex-1 rounded ${cls}`} title={`Level ${i+1} — ${getProsperLevelLabel(i+1)}`} />;
                  })}
                </div>
                <div className="grid grid-cols-10 gap-1 mt-1 text-[9px] leading-3 text-gray-600 text-center">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="truncate" title={`Level ${i+1} — ${getProsperLevelLabel(i+1)}`}>{LEVEL_SHORT_NAMES[i]}</div>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-gray-700">
                  Next: Level {Math.min(10, overallIdx + 1)} — {LEVEL_SHORT_NAMES[Math.min(9, overallIdx)]}. {LEVEL_DESCRIPTIONS[Math.min(9, overallIdx)]}
                </div>
              </div>
            </Card>
          </div>

          {/* ===== Progress insights ===== */}
          <div className="xl:col-span-5">
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Progress insights</div>
              </div>
              <ProgressInsights kpis={kpis} />
            </Card>
          </div>

          

          {/* ===== Action Plan (single card: uncompleted first, completed at bottom) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-gray-600 font-medium">Action plan</div>
              </div>
              <ActionPlan recs={recs} kpis={kpis} />
            </Card>
          </div>

          {/* (Data review is shown exclusively when toggled) */}

          {/* ===== KPI Grid (by pillar, sorted by urgency) ===== */}
          <div className="xl:col-span-5">
            <Card className="p-3">
              <KpiGrid kpis={kpis} />
            </Card>
          </div>

          {/* Progress ladder removed per updated design */}
          {/* Remove legacy Pillars and Action plan sections per new layout */}
        </div>
        )
      )}
    </div>
    {showUsesToast && (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900 shadow-md">
          You have only a few free uses left. Upgrade to unlock full features and keep going.
        </div>
      </div>
    )}
    {showSavedToast && (
      <div className="fixed bottom-20 right-4 z-50 max-w-sm">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 shadow-md">
          Profile updated — your dashboard is up to date.
        </div>
      </div>
    )}
    </>
  );
}

/** ===== Small presentational components ===== */

/** Small card wrapper for consistent styling */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border rounded-xl shadow-sm ${className}`}>{children}</div>;
}

function V2KpiBar({
  label,
  value,
  target,
  dir,
  format = "pct",
  subtitle,
  tooltip,
}: {
  label: string;
  value: number | null | undefined;
  target: number;
  dir: "higher" | "lower";
  format?: "pct" | "months" | "ratio";
  subtitle?: string;
  tooltip?: string;
}) {
  const raw = Number.isFinite(value as number) ? (value as number) : null;
  const meets = raw == null ? undefined : dir === "higher" ? raw >= target : raw <= target;
  let progress = 0;
  if (raw != null && target > 0) {
    progress = dir === "higher" ? raw / target : target / Math.max(raw, 1e-9);
    if (progress > 1) progress = 1;
    if (progress < 0) progress = 0;
  }
  const tone = meets === true ? "good" : raw == null ? "unknown" : progress >= 0.7 ? "warn" : "bad";
  const barColor = tone === "good" ? "bg-emerald-500" : tone === "warn" ? "bg-yellow-500" : tone === "unknown" ? "bg-gray-300" : "bg-red-500";
  const fmt = (v: number | null) => {
    if (v == null) return "—";
    if (format === "pct") return fmtPct(v);
    if (format === "months") return `${(Math.round(v * 10) / 10).toFixed(1)} mo`;
    return String((Math.round(v * 100) / 100).toFixed(2));
  };
  const targetText = format === "pct" ? fmtPct(target) : format === "months" ? `${target} mo` : String(target);

  return (
    <div className="border rounded-lg p-3 bg-white" title={tooltip || undefined}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="flex items-baseline justify-between mt-0.5">
        <div className="text-lg font-semibold">{fmt(raw)}</div>
        <div className="text-[11px] text-gray-500">{subtitle ?? (dir === "higher" ? `Target ≥ ${targetText}` : `Target ≤ ${targetText}`)}</div>
      </div>
      <div className="mt-2 h-1.5 w-full rounded bg-gray-200">
        <div className={`h-1.5 rounded ${barColor}`} style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <div className="mt-2 text-[11px]">
        <button
          className="underline text-gray-600 hover:text-gray-800"
          onClick={() => {
            const explain = `Explain my ${label.toLowerCase()}: current is ${fmt(raw)} vs target ${targetText}. Why this matters and 2 ways to improve, please.`;
            try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text: explain } })); } catch {}
          }}
        >
          Explain this
        </button>
      </div>
    </div>
  );
}

/** ===== Helpers: New mini components ===== */
// Removed unused UrgentKpis component

// Removed unused NextActions component


function ActionPlan({ recs, kpis }: { recs: any; kpis: any }) {
  const [householdId, setHouseholdId] = React.useState<string>("");
  const [completedItems, setCompletedItems] = React.useState<{ id: string; title?: string; completed_at?: string }[]>([]);
  const [completedTitles, setCompletedTitles] = React.useState<string[]>([]);
  const [dismissedTitles, setDismissedTitles] = React.useState<string[]>([]);
  const [completedIds, setCompletedIds] = React.useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const hh = await ensureHouseholdId();
        setHouseholdId(hh);
        const r = await fetch(`/api/actions/list?householdId=${hh}`, { cache: 'no-store' });
        const j = await r.json();
        const arr = (j?.items || []) as { id: string; title?: string; completed_at?: string; status?: string; action_id?: string }[];
        setCompletedItems(arr);
        setCompletedTitles(arr.filter(it => (it as any)?.status === 'done' || it.completed_at).map((it) => (it.title || '').toString().toLowerCase()).filter(Boolean));
        setDismissedTitles(arr.filter(it => (it as any)?.status === 'dismissed').map(it => (it.title || '').toString().toLowerCase()).filter(Boolean));
        setCompletedIds(arr.filter(it => (it as any)?.status === 'done' || it.completed_at).map(it => (it as any)?.action_id).filter(Boolean) as string[]);
        setDismissedIds(arr.filter(it => (it as any)?.status === 'dismissed').map(it => (it as any)?.action_id).filter(Boolean) as string[]);
      } catch {}
    })();
  }, []);

  // Prepare set of recommended ids from server recs to badge items
  let recArr: any[] = [];
  if (Array.isArray(recs)) recArr = recs;
  else if (recs && typeof recs === 'object') recArr = Object.values(recs).flat();
  const recIds = new Set<string>((recArr || []).map((r) => (r?.action_id || '').toString()).filter(Boolean));

  // Build a full catalogue of possible actions and compute relevance
  const gates = (kpis && typeof kpis === 'object' ? (kpis as any).gates : undefined) || {};
  const K = kpis || {};
  const fmt1 = (n: any, kind: 'pct'|'months'|'ratio'='pct') => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '—';
    if (kind === 'pct') return `${Math.round(v*100)}%`;
    if (kind === 'months') return `${(Math.round(v*10)/10).toFixed(1)} mo`;
    return `${(Math.round(v*100)/100).toFixed(2)}`;
  };
  type Cat = { action_id: string; title: string; how: string[]; pillar: string; relevant: boolean; reason: string };
  const catalogue: Cat[] = [];
  function push(id: string, title: string, pillar: string, how: string[], relevant: boolean, reason: string) {
    catalogue.push({ action_id: id, title, how, pillar, relevant, reason });
  }
  // Emergency fund ≥ 3 mo
  {
    const ef = K.ef_months as number | null | undefined;
    const rel = Number.isFinite(ef as number) ? ((ef as number) < 3) : false;
    const reason = (ef == null) ? 'Missing inputs: essential expenses and liquid savings.' : (rel ? `EF ${fmt1(ef,'months')} < 3mo` : `EF ${fmt1(ef,'months')} meets ≥3mo`);
    push('SAVE_EMERGENCY_FUND_3M', 'Build emergency fund to 3 months', 'save', ['Open a high-yield savings bucket', 'Automate weekly transfer 5–10% of pay'], rel, reason);
  }
  // Non-mortgage DSR ≤ 10%
  {
    const nmdsr = K.nmdsr as number | null | undefined;
    const rel = Number.isFinite(nmdsr as number) ? (nmdsr as number) > 0.10 : false;
    const reason = (nmdsr == null) ? 'Missing inputs: net income and non-mortgage debt payments.' : (rel ? `NMDSR ${fmt1(nmdsr)} > 10%` : `NMDSR ${fmt1(nmdsr)} ≤ 10%`);
    push('BORROW_NMDSR_LE_10PCT', 'Reduce non-mortgage debt servicing ≤ 10%', 'borrow', ['Consolidate high-APR balances', 'Automate overpayments on smallest balance'], rel, reason);
  }
  // Savings rate ≥ 20%
  {
    const sr = K.sr as number | null | undefined;
    const rel = Number.isFinite(sr as number) ? (sr as number) < 0.20 : false;
    const reason = (sr == null) ? 'Missing inputs: net income and total expenses.' : (rel ? `Savings rate ${fmt1(sr)} < 20%` : `Savings rate ${fmt1(sr)} ≥ 20%`);
    push('SPEND_LIFT_SAVINGS_RATE_20PCT', 'Lift savings rate toward 20%', 'spend', ['Skim 1–2% from top categories', 'Increase auto‑investing by a set amount'], rel, reason);
  }
  // Housing ratio ≤ 40%
  {
    const hr = K.hr as number | null | undefined;
    const rel = Number.isFinite(hr as number) ? (hr as number) > 0.40 : false;
    const reason = (hr == null) ? 'Missing inputs: income and rent/mortgage + running costs.' : (rel ? `Housing ratio ${fmt1(hr)} > 40%` : `Housing ratio ${fmt1(hr)} ≤ 40%`);
    push('SPEND_REDUCE_HOUSING_RATIO_40PCT', 'Reduce housing burden toward ≤ 40% of gross', 'spend', ['Negotiate rent/review utilities', 'Refinance or extend term if feasible', 'Trim 5–10% near term'], rel, reason);
  }
  // DSR total ≤ 20%
  {
    const dsr = K.dsr_total as number | null | undefined;
    const rel = Number.isFinite(dsr as number) ? (dsr as number) > 0.20 : false;
    const reason = (dsr == null) ? 'Missing inputs: net income and all required debt payments.' : (rel ? `Total DSR ${fmt1(dsr)} > 20%` : `Total DSR ${fmt1(dsr)} ≤ 20%`);
    push('BORROW_REDUCE_DSR_TOTAL_20PCT', 'Lower total debt servicing toward ≤ 20% of income', 'borrow', ['Refinance to lower APR', 'Pause non‑essential spend', 'Redirect freed cash to highest APR'], rel, reason);
  }
  // Debt/Assets ≤ 0.60
  {
    const d2a = K.d_to_a as number | null | undefined;
    const rel = Number.isFinite(d2a as number) ? (d2a as number) > 0.60 : false;
    const reason = (d2a == null) ? 'Missing inputs: total assets and liabilities.' : (rel ? `D/A ${fmt1(d2a,'ratio')} > 0.60` : `D/A ${fmt1(d2a,'ratio')} ≤ 0.60`);
    push('BORROW_IMPROVE_DEBT_TO_ASSET_60PCT', 'Improve debt‑to‑asset ratio ≤ 0.60', 'borrow', ['Prioritise debt reduction', 'Avoid new large liabilities'], rel, reason);
  }
  // Liquid share of NW ≥ 15%
  {
    const lanw = K.lanw as number | null | undefined;
    const rel = Number.isFinite(lanw as number) ? (lanw as number) < 0.15 : false;
    const reason = (lanw == null) ? 'Missing inputs: assets and liquid savings.' : (rel ? `LANW ${fmt1(lanw)} < 15%` : `LANW ${fmt1(lanw)} ≥ 15%`);
    push('SAVE_INCREASE_LIQUID_SHARE_15PCT', 'Lift liquid assets toward ≥ 15% of net worth', 'save', ['Hold part of new savings in cash/offset', 'Build buffer before investing further'], rel, reason);
  }
  // Investable share of NW ≥ 40%
  {
    const invnw = K.invnw as number | null | undefined;
    const rel = Number.isFinite(invnw as number) ? (invnw as number) < 0.40 : false;
    const reason = (invnw == null) ? 'Missing inputs: net worth and investable assets.' : (rel ? `INVNW ${fmt1(invnw)} < 40%` : `INVNW ${fmt1(invnw)} ≥ 40%`);
    push('GROW_INCREASE_INVESTABLE_SHARE_40PCT', 'Increase investable share toward ≥ 40% of net worth', 'grow', ['Automate monthly investing', 'Rebalance annually to target mix'], rel, reason);
  }
  // Pension contributions ≥ 10%
  {
    const pc = K.pension_contrib_pct as number | null | undefined;
    const rel = Number.isFinite(pc as number) ? (pc as number) < 0.10 : false;
    const reason = (pc == null) ? 'Missing inputs: pension contribution % or gross income.' : (rel ? `Pension contrib ${fmt1(pc)} < 10%` : `Pension contrib ${fmt1(pc)} ≥ 10%`);
    push('GROW_RAISE_PENSION_CONTRIB_10PCT', 'Raise pension contributions to ≥ 10% of gross', 'grow', ['Increase salary sacrifice by 1–2%', 'Capture full employer match'], rel, reason);
  }
  // Retirement readiness ≥ 0.60
  {
    const rrr = K.rrr as number | null | undefined;
    const rel = Number.isFinite(rrr as number) ? (rrr as number) < 0.60 : false;
    const reason = (rrr == null) ? 'Missing retirement inputs (age, target income, investables).' : (rel ? `RRR ${fmt1(rrr,'ratio')} < 0.60` : `RRR ${fmt1(rrr,'ratio')} ≥ 0.60`);
    push('GROW_IMPROVE_RRR_60PCT', 'Improve retirement readiness toward 60%+', 'grow', ['Increase contribution rate by 1–2%', 'Review target age or income'], rel, reason);
  }
  // Life cover ≥ 5y (only relevant if dependants)
  {
    const gate = (gates as any)?.life_cover_ok as boolean | undefined;
    const rel = gate === false;
    const ycover = K.years_cover as number | null | undefined;
    const reason = gate === undefined ? 'Need dependants, life cover, liquid savings, debts to assess.' : (rel ? `Life cover ${ycover != null ? `${fmt1(ycover,'ratio')} years` : 'insufficient'} < 5 years` : 'Coverage adequate (≥ 5 years).');
    push('PROTECT_LIFE_COVER_GE_5Y', 'Lift life insurance to ≥ 5 years of needs', 'protect', ['Get a quick quote for term life', 'Set sum assured ≥ 5× annual dependant needs'], rel, reason);
  }
  // Income continuity ≥ 6 months
  {
    const gate = (gates as any)?.income_protection_ok as boolean | undefined;
    const rel = gate === false;
    const covered = K.months_covered as number | null | undefined;
    const reason = gate === undefined ? 'Need sick pay months and/or IP benefit to assess.' : (rel ? `Continuity ${covered != null ? fmt1(covered,'months') : 'insufficient'} < 6mo` : 'Continuity adequate (≥ 6 months).');
    push('PROTECT_INCOME_CONTINUITY_6M', 'Reach 6 months income continuity', 'protect', ['Check work sick pay policy', 'Price income protection to cover essentials for 6 months'], rel, reason);
  }
  // Current ratio ≥ 1 (hygiene)
  {
    const cr = K.current_ratio as number | null | undefined;
    const rel = Number.isFinite(cr as number) ? (cr as number) < 1 : false;
    const reason = (cr == null) ? 'Missing inputs: liquid assets and short‑term liabilities.' : (rel ? `Current ratio ${fmt1(cr,'ratio')} < 1` : `Current ratio ${fmt1(cr,'ratio')} ≥ 1`);
    push('HYGIENE_CURRENT_RATIO_GE_1', 'Improve current ratio to ≥ 1', 'protect', ['Boost liquid savings', 'Reduce short‑term liabilities'], rel, reason);
  }

  // Map server-completed and dismissed state
  const uniqueTitles = new Set<string>();
  const deduped = catalogue.filter((it) => {
    const key = (it.action_id || it.title).toString().toLowerCase();
    if (uniqueTitles.has(key)) return false;
    uniqueTitles.add(key);
    return true;
  });
  const isCompleted = (it: any) => {
    if (it.action_id && completedIds.includes(it.action_id)) return true;
    const t = it.title.toString().toLowerCase();
    return completedTitles.includes(t);
  };
  const isDismissed = (it: any) => {
    if (it.action_id && dismissedIds.includes(it.action_id)) return true;
    const t = it.title.toString().toLowerCase();
    return dismissedTitles.includes(t);
  };
  let uncompleted = deduped.filter((it) => !isCompleted(it) && !isDismissed(it));
  uncompleted = uncompleted.sort((a, b) => {
    const aRec = recIds.has(a.action_id || '');
    const bRec = recIds.has(b.action_id || '');
    if (aRec !== bRec) return aRec ? -1 : 1;
    if ((a as any).relevant !== (b as any).relevant) return (a as any).relevant ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
  const completedFromRecs = deduped.filter((it) => isCompleted(it) && !isDismissed(it));
  const completedExtra = completedItems.filter((it) => {
    const t = (it.title || '').toString().toLowerCase();
    return t && !deduped.some((ri) => ri.title.toString().toLowerCase() === t) && !dismissedTitles.includes(t);
  });

  const markDone = async (title: string, action_id?: string) => {
    try {
      await fetch('/api/actions/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, title, action_id }) });
      // Optimistically update
      setCompletedTitles((prev) => Array.from(new Set([...prev, title.toLowerCase()])));
      if (action_id) setCompletedIds((prev) => Array.from(new Set([...prev, action_id])));
      setCompletedItems((prev) => [{ id: Math.random().toString(36).slice(2), title, completed_at: new Date().toISOString() }, ...prev]);
    } catch {}
  };

  const dismiss = async (title: string, action_id?: string) => {
    try {
      await fetch('/api/actions/dismiss', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId, title, action_id }) });
      setDismissedTitles((prev) => Array.from(new Set([...prev, title.toLowerCase()])));
      if (action_id) setDismissedIds((prev) => Array.from(new Set([...prev, action_id])));
    } catch {}
  };

  const Item = ({
    action_id, title, how, relevant, reason, completed,
  }: { action_id?: string; title: string; how: any; relevant: boolean; reason: string; completed?: boolean }) => (
    <div className={`border rounded-md p-2 ${relevant ? 'bg-white' : 'bg-gray-50'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${relevant ? 'text-gray-800' : 'text-gray-500'}`}>
            {title} {recIds.has(action_id || '') ? (<span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">Recommended</span>) : null}
            {completed && <span className="ml-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">Completed</span>}
          </div>
          {/* Temporary relevance reason for robustness testing */}
          <div className={`text-[11px] mt-0.5 ${relevant ? 'text-gray-600' : 'text-gray-500'}`}>{reason}</div>
          {how && (
            <div className="text-[11px] text-gray-800 mt-1">
              {Array.isArray(how) ? (
                <ul className="list-disc pl-4 space-y-0.5">{how.map((h: any, j: number) => <li key={j}>{String(h)}</li>)}</ul>
              ) : String(how)}
            </div>
          )}
        </div>
        <div className="shrink-0 flex flex-col gap-1">
          {!completed ? (
            <>
              <button
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => {
                  const prompt = typeof how === 'string' ? how : Array.isArray(how) ? how.join('\n') : title;
                  const text = `Can you help me with: ${title}?\n${prompt}`;
                  try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text } })); } catch {}
                }}
              >
                Open in chat
              </button>
              <button
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => markDone(title, action_id)}
              >
                Mark done
              </button>
              <button
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => dismiss(title, action_id)}
                title="Remove from plan"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
              onClick={() => {
                const text = `I completed: ${title}. What should I do next?`;
                try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text } })); } catch {}
              }}
            >
              Ask what’s next
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if ((!uncompleted || uncompleted.length === 0) && (!completedFromRecs || completedFromRecs.length === 0) && (!completedExtra || completedExtra.length === 0)) {
    return <div className="text-sm text-gray-500">No actions yet. Provide more info in chat to unlock your plan.</div>;
  }

  const removeAllCompleted = async () => {
    const pairs: Array<{title: string; action_id?: string}> = [
      ...completedFromRecs.map(r => ({ title: r.title.toString(), action_id: r.action_id })),
      ...completedExtra.map(it => ({ title: (it.title || '').toString() || 'Action', action_id: (it as any)?.action_id })),
    ];
    for (const p of pairs) {
      await dismiss(p.title, p.action_id);
    }
  };

  return (
    <div className="space-y-2">
      {(completedFromRecs.length + completedExtra.length) > 0 && (
        <div className="flex items-center justify-end">
          <button className="text-xs underline text-gray-600 hover:text-gray-800" onClick={removeAllCompleted}>Remove all completed</button>
        </div>
      )}
      {uncompleted.map((r) => (
        <Item key={`u-${r.action_id || r.title}`} action_id={r.action_id} title={r.title} how={(r as any).how} relevant={(r as any).relevant} reason={(r as any).reason} />
      ))}
      {completedFromRecs.map((r) => (
        <Item key={`c-${r.action_id || r.title}`} action_id={r.action_id} title={r.title} how={(r as any).how} relevant={(r as any).relevant} reason={(r as any).reason} completed />
      ))}
      {completedExtra.length > 0 && (
        <div className="pt-1">
          {completedExtra.map((it) => (
            <div key={it.id} className="border rounded-md p-2 bg-white flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">{it.title || 'Action'}</div>
                <div className="text-[11px] text-gray-500">{it.completed_at ? (
                  <time suppressHydrationWarning dateTime={it.completed_at}>
                    {new Date(it.completed_at).toLocaleString('en-US', { timeZone: 'UTC' })}
                  </time>
                ) : ''}</div>
              </div>
              <button
                className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => {
                  const text = `I completed: ${it.title}. What should I do next?`;
                  try { window.dispatchEvent(new CustomEvent('pp:open_chat', { detail: { text } })); } catch {}
                }}
              >
                Ask what’s next
              </button>
              <button
                className="ml-2 text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
                onClick={() => dismiss(it.title || '')}
                title="Remove from plan"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ProgressInsights({ kpis }: { kpis: any }) {
  const items: { text: string; priority: number }[] = [];
  const add = (text: string, priority = 0) => items.push({ text, priority });
  const safeFmt = (v: any, kind: 'pct'|'months'|'num'|'ratio' = 'num') => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    if (kind === 'pct') return fmtPct(n);
    if (kind === 'months') return `${(Math.round(n * 10) / 10).toFixed(1)} months`;
    if (kind === 'ratio') return String(Math.round(n * 100) / 100);
    return String(Math.round(n));
  };

  const sr = Number(kpis?.sr);
  if (Number.isFinite(sr)) {
    if (sr >= 0.2) add(`Great saving habit: you’re saving ${safeFmt(sr, 'pct')} of income (target ≥ 20%).`, 1);
    else add(`You’re saving ${safeFmt(sr, 'pct')} of income. Aim for ≥ 20% by automating a payday transfer or trimming one recurring expense.`, 3);
  }

  const ef = Number(kpis?.ef_months);
  if (Number.isFinite(ef)) {
    if (ef >= 3) add(`Emergency buffer looks solid: about ${safeFmt(ef, 'months')}.`, 1);
    else add(`Emergency buffer is about ${safeFmt(ef, 'months')}. Build toward 3 months by parking cash in a high‑interest account.`, 3);
  }

  const hr = Number(kpis?.hr);
  if (Number.isFinite(hr)) {
    if (hr <= 0.4) add(`Housing costs look reasonable at ${safeFmt(hr, 'pct')} of income.`, 1);
    else add(`Housing takes about ${safeFmt(hr, 'pct')} of income. Try lowering utilities/insurance or refinancing to reduce this toward 40%.`, 2);
  }

  const dsr = Number(kpis?.dsr_total);
  if (Number.isFinite(dsr)) {
    if (dsr <= 0.2) add(`Debt payments are manageable at ${safeFmt(dsr, 'pct')} of income.`, 1);
    else add(`Debt payments are about ${safeFmt(dsr, 'pct')} of income. Consider a payoff plan or consolidation to get under 20%.`, 3);
  }

  const dti = Number(kpis?.dti_stock);
  if (Number.isFinite(dti)) {
    if (dti <= 0.35) add(`Overall debt level (vs income) is healthy.`, 1);
    else add(`Debt vs income is a bit high. Avoid new debt and focus extra cash on balances.`, 2);
  }

  const rrr = Number(kpis?.rrr);
  if (Number.isFinite(rrr)) {
    if (rrr >= 0.6) add(`Retirement track is on course — keep contributions steady.`, 1);
    else add(`Retirement track needs a boost. Increase contributions slightly or capture employer match.`, 2);
  }

  const invnw = Number(kpis?.invnw);
  if (Number.isFinite(invnw)) {
    if (invnw >= 0.4) add(`Good share of wealth is invested toward goals.`, 1);
    else add(`Consider moving idle cash (beyond emergency fund) into long‑term investments to grow faster.`, 2);
  }

  const pensionPct = Number(kpis?.pension_contrib_pct);
  if (Number.isFinite(pensionPct)) {
    if (pensionPct >= 0.1) add(`Retirement contributions are healthy at ${safeFmt(pensionPct, 'pct')}.`, 1);
    else add(`Retirement contributions are ${safeFmt(pensionPct, 'pct')}. Try nudging toward 10% over time.`, 2);
  }

  const d_to_a = Number(kpis?.d_to_a);
  if (Number.isFinite(d_to_a)) {
    if (d_to_a <= 0.6) add(`Balance sheet looks stable: debt vs assets is in a safe range.`, 1);
    else add(`Debt vs assets is a bit high. Reducing balances or increasing savings will improve resilience.`, 2);
  }

  const top = items
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  return (
    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
      {top.length === 0 ? (
        <li className="text-gray-500">We’ll summarize insights here as your data grows.</li>
      ) : (
        top.map((it, i) => <li key={i}>{it.text}</li>)
      )}
    </ul>
  );
}

function UserDataCard({ latest, currency }: { latest: Snapshot | null; currency: string }) {
  const inputs = (latest as any)?.inputs || {};
  const slots = inputs?.slots || {};
  const val = (key: string) => slots?.[key]?.value ?? inputs?.[key] ?? null;
  // Dropdown options for non-numerical fields to improve data quality
  const OPTIONS: Record<string, { value: any; label: string }[]> = {
    employment_status: [
      { value: 'employed', label: 'Employed' },
      { value: 'self_employed', label: 'Self‑employed' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'unemployed', label: 'Unemployed' },
      { value: 'retired', label: 'Retired' },
      { value: 'other', label: 'Other' },
    ],
    housing_status: [
      { value: 'own', label: 'Own' },
      { value: 'rent', label: 'Rent' },
      { value: 'other', label: 'Other' },
    ],
    home_insured_ok: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
    income_protection_has: [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ],
  };

  // Short help tooltips for each field
  const HELP: Record<string, string> = {
    dependants_count: 'People financially dependent on you (children or others).',
    birth_year: 'Your birth year (YYYY).',
    employment_status: 'Your current work status helps personalize recommendations.',
    housing_status: 'Whether you own or rent your home.',
    net_income_monthly_self: 'Your monthly take‑home pay after tax.',
    net_income_monthly_partner: 'Partner’s monthly take‑home pay after tax.',
    gross_income_annual_self: 'Your yearly income before tax.',
    gross_income_annual_partner: 'Partner’s yearly income before tax.',
    essential_expenses_monthly: 'Monthly essentials (food, utilities, transport).',
    total_expenses_monthly: 'All monthly expenses including essentials, housing and debt.',
    rent_monthly: 'Monthly rent, if you rent.',
    mortgage_payment_monthly: 'Monthly mortgage payment (principal + interest).',
    cash_liquid_total: 'Cash you can access quickly (transaction/savings).',
    term_deposits_le_3m: 'Term deposits or fixed savings maturing within 3 months.',
    other_debt_payments_monthly_total: 'Required monthly payments on loans/credit cards (ex‑mortgage).',
    other_debt_balances_total: 'Total balance across loans/credit cards (ex‑mortgage).',
    short_term_liabilities_12m: 'Bills/obligations due within 12 months.',
    mortgage_balance: 'Outstanding balance on your mortgage.',
    debts_total: 'If you prefer, enter total liabilities instead of itemizing.',
    credit_score_normalised_0_1: 'Credit score normalized 0–1. Leave blank if unsure.',
    home_insured_ok: 'Is your home insured for a reasonable rebuild cost?',
    life_insurance_sum: 'Total life insurance sum insured for your household.',
    income_protection_has: 'Do you have income protection insurance in place?',
    ip_monthly_benefit: 'Monthly income protection benefit amount, if applicable.',
    sick_pay_months_full: 'Months your employer pays full salary if off sick.',
    sick_pay_months_half: 'Months your employer pays half salary after full pay ends.',
    investments_ex_home_total: 'Investments excluding your home (shares, funds, etc.).',
    home_value: 'Approximate current market value of your home.',
    assets_total: 'If you prefer, enter total assets instead of itemizing.',
    pension_balance_total: 'Total balances in retirement/pension accounts.',
    pension_contrib_pct: 'Your contribution to retirement as % of gross pay.',
    retire_age: 'Age you plan to retire.',
    retire_target_income_annual: 'Target yearly income in retirement before tax.',
    state_pension_est_annual: 'Estimated yearly state pension at retirement.',
  };
  const groups: { title: string; items: { key: string; label: string; kind: 'money'|'percent'|'number'|'text'|'bool'; required?: boolean }[] }[] = [
    {
      title: 'Personal Details',
      items: [
        { key: 'dependants_count', label: 'Dependants', kind: 'number' },
        { key: 'birth_year', label: 'Birth year', kind: 'number' },
        { key: 'employment_status', label: 'Employment status', kind: 'text' },
        { key: 'housing_status', label: 'Housing status', kind: 'text' },
      ],
    },
    {
      title: 'Spend (income & expenses)',
      items: [
        { key: 'net_income_monthly_self', label: 'Net income (you) / mo', kind: 'money', required: true },
        { key: 'net_income_monthly_partner', label: 'Net income (partner) / mo', kind: 'money' },
        { key: 'gross_income_annual_self', label: 'Gross income (you) / yr', kind: 'money', required: true },
        { key: 'gross_income_annual_partner', label: 'Gross income (partner) / yr', kind: 'money' },
        { key: 'essential_expenses_monthly', label: 'Essentials / mo', kind: 'money', required: true },
        { key: 'total_expenses_monthly', label: 'Total expenses / mo', kind: 'money' },
        { key: 'rent_monthly', label: 'Rent / mo', kind: 'money' },
        { key: 'mortgage_payment_monthly', label: 'Mortgage payment / mo', kind: 'money' },
      ],
    },
    {
      title: 'Save (cash & deposits)',
      items: [
        { key: 'cash_liquid_total', label: 'Quick‑access cash', kind: 'money', required: true },
        { key: 'term_deposits_le_3m', label: 'Term deposits (≤ 3m)', kind: 'money' },
      ],
    },
    {
      title: 'Borrow (debts & credit)',
      items: [
        { key: 'other_debt_payments_monthly_total', label: 'Debt payments / mo', kind: 'money', required: true },
        { key: 'other_debt_balances_total', label: 'Other debt balances (total)', kind: 'money' },
        { key: 'short_term_liabilities_12m', label: 'Short‑term liabilities (≤12m)', kind: 'money' },
        { key: 'mortgage_balance', label: 'Mortgage balance', kind: 'money' },
        { key: 'debts_total', label: 'Total liabilities (override)', kind: 'money' },
        { key: 'credit_score_normalised_0_1', label: 'Credit score (0–1)', kind: 'number' },
      ],
    },
    {
      title: 'Protect (insurances)',
      items: [
        { key: 'home_insured_ok', label: 'Home insured adequately', kind: 'bool' },
        { key: 'life_insurance_sum', label: 'Life insurance sum', kind: 'money' },
        { key: 'income_protection_has', label: 'Income protection in place', kind: 'bool' },
        { key: 'ip_monthly_benefit', label: 'Income protection monthly benefit', kind: 'money' },
        { key: 'sick_pay_months_full', label: 'Sick pay (full months)', kind: 'number' },
        { key: 'sick_pay_months_half', label: 'Sick pay (half months)', kind: 'number' },
      ],
    },
    {
      title: 'Grow (investments & retirement)',
      items: [
        { key: 'investments_ex_home_total', label: 'Investments (ex‑home)', kind: 'money' },
        { key: 'home_value', label: 'Home value', kind: 'money' },
        { key: 'assets_total', label: 'Total assets (override)', kind: 'money' },
        { key: 'pension_balance_total', label: 'Pension balance', kind: 'money' },
        { key: 'pension_contrib_pct', label: 'Pension contribution %', kind: 'percent' },
        { key: 'retire_age', label: 'Planned retire age', kind: 'number' },
        { key: 'retire_target_income_annual', label: 'Target retirement income / yr', kind: 'money' },
        { key: 'state_pension_est_annual', label: 'State pension estimate / yr', kind: 'money' },
      ],
    },
  ];
  // Also map common MQS fallbacks for “Required” items
  const mqsFallbackMap: Record<string, string> = {
    net_income_monthly_self: 'income_net_monthly',
    gross_income_annual_self: 'income_gross_monthly', // will be monthly; still useful
    essential_expenses_monthly: 'essentials_monthly',
    other_debt_payments_monthly_total: 'debt_required_payments_monthly',
    cash_liquid_total: 'emergency_savings_liquid',
    rent_monthly: 'housing_total_monthly',
  };
  const displayVal = (itemKey: string) => {
    // Prefer slot; then inputs; then MQS fallback
    const primary = val(itemKey);
    if (primary != null) return primary;
    const fbKey = mqsFallbackMap[itemKey];
    if (fbKey) return inputs?.[fbKey] ?? null;
    return null;
  };
  const fmtAny = (kind: string, value: any) => {
    if (value == null) return '—';
    if (kind === 'percent') return fmtPct(Number(value));
    if (kind === 'money') return fmtCurrency(Number(value), currency);
    if (kind === 'bool') return value === true ? 'Yes' : value === false ? 'No' : 'Unknown';
    return String(value);
  };
  const [editing, setEditing] = React.useState<{ key: string; label: string; kind: string; value: string } | null>(null);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [openHelpKey, setOpenHelpKey] = React.useState<string | null>(null);
  const startEdit = (label: string, key: string, kind: string, current: any) => {
    const initial = current != null ? String(current) : '';
    setEditing({ key, label, kind, value: initial });
  };
  const saveEdit = async () => {
    if (!editing) return;
    setSavingKey(editing.key);
    try {
      const res = await fetch('/api/prosper/update-input', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: editing.key, value: editing.value, kind: editing.kind })
      });
      await res.json();
      try { window.dispatchEvent(new CustomEvent('pp:snapshot_saved', { detail: { update: editing.key } })); } catch {}
      setEditing(null);
    } catch {}
    setSavingKey(null);
  };
  return (
    <div className="space-y-3" onClick={() => setOpenHelpKey(null)}>
      <div className="text-[11px] text-gray-500">Fields marked <span className="text-red-600 font-semibold">*</span> are required for best results.</div>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">{group.title}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {group.items.map((it) => {
        const v = displayVal(it.key);
        const isMissing = v == null || v === '' || Number.isNaN(Number(v)) && it.kind !== 'text' && it.kind !== 'bool';
        const labelExtra = it.required && isMissing ? (
          <span className="ml-1 text-[10px] uppercase bg-red-100 text-red-800 px-1 py-0.5 rounded">Required</span>
        ) : null;
        return (
          <div key={it.key} className={`relative border rounded-md p-2 ${isMissing ? 'bg-gray-50' : 'bg-white'}`}>
            {/* Help icon: fixed top-right position */}
            <button
              type="button"
              className="absolute top-1.5 right-1.5 h-4 w-4 inline-flex items-center justify-center rounded-full border text-gray-500 hover:bg-gray-50 text-[10px] leading-none"
              aria-label={`Help: ${it.label}`}
              aria-expanded={openHelpKey === it.key}
              onClick={(e) => { e.stopPropagation(); setOpenHelpKey(k => k === it.key ? null : it.key); }}
            >
              ?
            </button>
            {/* Popover tooltip */}
            {openHelpKey === it.key && (
              <div className="absolute top-7 right-2 z-20 w-64 bg-white border rounded-md shadow-md p-2 text-xs text-gray-700" onClick={(e) => e.stopPropagation()}>
                {(HELP as any)?.[it.key] || 'Help'}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pr-7">
              <div>
                <div className="text-xs text-gray-600 flex items-center gap-1">
                  <span>{it.label}{it.required ? <span className="text-red-600 text-sm font-semibold ml-0.5" aria-hidden="true">*</span> : null}</span>
                  {labelExtra}
                </div>
                <div className={`text-sm font-medium ${isMissing ? 'text-gray-400' : 'text-gray-800'}`}>{fmtAny(it.kind, v)}</div>
              </div>
              <button className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50 shrink-0" onClick={(e) => { e.stopPropagation(); startEdit(it.label, it.key, it.kind, v); }}>
                {isMissing ? 'Add' : 'Edit'}
              </button>
            </div>
          </div>
        );
      })}
          </div>
        </div>
      ))}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border shadow-lg w-full max-w-sm p-4">
            <div className="text-sm font-medium text-gray-900">{editing.label}</div>
            <div className="text-xs text-gray-600 mb-2">{(HELP as any)?.[editing.key] || 'Enter a value.'}</div>
            {(OPTIONS as any)?.[editing.key] ? (
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={editing.value}
                onChange={(e) => setEditing(s => s ? { ...s, value: e.target.value } : s)}
                autoFocus
              >
                <option value="">Select…</option>
                {(OPTIONS as any)[editing.key].map((opt: any) => (
                  <option key={String(opt.value)} value={String(opt.value)}>{opt.label}</option>
                ))}
              </select>
            ) : editing.kind === 'bool' ? (
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={editing.value}
                onChange={(e) => setEditing(s => s ? { ...s, value: e.target.value } : s)}
                autoFocus
              >
                <option value="">Select…</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={editing.value}
                onChange={(e) => setEditing(s => s ? { ...s, value: e.target.value } : s)}
                placeholder={editing.kind === 'percent' ? 'e.g., 10%' : 'Enter value'}
                autoFocus
              />
            )}
            <div className="mt-3 flex justify-end gap-2">
              <button className="text-xs px-3 py-1.5 rounded border bg-white hover:bg-gray-50" onClick={() => setEditing(null)}>Cancel</button>
              <button className="text-xs px-3 py-1.5 rounded border bg-gray-900 text-white hover:bg-gray-800" onClick={saveEdit} disabled={savingKey === editing.key}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Removed unused components: CompletedActions, MomentumStreak, SortedV2Kpis

function RangeNetWorth({ series, latest, currency }: { series: SeriesPoint[]; latest: Snapshot | null; currency: string }) {
  const [range, setRange] = React.useState<'1m'|'3m'|'1y'|'all'>('3m');
  const trajectory = React.useMemo(() => {
    if (!series?.length) return 'flat';
    const last = series[series.length-1]?.value ?? 0;
    const prev = series.length > 1 ? series[series.length-2]?.value ?? 0 : 0;
    if (!Number.isFinite(last) || !Number.isFinite(prev)) return 'flat';
    if (last > prev) return 'up';
    if (last < prev) return 'down';
    return 'flat';
  }, [series]);
  const filtered = React.useMemo(() => {
    if (!series?.length) return [] as SeriesPoint[];
    if (range === 'all') return series;
    const now = new Date(series[series.length-1].ts).getTime();
    const delta = range === '1m' ? 30 : range === '3m' ? 90 : 365;
    return series.filter(p => {
      const t = new Date(p.ts).getTime();
      return (now - t) <= delta*24*60*60*1000;
    });
  }, [series, range]);

  // Compute a simple assets vs liabilities breakdown from the latest inputs
  const breakdown = React.useMemo(() => {
    try {
      const slots = (latest as any)?.inputs?.slots;
      if (!slots) return null;
      const norm = normaliseSlots(slots as any);
      const assets = typeof norm.total_assets === 'number' ? norm.total_assets : null;
      const debts = typeof norm.total_liabilities === 'number' ? norm.total_liabilities : null;
      const nw = typeof norm.net_worth === 'number' ? norm.net_worth : (assets != null && debts != null ? assets - debts : null);
      return { assets, debts, nw } as { assets: number | null; debts: number | null; nw: number | null };
    } catch {
      return null;
    }
  }, [latest]);

  return (
    <div>
      <div className="text-[11px] text-gray-600 mb-1">
        Trajectory: {trajectory === 'up' ? <span className="text-emerald-600">Up ▲</span> : trajectory === 'down' ? <span className="text-red-600">Down ▼</span> : 'Flat'}
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
        {(['1m','3m','1y','all'] as const).map(r => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2 py-1 rounded border ${range===r ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}
          >
            {r.toUpperCase()}
          </button>
        ))}
      </div>
      <Sparkline points={filtered} />

      {breakdown && (breakdown.assets != null || breakdown.debts != null) && (
        <div className="mt-3">
          <div className="text-[11px] text-gray-600 mb-1">Assets vs liabilities</div>
          {/* Stacked bar: red portion shows liabilities as a share of assets; green is equity portion. */}
          {typeof breakdown.assets === 'number' && breakdown.assets > 0 ? (
            <div className="w-full h-4 rounded bg-gray-200 overflow-hidden" aria-label="Assets and liabilities breakdown">
              {(() => {
                const assets = breakdown.assets as number;
                const debts = Math.max(0, (breakdown.debts as number) || 0);
                const debtPct = Math.min(1, debts / Math.max(assets, 1e-9));
                const equityPct = Math.max(0, 1 - debtPct);
                return (
                  <div className="w-full h-full flex">
                    <div className="h-full" style={{ width: `${Math.round(debtPct * 100)}%`, backgroundColor: '#ef4444' }} title={`Liabilities: ${fmtCurrency(debts, currency)}`} />
                    <div className="h-full" style={{ width: `${Math.round(equityPct * 100)}%`, backgroundColor: '#10b981' }} title={`Equity: ${fmtCurrency(Math.max(assets - debts, 0), currency)}`} />
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-[11px] text-gray-500">Add assets and debts to see a breakdown.</div>
          )}
          <div className="mt-1 text-[11px] text-gray-700 flex items-center gap-3">
            <span>Assets: <b>{typeof breakdown.assets === 'number' ? fmtCurrency(breakdown.assets, currency) : '—'}</b></span>
            <span>• Liabilities: <b>{typeof breakdown.debts === 'number' ? fmtCurrency(Math.max(breakdown.debts, 0), currency) : '—'}</b></span>
            <span>• Net worth: <b>{typeof breakdown.nw === 'number' ? fmtCurrency(breakdown.nw, currency) : '—'}</b></span>
          </div>
        </div>
      )}
    </div>
  );
}

/** KPI Grid with pillar filters */
function KpiGrid({ kpis }: { kpis: any }) {
  const [filter, setFilter] = React.useState<'all'|'spend'|'save'|'borrow'|'protect'|'grow'>('all');
  const specs = [
    { label: 'Savings rate', key: 'sr', value: kpis?.sr, target: 0.20, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 20%', tooltip: 'Shows cash left after expenses to fund goals.', pillar: 'save' },
    { label: 'Emergency buffer', key: 'ef_months', value: kpis?.ef_months, target: 3, dir: 'higher' as const, format: 'months' as const, subtitle: 'Target ≥ 3 months (aim 6)', tooltip: 'Months your essentials are covered by cash.', pillar: 'save' },
    { label: 'Housing costs (of income)', key: 'hr', value: kpis?.hr, target: 0.40, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 40% (aim 35%)', tooltip: 'Checks housing isn’t over‑stretching income.', pillar: 'spend' },
    { label: 'Debt payments (of income)', key: 'dsr_total', value: kpis?.dsr_total, target: 0.20, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 20%', tooltip: 'Total debt payment pressure.', pillar: 'borrow' },
    { label: 'Non‑mortgage debt payments', key: 'nmdsr', value: kpis?.nmdsr, target: 0.10, dir: 'lower' as const, format: 'pct' as const, subtitle: 'Target ≤ 10%', tooltip: 'Focus on credit cards and loans (not mortgage).', pillar: 'borrow' },
    { label: 'Total debt vs income', key: 'dti_stock', value: kpis?.dti_stock, target: 0.35, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.35', tooltip: 'Total debt compared to annual income.', pillar: 'borrow' },
    { label: 'Debts vs assets', key: 'd_to_a', value: kpis?.d_to_a, target: 0.60, dir: 'lower' as const, format: 'ratio' as const, subtitle: 'Target ≤ 0.60', tooltip: 'How your debts compare to your assets.', pillar: 'borrow' },
    { label: 'Retirement readiness', key: 'rrr', value: kpis?.rrr, target: 0.60, dir: 'higher' as const, format: 'ratio' as const, subtitle: 'Target ≥ 0.60 (aim 1.00)', tooltip: 'Are you on track for your target retirement income?', pillar: 'grow' },
    { label: 'Investable share of net worth', key: 'invnw', value: kpis?.invnw, target: 0.40, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 40%', tooltip: 'Share of wealth working toward long‑term goals.', pillar: 'grow' },
    { label: 'Retirement contributions', key: 'pension_contrib_pct', value: kpis?.pension_contrib_pct, target: 0.10, dir: 'higher' as const, format: 'pct' as const, subtitle: 'Target ≥ 10%', tooltip: 'Your regular saving toward retirement.', pillar: 'grow' },
  ];
  const urgency = (v: number | null | undefined, t: number, dir: 'higher'|'lower') => {
    if (!Number.isFinite(v as number)) return -1;
    const n = v as number;
    return dir === 'higher' ? (n >= t ? 0 : (t - n) / Math.max(t, 1e-9)) : (n <= t ? 0 : (n - t) / Math.max(t, 1e-9));
  };
  const sorted = specs.sort((a, b) => (urgency(b.value, b.target, b.dir) - urgency(a.value, a.target, a.dir)));
  const filtered = filter === 'all' ? sorted : sorted.filter(s => s.pillar === filter);
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-600 font-medium">Key metrics</div>
        <div className="text-xs text-gray-500">Sorted by urgency</div>
      </div>
      <div className="flex flex-wrap gap-2 mb-3 text-xs">
        {(['all','spend','save','borrow','protect','grow'] as const).map(p => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-2 py-1 rounded border ${filter===p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'}`}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(s => (
          <div id={`kpi-${s.key}`} key={s.key}>
            <V2KpiBar label={s.label} value={s.value} target={s.target} dir={s.dir} format={s.format} subtitle={s.subtitle} tooltip={s.tooltip} />
          </div>
        ))}
      </div>
    </div>
  );
}

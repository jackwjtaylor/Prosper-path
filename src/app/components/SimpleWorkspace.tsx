"use client";
import React from 'react';
import Link from 'next/link';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { makeRealtimeAgent, realtimeOnlyCompanyName } from '@/app/agentConfigs/realtimeOnly';
import { createModerationGuardrail } from '@/app/agentConfigs/guardrails';
import { useAppStore } from '@/app/state/store';
import { useOnboardingStore } from '@/app/state/onboarding';
import type { AgeDecade, TonePreference } from '@/app/state/onboarding';
import { ensureHouseholdId } from '@/app/lib/householdLocal';
import Sparkline from '@/app/components/ui/Sparkline';
import LevelPill from '@/app/components/ui/LevelPill';
import { getProsperLevelLabel } from '@/app/lib/prosperLevelLabels';

type SlotVal = number | string | boolean | null;

type TrendPoint = { ts?: string; value: number };

type DashboardSummary = {
  latestSnapshot?: { inputs?: any; kpis?: Record<string, any> | null; levels?: any } | null;
  kpis?: Record<string, any> | null;
  levels?: any;
  series?: TrendPoint[];
};

type TabKey = 'plan' | 'health' | 'data';

type HealthMetric = {
  key: string;
  label: string;
  value: number | null;
  target: number;
  direction: 'higher' | 'lower';
  format: 'pct' | 'months' | 'ratio';
  description: string;
  subtitle: string;
};

const TAB_INTRO: Record<TabKey, string> = {
  plan: 'Here’s your Prosper Path. Start with actions that unlock your next level.',
  health: 'See whats going well & where you could improve your money health.',
  data: 'Check and update the details Prosper uses to tailor your plan.',
};

const AGE_OPTIONS: AgeDecade[] = ['unspecified', '20s', '30s', '40s', '50s', '60s', '70s', '80s', '90s', '100s'];

const TONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unspecified', label: 'No preference' },
  { value: 'straight', label: 'Straight-talk' },
  { value: 'relaxed', label: 'Laid back' },
];

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function WorkspaceTabs({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  const tabs: Array<{ key: TabKey; label: string; caption: string }> = [
    { key: 'plan', label: 'Plan', caption: '' },
    { key: 'health', label: 'Health', caption: '' },
    { key: 'data', label: 'Data', caption: '' },
  ];
  return (
    <div className="flex items-center gap-2 text-[11px] md:text-xs">
      {tabs.map((tab, idx) => {
        const isActive = tab.key === active;
        return (
          <React.Fragment key={tab.key}>
            <button
              type="button"
              onClick={() => onChange(tab.key)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white/70 ${
                isActive
                  ? 'border-white/60 bg-white/10 text-white'
                  : 'border-white/20 bg-white/5 text-white/70 hover:text-white/90'
              }`}
            >
              <span className="font-medium tracking-wide uppercase md:normal-case md:tracking-normal">{tab.label}</span>
              <span className="hidden md:inline opacity-70">{tab.caption}</span>
            </button>
            {idx < tabs.length - 1 && <span className="opacity-30">•</span>}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function VoicePanel() {
  const sessionStatus = useAppStore((s) => s.sessionStatus);
  const isMicMuted = useAppStore((s) => s.isMicMuted);
  const setIsMicMuted = useAppStore((s) => s.setIsMicMuted);
  const connected = sessionStatus === 'CONNECTED';
  const connecting = sessionStatus === 'CONNECTING';

  const toggleConnection = () => {
    try { window.dispatchEvent(new CustomEvent('pp:toggle_connection')); } catch {}
  };

  const status = connecting
    ? 'Connecting to Prosper…'
    : connected
      ? (isMicMuted ? 'Voice connected — mic muted' : 'Voice connected and listening')
      : 'Talk to Prosper about your plan';

  return (
    <div className="mt-5">
      <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-[11px] md:text-xs text-white/80">
        <span className="text-white/70">{status}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleConnection}
            disabled={connecting}
            className={`btn text-[11px] md:text-xs disabled:opacity-60 ${connected ? 'btn-active !bg-emerald-500/25 !border-emerald-300 text-white' : 'hover:bg-white/15'}`}
          >
            {connected ? 'Disconnect' : connecting ? 'Connecting…' : 'Connect voice'}
          </button>
          <button
            type="button"
            onClick={() => connected && setIsMicMuted(!isMicMuted)}
            disabled={!connected}
            className={`btn text-[11px] md:text-xs disabled:opacity-60 ${
              !connected
                ? 'opacity-60'
                : isMicMuted
                  ? '!bg-red-500/20 !border-red-400/60 text-white'
                  : '!bg-emerald-500/25 !border-emerald-300 text-white'
            }`}
            title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMicMuted ? 'Unmute' : 'Mute mic'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DataSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:p-5">
      <div>
        <div className="text-sm font-medium text-white">{title}</div>
        {description && <div className="text-xs text-white/70 mt-1">{description}</div>}
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function PersonaBanner() {
  const persona = useOnboardingStore((s) => s.persona);
  const chips: string[] = [];
  if (persona.ageDecade && persona.ageDecade !== 'unspecified') chips.push(persona.ageDecade);
  if (persona.city && persona.country) chips.push(`${persona.city}, ${persona.country}`);
  else if (persona.country) chips.push(persona.country);
  if (typeof persona.partner === 'boolean') chips.push(persona.partner ? 'Partnered' : 'Solo');
  if (typeof persona.childrenCount === 'number') chips.push(persona.childrenCount === 1 ? '1 child' : `${persona.childrenCount} children`);
  if (persona.tone && persona.tone !== 'unspecified') chips.push(persona.tone === 'straight' ? 'Straight‑talk' : 'Laid back');
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c, i) => (<Chip key={i}>{c}</Chip>))}
    </div>
  );
}

export default function SimpleWorkspace() {
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const updatePersona = useOnboardingStore((s) => s.updatePersona);
  const selectedVoice = useAppStore((s) => s.voice);
  const [activeTab, setActiveTab] = React.useState<TabKey>('plan');
  const [householdId, setHouseholdId] = React.useState<string>('');
  const [dashboardData, setDashboardData] = React.useState<DashboardSummary | null>(null);
  React.useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);
  // Reveal animation on first mount (fade + gentle lift)
  const [animateIn, setAnimateIn] = React.useState(false);
  React.useEffect(() => {
    const t = setTimeout(() => setAnimateIn(true), 60);
    return () => clearTimeout(t);
  }, []);

  // Snapshot fields (minimal set to compute)
  const [netIncomeSelf, setNetIncomeSelf] = React.useState<string>('');
  const [hasPartner, setHasPartner] = React.useState<boolean>(!!persona.partner);
  const [netIncomePartner, setNetIncomePartner] = React.useState<string>('');
  const [essentialExp, setEssentialExp] = React.useState<string>('');
  const [housing, setHousing] = React.useState<'rent'|'own'|'other'>('rent');
  const [rent, setRent] = React.useState<string>('');
  const [mortgagePmt, setMortgagePmt] = React.useState<string>('');
  const [cash, setCash] = React.useState<string>('');
  const [debtPmts, setDebtPmts] = React.useState<string>('');
  const [debtTotal, setDebtTotal] = React.useState<string>('');
  const [saving, setSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [unlocked, setUnlocked] = React.useState<Set<string>>(new Set());

  const kpis = React.useMemo(() => {
    const base = dashboardData?.kpis ?? dashboardData?.latestSnapshot?.kpis ?? {};
    return (base || {}) as Record<string, any>;
  }, [dashboardData]);
  const levels = React.useMemo(() => dashboardData?.levels ?? dashboardData?.latestSnapshot?.levels ?? {}, [dashboardData]);

  const trendPoints = React.useMemo(() => {
    const pts = (dashboardData?.series ?? []) as TrendPoint[];
    return pts.filter((p) => Number.isFinite(Number(p?.value)));
  }, [dashboardData]);

  const netWorthValue = React.useMemo(() => {
    if (trendPoints.length) {
      const val = Number(trendPoints[trendPoints.length - 1].value);
      return Number.isFinite(val) ? val : null;
    }
    const fallback = Number((kpis as any)?.net_worth);
    return Number.isFinite(fallback) ? fallback : null;
  }, [trendPoints, kpis]);

  const prevNetWorth = React.useMemo(() => {
    if (trendPoints.length > 1) {
      const val = Number(trendPoints[trendPoints.length - 2].value);
      return Number.isFinite(val) ? val : null;
    }
    return null;
  }, [trendPoints]);

  const netWorthDelta = netWorthValue != null && prevNetWorth != null ? netWorthValue - prevNetWorth : null;
  const netWorthGrowthPct = netWorthValue != null && prevNetWorth != null && Math.abs(prevNetWorth) > 1
    ? (netWorthValue - prevNetWorth) / Math.abs(prevNetWorth)
    : null;

  const currency = React.useMemo(() => {
    const slots = (dashboardData?.latestSnapshot?.inputs?.slots || {}) as Record<string, any>;
    const raw = slots?.currency;
    const slotCurrency = typeof raw === 'object' && raw ? raw.value : raw;
    if (typeof slotCurrency === 'string' && slotCurrency.trim().length) {
      return slotCurrency.trim().slice(0, 3).toUpperCase();
    }
    const country = (persona?.country || '').toLowerCase();
    if (country.includes('united states') || country.includes('usa') || country.includes('america')) return 'USD';
    if (country.includes('australia')) return 'AUD';
    if (country.includes('canada')) return 'CAD';
    if (country.includes('new zealand')) return 'NZD';
    if (country.includes('singapore')) return 'SGD';
    if (country.includes('euro') || country.includes('germany') || country.includes('france') || country.includes('spain') || country.includes('italy')) return 'EUR';
    return 'GBP';
  }, [dashboardData, persona?.country]);

  const fmtCurrency = React.useCallback((value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return '—';
    try {
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value));
    } catch {
      const abs = Math.round(Number(value ?? 0));
      const sym = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'AUD' ? 'A$' : currency === 'CAD' ? 'C$' : currency === 'NZD' ? 'NZ$' : currency === 'SGD' ? 'S$' : '£';
      return `${sym}${abs.toLocaleString()}`;
    }
  }, [currency]);

  const formatCurrencyDelta = React.useCallback((value: number | null) => {
    if (!Number.isFinite(value ?? NaN)) return null;
    const v = Number(value);
    const sign = v >= 0 ? '+' : '−';
    return `${sign}${fmtCurrency(Math.abs(v))}`;
  }, [fmtCurrency]);

  const fmtPct = React.useCallback((value: number | null | undefined) => {
    if (!Number.isFinite(value ?? NaN)) return '—';
    const pct = Math.round(Number(value) * 1000) / 10;
    return `${pct.toFixed(1)}%`;
  }, []);

  const formatPctDelta = React.useCallback((value: number | null) => {
    if (!Number.isFinite(value ?? NaN)) return null;
    const v = Number(value);
    const sign = v >= 0 ? '+' : '−';
    const pct = Math.round(Math.abs(v) * 1000) / 10;
    return `${sign}${pct.toFixed(1)}%`;
  }, []);

  const levelCode = (levels?.overall?.level as string) || 'L1';
  const levelNumber = Number(levelCode.match(/\d+/)?.[0] ?? 1);
  const levelLabel = getProsperLevelLabel(levelCode);
  const nextLevelLabel = getProsperLevelLabel(Math.min(10, levelNumber + 1));

  const healthMetrics = React.useMemo<HealthMetric[]>(() => {
    const read = (key: string) => {
      const raw = Number((kpis as any)?.[key]);
      return Number.isFinite(raw) ? raw : null;
    };
    return [
      { key: 'sr', label: 'Savings rate', value: read('sr'), target: 0.2, direction: 'higher', format: 'pct', description: 'Cash left after essentials.', subtitle: 'Target ≥ 20%' },
      { key: 'ef_months', label: 'Emergency buffer', value: read('ef_months'), target: 3, direction: 'higher', format: 'months', description: 'Months your essentials are covered by cash.', subtitle: 'Aim for ≥ 3 months' },
      { key: 'dsr_total', label: 'Debt payments (of income)', value: read('dsr_total'), target: 0.2, direction: 'lower', format: 'pct', description: 'Total monthly debt payment pressure.', subtitle: 'Keep ≤ 20%' },
      { key: 'dti_stock', label: 'Debt-to-income', value: read('dti_stock'), target: 0.35, direction: 'lower', format: 'ratio', description: 'Total debts compared to annual income.', subtitle: 'Aim ≤ 0.35' },
      { key: 'invnw', label: 'Investable share of net worth', value: read('invnw'), target: 0.4, direction: 'higher', format: 'pct', description: 'Share of wealth invested toward long-term goals.', subtitle: 'Target ≥ 40%' },
      { key: 'rrr', label: 'Retirement readiness', value: read('rrr'), target: 0.6, direction: 'higher', format: 'ratio', description: 'Progress toward retirement income target.', subtitle: 'Aim ≥ 0.60' },
    ];
  }, [kpis]);

  const healthInsights = React.useMemo(() => {
    type Insight = { key: string; title: string; body: string; tone: 'good' | 'focus'; explain: string; missing?: boolean };
    const entries: Insight[] = [];
    const byKey = Object.fromEntries(healthMetrics.map((m) => [m.key, m] as const));
    const sr = byKey['sr'];
    if (sr) {
      if (sr.value == null) {
        entries.push({ key: 'sr-missing', title: 'Add your income to see savings rate', body: 'Log take-home pay and essentials in My Data to unlock this insight.', tone: 'focus', explain: 'Savings rate', missing: true });
      } else if (sr.value >= sr.target) {
        entries.push({ key: 'sr-good', title: 'Savings rate is humming', body: 'You’re setting aside enough each month to hit goals sooner.', tone: 'good', explain: 'Savings rate' });
      } else {
        entries.push({ key: 'sr-focus', title: 'Open up more to save', body: 'Aim for at least 20% of take-home to flow toward goals.', tone: 'focus', explain: 'Savings rate' });
      }
    }
    const ef = byKey['ef_months'];
    if (ef) {
      if (ef.value == null) {
        entries.push({ key: 'ef-missing', title: 'Add your cash to size your buffer', body: 'Enter liquid savings to see how long essentials are covered.', tone: 'focus', explain: 'Emergency fund', missing: true });
      } else if (ef.value >= ef.target) {
        entries.push({ key: 'ef-good', title: 'Emergency fund feels sturdy', body: 'You have enough cash to ride out surprises with confidence.', tone: 'good', explain: 'Emergency fund' });
      } else {
        entries.push({ key: 'ef-focus', title: 'Build a stronger safety buffer', body: 'Grow toward 3 months of essentials to absorb shocks.', tone: 'focus', explain: 'Emergency fund' });
      }
    }
    const debt = byKey['dsr_total'];
    if (debt) {
      if (debt.value == null) {
        entries.push({ key: 'debt-missing', title: 'Add debt payments to track pressure', body: 'Log your monthly repayments to see how heavy they feel.', tone: 'focus', explain: 'Debt payments', missing: true });
      } else if (debt.value <= debt.target) {
        entries.push({ key: 'debt-good', title: 'Debt payments are manageable', body: 'Great — repayments are within a healthy range.', tone: 'good', explain: 'Debt payments' });
      } else {
        entries.push({ key: 'debt-focus', title: 'Debt is taking a big bite', body: 'Trim balances or rates so less than 20% of income goes to debt.', tone: 'focus', explain: 'Debt payments' });
      }
    }
    if (Number.isFinite(netWorthGrowthPct ?? NaN)) {
      const pct = formatPctDelta(netWorthGrowthPct);
      if (pct && (netWorthGrowthPct ?? 0) !== 0) {
        const positive = (netWorthGrowthPct ?? 0) > 0;
        entries.unshift({
          key: 'net-worth-trend',
          title: positive ? 'Net worth is trending up' : 'Net worth dipped a touch',
          body: positive ? `Up ${pct.replace('+', '')} since last check — keep the momentum.` : 'Let’s review spending or debts to nudge it back upward.',
          tone: positive ? 'good' : 'focus',
          explain: 'Net worth trend',
        });
      }
    }
    return entries.slice(0, 3);
  }, [healthMetrics, netWorthGrowthPct, formatPctDelta]);

  const applyDashboard = React.useCallback((payload: DashboardSummary | null) => {
    if (!payload) return;
    const latest = payload.latestSnapshot ?? null;
    const slots = ((latest?.inputs?.slots || {}) as Record<string, any>) || {};
    const slotValue = (key: string) => {
      const raw = slots?.[key];
      if (raw && typeof raw === 'object' && 'value' in raw) return raw.value;
      return raw;
    };
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const updateIfEmpty = (setter: React.Dispatch<React.SetStateAction<string>>, next?: number) => {
      if (typeof next !== 'number') return;
      setter((cur) => (cur === '' ? String(next) : cur));
    };
    const partnerVal = slotValue('partner');
    if (partnerVal != null) {
      const bool = typeof partnerVal === 'boolean' ? partnerVal : partnerVal === 'true' || partnerVal === '1' || partnerVal === 1;
      setHasPartner(Boolean(bool));
    }
    const housingVal = slotValue('housing_status');
    if (housingVal === 'rent' || housingVal === 'own' || housingVal === 'other') {
      setHousing(housingVal);
    }
    updateIfEmpty(setNetIncomeSelf, toNum(slotValue('net_income_monthly_self')));
    updateIfEmpty(setNetIncomePartner, toNum(slotValue('net_income_monthly_partner')));
    updateIfEmpty(setEssentialExp, toNum(slotValue('essential_expenses_monthly')));
    if (housingVal === 'rent') {
      updateIfEmpty(setRent, toNum(slotValue('rent_monthly')));
    }
    if (housingVal === 'own') {
      updateIfEmpty(setMortgagePmt, toNum(slotValue('mortgage_payment_monthly')));
    }
    updateIfEmpty(setCash, toNum(slotValue('cash_liquid_total')));
    updateIfEmpty(setDebtPmts, toNum(slotValue('other_debt_payments_monthly_total')));
    updateIfEmpty(setDebtTotal, toNum(slotValue('other_debt_balances_total')));

    const metrics = (payload.kpis ?? payload.latestSnapshot?.kpis ?? {}) as Record<string, any>;
    const ef = Number(metrics?.ef_months);
    const dti = Number(metrics?.dti_stock);
    const nextUnlocks = new Set<string>();
    if (Number.isFinite(ef) && ef >= 1) nextUnlocks.add('prosper-pots');
    if (Number.isFinite(ef) && ef >= 3) {
      nextUnlocks.add('emergency-fund-3m');
      nextUnlocks.add('invest-automation');
    }
    if (Number.isFinite(ef) && ef >= 3 && (!Number.isFinite(dti) || dti < 0.3)) {
      nextUnlocks.add('invest-long-term');
    }
    setUnlocked(nextUnlocks);
  }, [setNetIncomeSelf, setNetIncomePartner, setEssentialExp, setRent, setMortgagePmt, setCash, setDebtPmts, setDebtTotal, setHasPartner, setHousing]);

  const fetchDashboard = React.useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as DashboardSummary;
      setDashboardData(json);
      applyDashboard(json);
    } catch {}
  }, [householdId, applyDashboard]);

  React.useEffect(() => {
    if (!householdId) return;
    fetchDashboard();
  }, [householdId, fetchDashboard]);

  React.useEffect(() => {
    const onSaved = () => { fetchDashboard(); };
    window.addEventListener('pp:snapshot_saved', onSaved as any);
    return () => window.removeEventListener('pp:snapshot_saved', onSaved as any);
  }, [fetchDashboard]);

  // Lightweight inline voice explain dialog state
  const [explainOpen, setExplainOpen] = React.useState(false);
  const [explainingTitle, setExplainingTitle] = React.useState<string>('');
  const [explainLogs, setExplainLogs] = React.useState<Array<{ speaker: 'assistant'|'user'; text: string }>>([]);
  const [checklist, setChecklist] = React.useState<string[]>([]);
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const [celebrateOn, setCelebrateOn] = React.useState(false);
  const [celebrateKey, setCelebrateKey] = React.useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const coachAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const { status: explainStatus, connect: explainConnect, disconnect: explainDisconnect, sendUserText: explainSendText, sendEvent: explainSendEvent, interrupt: explainInterrupt } = useRealtimeSession({
    onTranscriptDelta: (delta, speaker) => {
      if (!delta || speaker !== 'assistant') return;
      setExplainLogs(prev => {
        const next = [...prev];
        if (!next.length || next[next.length - 1].speaker !== 'assistant') next.push({ speaker: 'assistant', text: '' });
        next[next.length - 1] = { speaker: 'assistant', text: (next[next.length - 1].text + delta) };
        return next;
      });
    },
    onTranscriptCompleted: (text, speaker) => {
      if (!text) return;
      setExplainLogs(prev => [...prev, { speaker, text }]);
    }
  });
  const isExplainingConnected = explainStatus === 'CONNECTED';

  // Coach session to continue voice onboarding on arrival
  const { status: coachStatus, connect: coachConnect, disconnect: coachDisconnect, sendUserText: coachSendText, sendEvent: coachSendEvent, interrupt: coachInterrupt } = useRealtimeSession();
  const isCoachConnected = coachStatus === 'CONNECTED';
  React.useEffect(() => {
    const fromOnboarding = typeof window !== 'undefined' ? (sessionStorage.getItem('pp_simple_coach') === '1') : false;
    if (!fromOnboarding) return;
    (async () => {
      try { sessionStorage.removeItem('pp_simple_coach'); } catch {}
      if (!coachAudioRef.current && typeof window !== 'undefined') {
        const el = document.createElement('audio');
        el.autoplay = true; el.style.display = 'none';
        document.body.appendChild(el);
        coachAudioRef.current = el;
      }
      const getEphemeralKey = async () => {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!data.client_secret?.value) return null;
        return { key: data.client_secret.value as string, model: (data.model as string | undefined) };
      };
      if (!isCoachConnected) {
        try {
          const guardrail = createModerationGuardrail(realtimeOnlyCompanyName);
          await coachConnect({ getEphemeralKey, initialAgents: [makeRealtimeAgent(selectedVoice || 'cedar')], audioElement: coachAudioRef.current!, outputGuardrails: [guardrail] });
          try { coachSendEvent({ type: 'session.update', session: { turn_detection: { type: 'server_vad', threshold: 0.9, prefix_padding_ms: 300, silence_duration_ms: 500, create_response: true } } }); } catch {}
        } catch {}
      }
      try {
        coachInterrupt();
        const orientation = `Please welcome me to the Simple workspace with one short sentence, then give a 2–3 sentence orientation (what's on this page, that we'll fill a few fields and pick two actions), and ask for consent to save my details to update my dashboard. Keep it warm, British English, and very concise.`;
        coachSendText(orientation);
        coachSendEvent({ type: 'response.create' });
      } catch {}
    })();
    // Clean up on unmount
    return () => { try { coachDisconnect(); } catch {} };
  }, []);
  // Support global disconnect
  React.useEffect(() => {
    const onDisc = () => { try { coachDisconnect(); } catch {} };
    window.addEventListener('pp:disconnect_voice', onDisc as any);
    return () => window.removeEventListener('pp:disconnect_voice', onDisc as any);
  }, [coachDisconnect]);
  async function openExplain(title: string) {
    setExplainingTitle(title);
    setExplainOpen(true);
    setExplainLogs([]);
    // Build a short checklist tailored to the action
    const steps = buildChecklist(title);
    setChecklist(steps);
    const init: Record<string, boolean> = {}; steps.forEach((s) => { init[s] = false; });
    setChecked(init);
    // Ask any background voice session to disconnect to avoid overlap
    try { window.dispatchEvent(new CustomEvent('pp:disconnect_voice')); } catch {}
    // Ensure audio element exists
    if (!audioRef.current && typeof window !== 'undefined') {
      const el = document.createElement('audio');
      el.autoplay = true; el.style.display = 'none';
      document.body.appendChild(el);
      audioRef.current = el;
    }
    if (!isExplainingConnected) {
      const getEphemeralKey = async () => {
        const res = await fetch('/api/session');
        const data = await res.json();
        if (!data.client_secret?.value) return null;
        return { key: data.client_secret.value as string, model: (data.model as string | undefined) };
      };
      try {
        const guardrail = createModerationGuardrail(realtimeOnlyCompanyName);
        await explainConnect({ getEphemeralKey, initialAgents: [makeRealtimeAgent(selectedVoice || 'cedar')], audioElement: audioRef.current!, outputGuardrails: [guardrail] });
        try { explainSendEvent({ type: 'session.update', session: { turn_detection: { type: 'server_vad', threshold: 0.9, prefix_padding_ms: 300, silence_duration_ms: 500, create_response: true } } }); } catch {}
      } catch {}
    }
    // Send the explanation prompt
    try {
      const text = `Please explain the action "${title}" in plain language. Cover: what it is, why it matters for improving my finances, and the steps I need to take. Keep it brief and ask me to confirm I’m ready to do it.`;
      explainInterrupt();
      explainSendText(text);
      explainSendEvent({ type: 'response.create' });
    } catch {}
  }

  function closeExplain() {
    setExplainOpen(false);
    try { explainDisconnect(); } catch {}
  }

  const log = async (event: string, extra: Record<string, any> = {}) => {
    try {
      await fetch('/api/feedback/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'analytics', severity: 'low', message: event, extra })
      });
    } catch {}
  };
  React.useEffect(() => { log('simple_enter'); }, []);

  const planeNumber = (v: string): number | null => {
    const n = Number((v || '').replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : null;
  };

  type PlanTile = { id: string; title: string; blurb: string; gated?: boolean; recommended?: boolean; reason?: string };
  const planTiles: PlanTile[] = React.useMemo(() => {
    const tiles: PlanTile[] = [];
    const debtTotalNum = planeNumber(debtTotal) || 0;
    const cashNum = planeNumber(cash) || 0;
    const incomeNum = planeNumber(netIncomeSelf) || 0;
    const partnerIncomeNum = hasPartner ? (planeNumber(netIncomePartner) || 0) : 0;
    const essentialsNum = planeNumber(essentialExp) || 0;
    const monthlyIncome = incomeNum + partnerIncomeNum;
    const minInputs = monthlyIncome > 0 && essentialsNum > 0;
    const suggestEmergency = cashNum < 1000 || (monthlyIncome > 0 && cashNum < monthlyIncome);
    const rentSelected = housing === 'rent';
    const ownSelected = housing === 'own';
    const goal = (persona?.primaryGoal || '').toLowerCase();

    // Always-on foundations
    tiles.push({ id: 'have-the-money-talk', title: 'Have the money talk', blurb: 'A quick chat to align how you want to handle money together. Simple prompts included.', recommended: !!hasPartner });
    tiles.push({ id: 'declutter-finances', title: 'Get your £hit together', blurb: 'Streamline accounts, clean up cards, and find any lost money.', recommended: !hasPartner });
    tiles.push({ id: 'foundations', title: 'Set your foundations', blurb: 'Learn the essentials so choices feel straightforward and calm.' });

    // Conditional starters
    if (debtTotalNum > 0) {
      tiles.push({ id: 'clear-debts', title: 'Clear your unhealthy debts', blurb: 'Lower stress and costs by tackling expensive debts first.', recommended: true, reason: 'You mentioned outstanding debts.' });
    }
    if (suggestEmergency) {
      tiles.push({ id: 'emergency-fund-1', title: 'Build your first emergency fund', blurb: 'Create a soft cushion for life’s surprises.', recommended: debtTotalNum === 0, reason: 'Your cash buffer looks light.' });
    }
    tiles.push({ id: 'manage-expenses', title: 'Manage your expenses', blurb: 'Open up room to save ~20% by re‑tuning spend.', recommended: minInputs && essentialsNum / Math.max(monthlyIncome, 1) > 0.5 });
    tiles.push({ id: 'boost-income', title: 'Boost your income', blurb: 'Practical ideas to nudge earnings without burning out.' });
    // Credit score (always available)
    tiles.push({ id: 'improve-credit', title: 'Improve your credit score', blurb: 'Understand what moves the needle and tidy up your report.' });

    // Home goals
    if (rentSelected) {
      tiles.push({
        id: 'buy-first-home',
        title: 'Buy your first home',
        blurb: 'Plan your deposit, mortgage steps, and a 12‑month path.',
        gated: true,
        recommended: goal.includes('home') || goal.includes('house') || goal.includes('mortgage'),
        reason: goal ? 'You mentioned a home goal.' : undefined,
      });
    }
    if (ownSelected) {
      tiles.push({ id: 'pay-off-home', title: 'Pay off your home', blurb: 'Shave years and thousands off your mortgage.', gated: true });
    }

    // Protection (recommend when family or homeowner)
    const familyOrHome = (typeof persona.childrenCount === 'number' && persona.childrenCount > 0) || !!hasPartner || ownSelected;
    tiles.push({ id: 'insurance-protection', title: 'Protect yourself with insurance', blurb: 'Cover the big wipe‑outs so progress sticks.', gated: !familyOrHome, recommended: familyOrHome, reason: familyOrHome ? undefined : 'We can line this up after your basics.' });

    // Savings progression
    tiles.push({ id: 'emergency-fund-3m', title: 'Increase your emergency fund', blurb: 'Grow your cushion to ~3 months for real security.', gated: !unlocked.has('emergency-fund-3m') });

    // Automation & investing (gate until foundations + cash buffer and no unhealthy debt)
    tiles.push({ id: 'prosper-pots', title: 'Set up your Prosper Pots', blurb: 'Automate your money so good choices happen by default.', gated: !unlocked.has('prosper-pots') });
    tiles.push({ id: 'invest-automation', title: 'Automate your investing', blurb: 'Tax‑efficient, automatic contributions toward long‑term growth.', gated: !unlocked.has('invest-automation') });
    tiles.push({ id: 'invest-long-term', title: 'Invest for long‑term growth', blurb: 'Put your Prosper cash to work steadily over time.', gated: !unlocked.has('invest-long-term') });

    // Recommend at most two
    const recs = tiles.filter(t => t.recommended && !t.gated).slice(0, 2);
    // Preselect up to two
    if (selected.length === 0 && recs.length) setSelected(recs.map(r => r.id));
    return tiles;
  }, [netIncomeSelf, netIncomePartner, hasPartner, essentialExp, rent, mortgagePmt, cash, debtPmts, debtTotal, persona.childrenCount, persona.primaryGoal, housing, unlocked]);

  const selectedTitles = React.useMemo(() => (
    selected
      .map((id) => planTiles.find((tile) => tile.id === id)?.title)
      .filter((title): title is string => Boolean(title))
  ), [selected, planTiles]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const exists = prev.includes(id);
      if (exists) return prev.filter(x => x !== id);
      const next = [...prev, id];
      if (next.length > 2) next.shift();
      log('simple_select_action', { id });
      return next;
    });
  };

  const buildPlan = async () => {
    setSaving(true); setError(null);
    try {
      const slots: Record<string, { value: SlotVal; confidence?: string }> = {};
      const toNum = (v: string) => planeNumber(v);
      if (persona.country) slots['country'] = { value: persona.country };
      if (persona.ageDecade && persona.ageDecade !== 'unspecified') {
        // Approximate birth year by decade midpoint
        const decade = persona.ageDecade.replace('s', '');
        const now = new Date().getUTCFullYear();
        const approxAge = Number(decade) ? Number(decade) + 5 : null;
        const birth = approxAge ? now - approxAge : null;
        if (birth) slots['birth_year'] = { value: birth };
      }
      if (typeof persona.partner === 'boolean') slots['partner'] = { value: persona.partner };
      if (typeof persona.childrenCount === 'number') slots['dependants_count'] = { value: persona.childrenCount };
      const selfInc = toNum(netIncomeSelf); if (selfInc != null) slots['net_income_monthly_self'] = { value: selfInc };
      const partnerInc = toNum(netIncomePartner); if (hasPartner && partnerInc != null) slots['net_income_monthly_partner'] = { value: partnerInc };
      const ess = toNum(essentialExp); if (ess != null) slots['essential_expenses_monthly'] = { value: ess };
      slots['housing_status'] = { value: housing };
      const r = toNum(rent); if (housing === 'rent' && r != null) slots['rent_monthly'] = { value: r };
      const m = toNum(mortgagePmt); if (housing === 'own' && m != null) slots['mortgage_payment_monthly'] = { value: m };
      const c = toNum(cash); if (c != null) slots['cash_liquid_total'] = { value: c };
      const dpm = toNum(debtPmts); if (dpm != null) slots['other_debt_payments_monthly_total'] = { value: dpm };
      const dt = toNum(debtTotal); if (dt != null) slots['other_debt_balances_total'] = { value: dt };

      const res = await fetch('/api/prosper/snapshots', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: { slots, onboarding: { chosen_actions: selected } } }),
      });
      if (res.status === 402) {
        await res.json().catch(() => ({}));
        setError('Free limit reached — please sign in or upgrade to continue.');
      } else if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'Could not build your plan yet.');
      } else {
        log('simple_build_plan', { selected });
        try { await fetchDashboard(); } catch {}
      }
    } catch {
      setError('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  function buildChecklist(title: string): string[] {
    const t = title.toLowerCase();
    if (t.includes('emergency') && t.includes('first')) return [
      'Decide your buffer target (e.g., 1 month of essentials)',
      'Choose where to hold it (easy-access savings)',
      'Set up a monthly transfer amount',
    ];
    if (t.includes('increase your emergency')) return [
      'Confirm new target (≈3 months of essentials)',
      'Schedule or increase the monthly top-up',
      'Review in 60 days to adjust',
    ];
    if (t.includes('clear your unhealthy debts')) return [
      'List balances, APRs, and minimums',
      'Pick a payoff order (highest APR first)',
      'Set an extra payment this month',
    ];
    if (t.includes('manage your expenses')) return [
      'Identify top 3 recurring spends to trim',
      'Set a weekly spending amount',
      'Cancel or downgrade one subscription',
    ];
    if (t.includes('boost your income')) return [
      'Pick one income idea to try this month',
      'Block 2 hours in your calendar',
      'Send one message or application',
    ];
    if (t.includes('prosper pots')) return [
      'Decide pot names (Protect/Grow/Enjoy)',
      'Set target % for each pot',
      'Create standing orders to the pots',
    ];
    if (t.includes('automate your investing')) return [
      'Choose the account (ISA/401k/brokerage)',
      'Set a monthly contribution amount',
      'Schedule the transfer on payday',
    ];
    if (t.includes('invest for long')) return [
      'Confirm your long-term timeframe',
      'Choose a simple diversified fund',
      'Enable automatic contributions',
    ];
    if (t.includes('improve your credit')) return [
      'Check your credit report for errors',
      'Set reminders for on-time payments',
      'Lower utilisation by an extra payment',
    ];
    if (t.includes('buy your first home')) return [
      'Decide a deposit target and timeline',
      'Open or confirm the best savings account',
      'Start a monthly saving schedule',
    ];
    if (t.includes('pay off your home')) return [
      'Check overpayment rules with your lender',
      'Pick a comfortable monthly overpayment',
      'Set the overpayment and monitor impact',
    ];
    if (t.includes('protect yourself with insurance')) return [
      'Decide what to cover (life/income/home)',
      'Get 2 quotes to compare',
      'Set up the policy and note renewal date',
    ];
    // Foundations
    if (t.includes('have the money talk')) return [
      'Pick a calm time and place',
      'Share goals and any money worries',
      'Agree a regular 20‑minute check-in',
    ];
    if (t.includes('get your £hit together') || t.includes('get your')) return [
      'List your accounts and cards',
      'Close/merge any you don’t use',
      'Collect logins in a safe place',
    ];
    if (t.includes('set your foundations')) return [
      'Learn your 3 key numbers (income/essentials/cash)',
      'Understand emergency funds and savings rate',
      'Decide your first two actions',
    ];
    return [
      'Decide your target and timeline',
      'Pick one concrete next step',
      'Schedule time to do it this week',
    ];
  }

  // Prefill from voice onboarding draft
  React.useEffect(() => {
    if (!draft) return;
    const setIfEmpty = (cur: string, next?: number) => (cur === '' && typeof next === 'number' ? String(next) : cur);
    setHasPartner((prev) => prev || !!persona.partner);
    setNetIncomeSelf((cur) => setIfEmpty(cur, draft.netIncomeSelf));
    setNetIncomePartner((cur) => setIfEmpty(cur, draft.netIncomePartner));
    setEssentialExp((cur) => setIfEmpty(cur, draft.essentialExp));
    setCash((cur) => setIfEmpty(cur, draft.cash));
    setDebtPmts((cur) => setIfEmpty(cur, draft.debtPmts));
    setDebtTotal((cur) => setIfEmpty(cur, draft.debtTotal));
    if (draft.housing && housing === 'rent' && draft.housing !== 'rent') setHousing(draft.housing);
    if (draft.housing === 'rent') setRent((cur) => setIfEmpty(cur, draft.rent));
    if (draft.housing === 'own') setMortgagePmt((cur) => setIfEmpty(cur, draft.mortgagePmt));
  }, [draft?.netIncomeSelf, draft?.netIncomePartner, draft?.essentialExp, draft?.cash, draft?.debtPmts, draft?.debtTotal, draft?.housing, draft?.rent, draft?.mortgagePmt, persona.partner]);

  React.useEffect(() => {
    if (typeof persona.partner === 'boolean') setHasPartner(persona.partner);
  }, [persona.partner]);

  // Listen live for onboarding profile events while on Simple (in case agent adds more numbers later)
  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        const slots = (e?.detail?.slots || {}) as Record<string, any>;
        const val = (k: string) => {
          const v = slots?.[k]?.value;
          const n = Number(v);
          return Number.isFinite(n) ? String(n) : '';
        };
        if (!netIncomeSelf) setNetIncomeSelf(val('net_income_monthly_self'));
        if (hasPartner && !netIncomePartner) setNetIncomePartner(val('net_income_monthly_partner'));
        if (!essentialExp) setEssentialExp(val('essential_expenses_monthly'));
        const hs = slots?.housing_status?.value as any;
        if ((hs === 'rent' || hs === 'own' || hs === 'other') && housing !== hs) setHousing(hs);
        if (!rent && housing === 'rent') setRent(val('rent_monthly'));
        if (!mortgagePmt && housing === 'own') setMortgagePmt(val('mortgage_payment_monthly'));
        if (!cash) setCash(val('cash_liquid_total'));
        if (!debtPmts) setDebtPmts(val('other_debt_payments_monthly_total'));
        if (!debtTotal) setDebtTotal(val('other_debt_balances_total'));
      } catch {}
    };
    window.addEventListener('pp:onboarding_profile', handler as any);
    return () => window.removeEventListener('pp:onboarding_profile', handler as any);
  }, [netIncomeSelf, netIncomePartner, essentialExp, rent, mortgagePmt, cash, debtPmts, debtTotal, housing, hasPartner]);

  return (
    <div className="relative z-10 min-h-[100svh] w-full">
      <header className="absolute top-6 left-6 right-6 z-20">
        <div className="mx-auto max-w-[1040px] px-0 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <img src="/prosper_wordmark_offwhite.svg" alt="Prosper" className="h-10 w-auto opacity-95" />
            <span className="sr-only">Prosper</span>
          </Link>
          <PersonaBanner />
        </div>
      </header>
      <section className="relative flex min-h-[100svh] items-center justify-center py-24">
        <div className="mx-auto max-w-[1040px] w-full px-6">
          <div className="mx-auto max-w-[840px] w-full">
            <div className={`rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md p-6 md:p-8 shadow-xl transition-all duration-500 ease-out ${animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'}`}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-semibold text-white">
                      Welcome{persona?.name ? `, ${persona.name}` : ''}
                    </h2>
                    <p className="text-white/80 text-sm md:text-base mt-1">{TAB_INTRO[activeTab]}</p>
                  </div>
                  <WorkspaceTabs active={activeTab} onChange={setActiveTab} />
                </div>

                <VoicePanel />

                {activeTab === 'plan' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="rounded-xl border border-white/15 bg-white/8 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-widest text-white/70">Net worth</div>
                            <div className="text-2xl font-semibold text-white mt-1">
                              {netWorthValue != null ? fmtCurrency(netWorthValue) : 'Add details to unlock'}
                            </div>
                            <div className="text-xs text-white/70 mt-2">
                              {netWorthValue != null
                                ? (formatCurrencyDelta(netWorthDelta) || formatPctDelta(netWorthGrowthPct)
                                    ? `${formatCurrencyDelta(netWorthDelta) ?? ''}${formatCurrencyDelta(netWorthDelta) && formatPctDelta(netWorthGrowthPct) ? ' · ' : ''}${formatPctDelta(netWorthGrowthPct) ?? ''} vs last snapshot`
                                    : 'We’ll plot your trend after your next snapshot.')
                                : 'Share your income, assets and debts to track this.'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => openExplain('Net worth trend')}
                            className="text-[11px] uppercase tracking-widest text-white/70 hover:text-white/90"
                          >
                            Explain
                          </button>
                        </div>
                        <div className="mt-4">
                          <Sparkline points={trendPoints} size="sm" showAxis={false} showYAxis={false} currency={currency} />
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/15 bg-white/8 p-4 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs uppercase tracking-widest text-white/70">Prosper level</div>
                            <div className="text-2xl font-semibold text-white mt-1">
                              L{Number.isFinite(levelNumber) ? Math.max(1, Math.min(10, Math.round(levelNumber))) : 1} · {levelLabel}
                            </div>
                            <div className="text-xs text-white/70 mt-2">Next up: {nextLevelLabel}</div>
                          </div>
                          <LevelPill level={Number.isFinite(levelNumber) ? Math.max(1, Math.min(10, Math.round(levelNumber))) : 1} />
                        </div>
                        <div className="text-xs text-white/70">
                          {healthInsights.find((insight) => !insight.missing)?.body ||
                            healthInsights[0]?.body ||
                            'Complete your Money Snapshot to reveal your current level.'}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => openExplain('Prosper level')}
                            className="text-xs underline text-white/80 hover:text-white"
                          >
                            What does this mean?
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/80 mb-3">Your Prosper actions</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {planTiles.map((tile) => (
                          <div
                            key={tile.id}
                            className={`text-left rounded-xl border p-4 transition ${
                              tile.gated
                                ? 'border-white/10 bg-white/5 text-white/50 cursor-not-allowed'
                                : selected.includes(tile.id)
                                  ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                                  : 'border-white/15 bg-white/8 text-white/90 hover:bg-white/12'
                            }`}
                            onClick={() => { if (!tile.gated) openExplain(tile.title); }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-medium">{tile.title}</div>
                                <div className="text-xs mt-1 opacity-80">{tile.blurb}</div>
                                {tile.reason && <div className="text-[11px] mt-1 opacity-70">{tile.reason}</div>}
                              </div>
                              {!tile.gated ? (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleSelect(tile.id); }}
                                  role="switch"
                                  aria-checked={selected.includes(tile.id)}
                                  aria-label={`Select action: ${tile.title}`}
                                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${selected.includes(tile.id) ? 'border-emerald-300 bg-emerald-300/20' : 'border-white/30'}`}
                                >
                                  {selected.includes(tile.id) ? '✓' : '+'}
                                </button>
                              ) : (
                                <span className="text-[10px] px-2 py-1 rounded-full border border-white/20">Locked</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-white/70 mt-2">Pick up to two. We’ll unlock more after your first wins.</div>
                    </div>

                    {selectedTitles.length > 0 && (
                      <div className="text-xs text-white/70">
                        Selected: {selectedTitles.join(', ')}
                      </div>
                    )}

                    {error && <div className="text-sm text-red-200">{error}</div>}

                    <div className="flex flex-col md:flex-row items-center gap-3">
                      <button
                        onClick={buildPlan}
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {saving ? 'Building your plan…' : 'Build my Prosper Plan →'}
                      </button>
                      <div className="text-xs text-white/70">Takes under a minute. We’ll pick the first 2 actions together.</div>
                    </div>

                    <div className="text-xs text-white/60">
                      Need to tweak your inputs?{' '}
                      <button type="button" onClick={() => setActiveTab('data')} className="underline text-white hover:text-white/80">
                        Open My Data
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'health' && (
                  <div className="space-y-6">
                    <div className="rounded-xl border border-white/15 bg-white/8 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-white">Net worth trend</div>
                          <div className="text-xs text-white/70 mt-1">
                            {netWorthValue != null ? `Latest snapshot: ${fmtCurrency(netWorthValue)}` : 'Add your assets and debts to unlock this chart.'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openExplain('Net worth trend')}
                          className="text-xs underline text-white/80 hover:text-white"
                        >
                          Explain
                        </button>
                      </div>
                      <div className="mt-4">
                        <Sparkline points={trendPoints} size="md" currency={currency} />
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/80 mb-3">Key insights</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {healthInsights.length ? healthInsights.map((insight) => (
                          <button
                            key={insight.key}
                            type="button"
                            onClick={() => openExplain(insight.explain)}
                            className={`text-left rounded-xl border border-white/15 bg-white/8 p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${insight.tone === 'good' ? 'hover:border-emerald-300/60' : 'hover:border-amber-300/60'}`}
                          >
                            <div className="text-sm font-medium text-white">{insight.title}</div>
                            <div className="text-xs text-white/70 mt-2">{insight.body}</div>
                            {insight.missing && (
                              <div className="text-[11px] text-white/60 mt-3">
                                Jump to{' '}
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => { e.stopPropagation(); setActiveTab('data'); }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setActiveTab('data');
                                    }
                                  }}
                                  className="underline cursor-pointer"
                                >
                                  My Data
                                </span>{' '}
                                to add this info.
                              </div>
                            )}
                          </button>
                        )) : (
                          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
                            Add more details in My Data to surface tailored insights.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-white/80 mb-3">Money health KPIs</div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {healthMetrics.map((metric) => {
                          const valueLabel = metric.value == null
                            ? 'Add data'
                            : metric.format === 'pct'
                              ? fmtPct(metric.value)
                              : metric.format === 'months'
                                ? `${(Math.round(metric.value * 10) / 10).toFixed(1)} mo`
                                : (Math.round(metric.value * 100) / 100).toFixed(2);
                          const onTrack = metric.value == null ? null : metric.direction === 'higher'
                            ? metric.value >= metric.target
                            : metric.value <= metric.target;
                          const statusLabel = metric.value == null ? 'Needs info' : onTrack ? 'On track' : 'Focus area';
                          return (
                            <button
                              key={metric.key}
                              type="button"
                              onClick={() => openExplain(metric.label)}
                              className="text-left rounded-xl border border-white/15 bg-white/8 p-4 transition hover:bg-white/12 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                            >
                              <div className="text-xs uppercase tracking-widest text-white/60">{metric.label}</div>
                              <div className="text-xl font-semibold text-white mt-1">{valueLabel}</div>
                              <div className="text-xs text-white/60 mt-1">{metric.subtitle}</div>
                              <div className={`text-[11px] mt-2 ${statusLabel === 'On track' ? 'text-emerald-200' : statusLabel === 'Focus area' ? 'text-amber-200' : 'text-white/50'}`}>
                                {statusLabel}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'data' && (
                  <div className="space-y-6">
                    <div className="text-xs text-white/70">
                      These numbers update instantly in your Plan and Health tabs.
                    </div>

                    <DataSection title="Personal details" description="These are prefetched from your conversations. Update anything that has changed.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Full name">
                          <input value={persona.name ?? ''} onChange={(e) => updatePersona({ name: e.target.value })} placeholder="e.g., Alex" className="field" />
                        </Field>
                        <Field label="Age range">
                          <select value={persona.ageDecade ?? 'unspecified'} onChange={(e) => updatePersona({ ageDecade: e.target.value as AgeDecade })} className="field">
                            {AGE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt === 'unspecified' ? 'Select' : opt}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Country">
                          <input value={persona.country ?? ''} onChange={(e) => updatePersona({ country: e.target.value })} placeholder="e.g., United Kingdom" className="field" />
                        </Field>
                        <Field label="City">
                          <input value={persona.city ?? ''} onChange={(e) => updatePersona({ city: e.target.value })} placeholder="e.g., London" className="field" />
                        </Field>
                        <Field label="Household status">
                          <div className="flex items-center gap-3 text-sm">
                            <button onClick={() => { updatePersona({ partner: false }); setHasPartner(false); }} className={`btn ${!hasPartner ? 'btn-active' : ''}`}>Solo</button>
                            <button onClick={() => { updatePersona({ partner: true }); setHasPartner(true); }} className={`btn ${hasPartner ? 'btn-active' : ''}`}>With partner</button>
                          </div>
                        </Field>
                        <Field label="Children">
                          <input
                            value={typeof persona.childrenCount === 'number' ? String(persona.childrenCount) : ''}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updatePersona({ childrenCount: Number.isFinite(val) ? val : undefined });
                            }}
                            placeholder="e.g., 1"
                            className="field"
                            type="number"
                            min={0}
                          />
                        </Field>
                      </div>
                    </DataSection>

                    <DataSection title="Income & expenses" description="These power your Money Snapshot.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Net income (you)" suffix="/mo">
                          <input value={netIncomeSelf} onChange={(e) => setNetIncomeSelf(e.target.value)} placeholder="e.g., 3200" className="field" />
                        </Field>
                        <Field label="Essential expenses" suffix="/mo">
                          <input value={essentialExp} onChange={(e) => setEssentialExp(e.target.value)} placeholder="e.g., 1800" className="field" />
                        </Field>
                        {hasPartner && (
                          <Field label="Net income (partner)" suffix="/mo">
                            <input value={netIncomePartner} onChange={(e) => setNetIncomePartner(e.target.value)} placeholder="e.g., 2600" className="field" />
                          </Field>
                        )}
                        <Field label="Housing">
                          <div className="flex items-center gap-3 text-sm">
                            <button onClick={() => setHousing('rent')} className={`btn ${housing === 'rent' ? 'btn-active' : ''}`}>Rent</button>
                            <button onClick={() => setHousing('own')} className={`btn ${housing === 'own' ? 'btn-active' : ''}`}>Own</button>
                            <button onClick={() => setHousing('other')} className={`btn ${housing === 'other' ? 'btn-active' : ''}`}>Other</button>
                          </div>
                        </Field>
                        {housing === 'rent' && (
                          <Field label="Rent" suffix="/mo">
                            <input value={rent} onChange={(e) => setRent(e.target.value)} placeholder="e.g., 1200" className="field" />
                          </Field>
                        )}
                        {housing === 'own' && (
                          <Field label="Mortgage payment" suffix="/mo">
                            <input value={mortgagePmt} onChange={(e) => setMortgagePmt(e.target.value)} placeholder="e.g., 1100" className="field" />
                          </Field>
                        )}
                      </div>
                    </DataSection>

                    <DataSection title="Assets & liabilities" description="We use these to gauge buffers and debt pressure.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Cash on hand">
                          <input value={cash} onChange={(e) => setCash(e.target.value)} placeholder="e.g., 2400" className="field" />
                        </Field>
                        <Field label="Debt payments (total)" suffix="/mo">
                          <input value={debtPmts} onChange={(e) => setDebtPmts(e.target.value)} placeholder="e.g., 250" className="field" />
                        </Field>
                        <Field label="Debts total">
                          <input value={debtTotal} onChange={(e) => setDebtTotal(e.target.value)} placeholder="e.g., 3800" className="field" />
                        </Field>
                      </div>
                    </DataSection>

                    <DataSection title="Other" description="These preferences help Prosper tailor guidance.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Primary money goal">
                          <input value={persona.primaryGoal ?? ''} onChange={(e) => updatePersona({ primaryGoal: e.target.value })} placeholder="e.g., Buy our first home" className="field" />
                        </Field>
                        <Field label="Voice tone preference">
                          <select value={persona.tone ?? 'unspecified'} onChange={(e) => updatePersona({ tone: e.target.value as TonePreference })} className="field">
                            {TONE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Email">
                          <input value={persona.email ?? ''} onChange={(e) => updatePersona({ email: e.target.value })} placeholder="Add email to receive updates" className="field" />
                        </Field>
                        <Field label="Phone">
                          <input value={persona.phone ?? ''} onChange={(e) => updatePersona({ phone: e.target.value })} placeholder="Optional" className="field" />
                        </Field>
                      </div>
                    </DataSection>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {explainOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center">
          <div className="w-full md:w-[720px] max-h-[80vh] bg-[#05221E] text-white rounded-t-2xl md:rounded-2xl border border-white/10 shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="font-medium">Prosper — {explainingTitle}</div>
              <button onClick={closeExplain} className="text-sm underline">Close</button>
            </div>
            <div className="p-4 space-y-3 max-h-[58vh] overflow-y-auto">
              {explainLogs.length === 0 ? (
                <div className="text-sm text-white/70">Loading…</div>
              ) : (
                explainLogs.map((m, i) => (
                  <div key={i} className="text-sm">
                    <div className="text-[10px] uppercase tracking-widest text-white/50">{m.speaker === 'assistant' ? 'Prosper' : 'You'}</div>
                    <div className={m.speaker === 'assistant' ? 'text-white/90' : 'text-white/80'}>{m.text}</div>
                  </div>
                ))
              )}
              {/* Checklist */}
              <div className="mt-2">
                <div className="text-xs text-white/70 mb-1">Checklist</div>
                <ul className="space-y-2">
                  {checklist.map((s) => (
                    <li key={s} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={!!checked[s]}
                        onChange={(e) => setChecked((prev) => ({ ...prev, [s]: e.target.checked }))}
                        className="mt-0.5"
                        aria-label={`Mark step done: ${s}`}
                      />
                      <span className="text-sm text-white/90">{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => { try { explainInterrupt(); explainSendText('Can you go a bit deeper on why this matters right now for me?'); explainSendEvent({ type: 'response.create' }); } catch {} }}
                className="rounded-full border border-white/20 hover:bg-white/10 px-4 py-1.5 text-sm"
              >
                Why now?
              </button>
              <button
                disabled={!checklist.every((s) => !!checked[s])}
                onClick={async () => {
                  // Mark done
                  try { await fetch('/api/actions/complete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: explainingTitle, action_id: explainingTitle.toLowerCase().replace(/[^a-z0-9]+/g,'-') }) }); } catch {}
                  // Voice celebration
                  try { explainInterrupt(); explainSendText(`Nice work — you just completed ${explainingTitle}. Take a second to notice what helped.`); explainSendEvent({ type: 'response.create' }); } catch {}
                  // Local confetti
                  setCelebrateKey((k) => k + 1); setCelebrateOn(true); setTimeout(() => setCelebrateOn(false), 2200);
                }}
                className="rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-1.5 text-sm"
              >
                Mark done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confetti overlay for Simple page */}
      {celebrateOn && (
        <div key={celebrateKey} className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
          {Array.from({ length: 120 }).map((_, i) => {
            const left = Math.random() * 100;
            const w = 10 + Math.random() * 14;
            const h = 6 + Math.random() * 10;
            const delay = Math.random() * 0.3;
            const dur = 2 + Math.random() * 0.5;
            const hue = Math.floor(120 + Math.random() * 80);
            const drift = Math.random() < 0.5 ? 'confetti-left' : 'confetti-right';
            return (
              <div key={`c-${celebrateKey}-${i}`} style={{ position: 'absolute', top: '-5vh', left: `${left}vw`, width: w, height: h, backgroundColor: `hsl(${hue} 70% 55%)`, opacity: 0.9, transform: 'rotate(15deg)', animation: `${drift} ${dur}s ease-out ${delay}s forwards`, borderRadius: 2 }} />
            );
          })}
          <style jsx>{`
            @keyframes confetti-left { 0% { transform: translate3d(0,-100vh,0) rotate(0deg); opacity: 1; } 100% { transform: translate3d(-30vw,100vh,0) rotate(1080deg); opacity: 0; } }
            @keyframes confetti-right { 0% { transform: translate3d(0,-100vh,0) rotate(0deg); opacity: 1; } 100% { transform: translate3d(30vw,100vh,0) rotate(-1080deg); opacity: 0; } }
          `}</style>
        </div>
      )}

      {/* Voice dock placeholder to match app style */}
      <div className="hidden md:block fixed bottom-4 right-4 z-30">
        <Link href="/app" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/20">Open full app</Link>
      </div>
      {/* Styles moved to globals.css: .field, .btn, .btn-active, focus-visible ring */}
    </div>
  );
}

function Field({ label, suffix, children }: { label: string; suffix?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1">{label}{suffix ? <span className="opacity-60"> {' '}{suffix}</span> : null}</div>
      {children}
    </label>
  );
}

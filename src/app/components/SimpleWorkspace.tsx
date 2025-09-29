"use client";
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import BackgroundVideo from '@/app/components/BackgroundVideo';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { makeRealtimeAgent, realtimeOnlyCompanyName } from '@/app/agentConfigs/realtimeOnly';
import { createModerationGuardrail } from '@/app/agentConfigs/guardrails';
import { useAppStore } from '@/app/state/store';
import { useOnboardingStore } from '@/app/state/onboarding';
import type { AgeDecade, TonePreference, OnboardingDraft } from '@/app/state/onboarding';
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
type StageKey = 'foundations' | 'protect' | 'grow';

type ActionStatus = 'todo' | 'in-progress' | 'done';
type StageUnlocks = Record<StageKey, boolean>;
type StageStats = Record<StageKey, { total: number; done: number; inProgress: number; available: number; locked: number }>;
type PlanTile = { id: string; title: string; blurb: string; stage: StageKey; gated?: boolean; recommended?: boolean; reason?: string };

const ACTION_PROGRESS_STORAGE_KEY = 'pp_simple_action_progress_v1';
const MAX_ACTIVE_ACTIONS = 2;
const PROTECT_UNLOCK_THRESHOLD = 2;
const GROW_FOUNDATION_THRESHOLD = 3;
const GROW_PROTECT_THRESHOLD = 1;

const STATUS_LABEL: Record<ActionStatus, string> = {
  todo: 'Ready',
  'in-progress': 'In progress',
  done: 'Completed',
};

const STATUS_CLASSES: Record<ActionStatus, string> = {
  todo: 'border-white/25 bg-white/10 text-white/70',
  'in-progress': 'border-amber-300/70 bg-amber-300/15 text-amber-100',
  done: 'border-emerald-300/70 bg-emerald-300/15 text-emerald-100',
};

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

const PLAN_STAGE_META: Array<{ key: StageKey; label: string; sublabel: string }> = [
  { key: 'foundations', label: 'Build foundations', sublabel: 'Stabilise essentials, cash flow, and buffers.' },
  { key: 'protect', label: 'Protect your progress', sublabel: 'Cover risks so setbacks don’t undo gains.' },
  { key: 'grow', label: 'Grow & automate', sublabel: 'Put surplus to work with simple, repeatable systems.' },
];

const AGE_OPTIONS: AgeDecade[] = ['unspecified', '20s', '30s', '40s', '50s', '60s', '70s', '80s', '90s', '100s'];

const TONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'unspecified', label: 'No preference' },
  { value: 'straight', label: 'Straight-talk' },
  { value: 'relaxed', label: 'Laid back' },
];

type NumericFieldKey =
  | 'netIncomeSelf'
  | 'netIncomePartner'
  | 'essentialExp'
  | 'totalExpenses'
  | 'grossIncomeSelf'
  | 'grossIncomePartner'
  | 'rent'
  | 'mortgagePmt'
  | 'cash'
  | 'emergencySavings'
  | 'termDeposits'
  | 'investmentsTotal'
  | 'pensionTotal'
  | 'homeValue'
  | 'mortgageBalance'
  | 'housingRunningCosts'
  | 'debtPmts'
  | 'debtTotal'
  | 'shortTermLiabilities'
  | 'assetsTotal'
  | 'liabilitiesTotal';

const NUMERIC_FIELD_KEYS: NumericFieldKey[] = [
  'netIncomeSelf',
  'netIncomePartner',
  'essentialExp',
  'totalExpenses',
  'grossIncomeSelf',
  'grossIncomePartner',
  'rent',
  'mortgagePmt',
  'cash',
  'emergencySavings',
  'termDeposits',
  'investmentsTotal',
  'pensionTotal',
  'homeValue',
  'mortgageBalance',
  'housingRunningCosts',
  'debtPmts',
  'debtTotal',
  'shortTermLiabilities',
  'assetsTotal',
  'liabilitiesTotal',
];

const FIELD_SLOT_MAP: Record<NumericFieldKey, string> = {
  netIncomeSelf: 'net_income_monthly_self',
  netIncomePartner: 'net_income_monthly_partner',
  essentialExp: 'essential_expenses_monthly',
  totalExpenses: 'total_expenses_monthly',
  grossIncomeSelf: 'gross_income_annual_self',
  grossIncomePartner: 'gross_income_annual_partner',
  rent: 'rent_monthly',
  mortgagePmt: 'mortgage_payment_monthly',
  cash: 'cash_liquid_total',
  emergencySavings: 'emergency_savings_liquid',
  termDeposits: 'term_deposits_le_3m',
  investmentsTotal: 'investments_ex_home_total',
  pensionTotal: 'pension_balance_total',
  homeValue: 'home_value',
  mortgageBalance: 'mortgage_balance',
  housingRunningCosts: 'housing_running_costs_monthly',
  debtPmts: 'other_debt_payments_monthly_total',
  debtTotal: 'other_debt_balances_total',
  shortTermLiabilities: 'short_term_liabilities_12m',
  assetsTotal: 'assets_total',
  liabilitiesTotal: 'debts_total',
};

const SLOT_TO_FIELD = Object.entries(FIELD_SLOT_MAP).reduce<Record<string, NumericFieldKey>>((acc, [field, slot]) => {
  acc[slot] = field as NumericFieldKey;
  return acc;
}, {});

const FIELD_LABELS: Record<NumericFieldKey, string> = {
  netIncomeSelf: 'Net income (you)',
  netIncomePartner: 'Net income (partner)',
  essentialExp: 'Essential expenses',
  totalExpenses: 'Total expenses',
  grossIncomeSelf: 'Gross income (you)',
  grossIncomePartner: 'Gross income (partner)',
  rent: 'Rent',
  mortgagePmt: 'Mortgage payment',
  cash: 'Cash on hand',
  emergencySavings: 'Emergency savings',
  termDeposits: 'Term deposits',
  investmentsTotal: 'Investments',
  pensionTotal: 'Pension balance',
  homeValue: 'Home value',
  mortgageBalance: 'Mortgage balance',
  housingRunningCosts: 'Housing running costs',
  debtPmts: 'Debt payments (monthly)',
  debtTotal: 'Other debts total',
  shortTermLiabilities: 'Short-term liabilities',
  assetsTotal: 'Total assets',
  liabilitiesTotal: 'Total debts',
};

function planeNumber(v: string): number | null {
  const n = Number((v || '').replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function createEmptyFieldRecord(): Record<NumericFieldKey, string> {
  const obj = {} as Record<NumericFieldKey, string>;
  for (const key of NUMERIC_FIELD_KEYS) {
    obj[key] = '';
  }
  return obj;
}

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

function PlanStageActions({
  stage,
  tiles,
  selected,
  openExplain,
  actionProgress,
  stats,
}: {
  stage: StageKey;
  tiles: PlanTile[];
  selected: string[];
  openExplain: (target: PlanTile | string) => void;
  actionProgress: Record<string, ActionStatus>;
  stats: StageStats[StageKey];
}) {
  const stageMeta = PLAN_STAGE_META.find((s) => s.key === stage);
  const derived = React.useMemo(() => tiles.map((tile) => {
    const status = actionProgress[tile.id] ?? 'todo';
    const locked = tile.gated && status !== 'done';
    const isSelected = selected.includes(tile.id);
    return { ...tile, status, locked, isSelected } as PlanTile & { status: ActionStatus; locked: boolean; isSelected: boolean };
  }), [tiles, actionProgress, selected]);

  const primary = derived.find((tile) => tile.isSelected && !tile.locked) ?? derived.find((tile) => !tile.locked && tile.status !== 'done');
  const nextUp = derived.find((tile) => !tile.locked && tile.id !== primary?.id && tile.status !== 'done');
  const remainder = derived.filter((tile) => tile.id !== primary?.id && tile.id !== nextUp?.id);

  const renderStatusPill = (status: ActionStatus, locked: boolean) => {
    if (locked) return <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/60">Locked</span>;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_CLASSES[status]}`}>
        {STATUS_LABEL[status]}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {primary ? (
        <div className="rounded-2xl border border-emerald-300/60 bg-emerald-300/15 px-5 py-4 shadow transition">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xl">
              <div className="text-xs uppercase tracking-widest text-emerald-100/80">Current focus</div>
              <div className="text-xl md:text-2xl font-semibold text-white mt-2">{primary.title}</div>
              <div className="text-sm text-white/80 mt-2 whitespace-pre-line">{primary.blurb}</div>
              {primary.reason && <div className="text-xs text-white/70 mt-2">{primary.reason}</div>}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {renderStatusPill(primary.status, false)}
                {primary.recommended && <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white/80">Recommended</span>}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-2 text-xs text-white/70">
              <button
                type="button"
                onClick={() => openExplain(primary)}
                className="inline-flex items-center justify-center rounded-full bg-white/20 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/30"
              >
                {primary.status === 'in-progress' ? 'Continue with Prosper' : 'Start with Prosper'}
              </button>
              <div className="max-w-[220px] text-right md:text-left text-white/70 md:text-right">
                Prosper will walk you through this step in under 2 minutes.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/15 bg-white/8 p-4 text-sm text-white/70">
          Stage complete — great progress! We’ll unlock the next stage shortly.
        </div>
      )}

      {nextUp && (
        <div className="rounded-xl border border-white/15 bg-white/8 p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-widest text-white/50">Next up</div>
            <div className="text-lg font-medium text-white mt-1">{nextUp.title}</div>
            <div className="text-sm text-white/70 mt-2">{nextUp.blurb}</div>
            {nextUp.reason && <div className="text-xs text-white/60 mt-2">{nextUp.reason}</div>}
          </div>
          <div className="flex flex-col items-start md:items-end gap-2">
            <button
              type="button"
              onClick={() => openExplain(nextUp)}
              className="inline-flex items-center justify-center rounded-full border border-white/25 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              Preview with Prosper
            </button>
            {renderStatusPill(nextUp.status, false)}
          </div>
        </div>
      )}

      {remainder.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-widest text-white/50">Stage queue</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {remainder.map((tile) => {
              const disabled = tile.locked;
              const reason = tile.reason || (tile.locked ? 'Unlocks after the current focus is complete.' : '');
              return (
                <button
                  key={tile.id}
                  type="button"
                  onClick={() => { if (!disabled) openExplain(tile); }}
                  className={`text-left rounded-xl border p-4 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
                    disabled
                      ? 'cursor-not-allowed border-white/10 bg-white/5 text-white/40'
                      : tile.status === 'done'
                        ? 'border-emerald-300/50 bg-emerald-300/10 text-white'
                        : tile.isSelected
                          ? 'border-emerald-300/60 bg-emerald-300/10 text-white'
                          : 'border-white/15 bg-white/8 text-white/90 hover:bg-white/12'
                  }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{tile.title}</div>
                        <div className="text-xs text-white/70 mt-2">{tile.blurb}</div>
                        {reason && <div className="text-[11px] text-white/60 mt-2">{reason}</div>}
                      </div>
                      {renderStatusPill(tile.status, tile.locked)}
                    </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/60">
        <span>{stageMeta?.label ?? 'Stage'} progress</span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/70">
          {stats.done} completed
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/70">
          {stats.inProgress} in progress
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-white/70">
          {Math.max(stats.total - stats.done - stats.inProgress, 0)} remaining
        </span>
      </div>
    </div>
  );
}

export default function SimpleWorkspace() {
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const updatePersona = useOnboardingStore((s) => s.updatePersona);
  const updateDraftStore = useOnboardingStore((s) => s.updateDraft);
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

  // Form state for numeric slots and tracking changes
  const [hasPartner, setHasPartner] = React.useState<boolean>(!!persona.partner);
  const [housing, setHousing] = React.useState<'rent'|'own'|'other'>('rent');
  const [fieldValues, setFieldValues] = React.useState<Record<NumericFieldKey, string>>(() => createEmptyFieldRecord());
  const dirtyFieldsRef = React.useRef<Set<NumericFieldKey>>(new Set());
  const lastServerValuesRef = React.useRef<Record<NumericFieldKey, string>>(createEmptyFieldRecord());
  const housingDirtyRef = React.useRef<boolean>(false);
  const partnerDirtyRef = React.useRef<boolean>(false);
  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = React.useRef<boolean>(false);
  const fieldValuesRef = React.useRef(fieldValues);
  React.useEffect(() => { fieldValuesRef.current = fieldValues; }, [fieldValues]);
  const hasPartnerRef = React.useRef(hasPartner);
  React.useEffect(() => { hasPartnerRef.current = hasPartner; }, [hasPartner]);
  const housingRef = React.useRef(housing);
  React.useEffect(() => { housingRef.current = housing; }, [housing]);
  const [autoSaving, setAutoSaving] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [unlocked, setUnlocked] = React.useState<Set<string>>(new Set());
  const [computedNetWorth, setComputedNetWorth] = React.useState<number | null>(null);
  const [actionProgress, setActionProgress] = React.useState<Record<string, ActionStatus>>({});
  const actionProgressRef = React.useRef<Record<string, ActionStatus>>({});
  React.useEffect(() => { actionProgressRef.current = actionProgress; }, [actionProgress]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(ACTION_PROGRESS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        setActionProgress(parsed as Record<string, ActionStatus>);
      }
    } catch {}
  }, []);

  const persistActionProgress = React.useCallback((next: Record<string, ActionStatus>) => {
    if (typeof window === 'undefined') return;
    try {
      if (!Object.keys(next).length) {
        window.localStorage.removeItem(ACTION_PROGRESS_STORAGE_KEY);
      } else {
        window.localStorage.setItem(ACTION_PROGRESS_STORAGE_KEY, JSON.stringify(next));
      }
    } catch {}
  }, []);

  const setActionStatus = React.useCallback((id: string, status: ActionStatus) => {
    setActionProgress((prev) => {
      const current = prev[id];
      if (current === status) return prev;
      const next: Record<string, ActionStatus> = { ...prev };
      if (status === 'todo') {
        delete next[id];
      } else {
        next[id] = status;
      }
      persistActionProgress(next);
      return next;
    });
  }, [persistActionProgress]);

  const applyServerField = React.useCallback((key: NumericFieldKey, value: string | number | null | undefined) => {
    const next = value == null ? '' : String(value);
    lastServerValuesRef.current[key] = next;
    if (dirtyFieldsRef.current.has(key)) return;
    setFieldValues((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
  }, []);

  const resetHousehold = React.useCallback(async () => {
    try {
      const freshId = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2);
      const res = await fetch(`/api/household/switch?householdId=${encodeURIComponent(freshId)}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.id) {
        try { localStorage.setItem('pp_household_id', json.id); } catch {}
        setHouseholdId(json.id as string);
        return json.id as string;
      }
    } catch {}
    try { localStorage.removeItem('pp_household_id'); } catch {}
    const fallback = await ensureHouseholdId();
    setHouseholdId(fallback);
    return fallback;
  }, [setHouseholdId]);

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
    const partnerVal = slotValue('partner');
    if (partnerVal != null) {
      const bool = typeof partnerVal === 'boolean' ? partnerVal : partnerVal === 'true' || partnerVal === '1' || partnerVal === 1;
      setHasPartner(Boolean(bool));
    }
    const housingVal = slotValue('housing_status');
    if (housingVal === 'rent' || housingVal === 'own' || housingVal === 'other') {
      setHousing(housingVal);
    }
    for (const key of NUMERIC_FIELD_KEYS) {
      const slotKey = FIELD_SLOT_MAP[key];
      const raw = slotValue(slotKey);
      if (raw == null || raw === '') continue;
      const numeric = toNum(raw);
      applyServerField(key, numeric ?? raw);
    }
    const numericSlot = (key: string) => {
      const raw = slotValue(key);
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    };
    const totalAssetsOverride = numericSlot('assets_total');
    const totalDebtsOverride = numericSlot('debts_total');
    const liquid = numericSlot('cash_liquid_total') + numericSlot('emergency_savings_liquid') + numericSlot('term_deposits_le_3m');
    const investable = numericSlot('investments_ex_home_total') + numericSlot('pension_balance_total');
    const property = numericSlot('home_value');
    const mortgage = numericSlot('mortgage_balance');
    const otherDebt = numericSlot('other_debt_balances_total');
    let totalAssets = liquid + investable + property;
    let totalDebts = mortgage + otherDebt;
    if (totalAssets === 0 && totalAssetsOverride) totalAssets = totalAssetsOverride;
    if (totalDebts === 0 && totalDebtsOverride) totalDebts = totalDebtsOverride;
    const netWorth = totalAssets - totalDebts;
    if (Number.isFinite(netWorth)) setComputedNetWorth(netWorth);

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
  }, [applyServerField, setHasPartner, setHousing]);

  const flushPendingChanges = React.useCallback(async () => {
    if (!householdId) return;
    if (isFlushingRef.current) return;
    const dirtyKeys = Array.from(dirtyFieldsRef.current);
    const housingDirty = housingDirtyRef.current;
    const partnerDirty = partnerDirtyRef.current;
    if (!dirtyKeys.length && !housingDirty && !partnerDirty) return;

    const slots: Record<string, { value: SlotVal; confidence?: string }> = {};
    const draftUpdate: Partial<Record<NumericFieldKey, number | undefined>> = {};
    const updatedKeys: NumericFieldKey[] = [];
    const invalidFields: string[] = [];
    const currentValues = fieldValuesRef.current;

    for (const key of dirtyKeys) {
      const slotKey = FIELD_SLOT_MAP[key];
      const currentRaw = (currentValues[key] ?? '').trim();
      const serverRaw = (lastServerValuesRef.current[key] ?? '').trim();
      if (currentRaw === serverRaw) {
        continue;
      }
      if (!currentRaw.length) {
        slots[slotKey] = { value: null, confidence: 'med' };
        draftUpdate[key] = undefined;
        updatedKeys.push(key);
        continue;
      }
      const parsed = planeNumber(currentRaw);
      if (parsed == null) {
        invalidFields.push(FIELD_LABELS[key]);
        continue;
      }
      slots[slotKey] = { value: parsed, confidence: 'med' };
      draftUpdate[key] = parsed;
      updatedKeys.push(key);
    }

    if (invalidFields.length) {
      setError(`Please enter a number for ${invalidFields[0]}.`);
      return;
    }

    if (partnerDirty) {
      slots['partner'] = { value: hasPartnerRef.current, confidence: 'high' };
    }
    if (housingDirty) {
      slots['housing_status'] = { value: housingRef.current, confidence: 'high' };
    }

    if (!Object.keys(slots).length) {
      for (const key of dirtyKeys) {
        const currentRaw = (currentValues[key] ?? '').trim();
        if (currentRaw === (lastServerValuesRef.current[key] ?? '').trim()) {
          dirtyFieldsRef.current.delete(key);
        }
      }
      if (!partnerDirty) partnerDirtyRef.current = false;
      if (!housingDirty) housingDirtyRef.current = false;
      return;
    }

    isFlushingRef.current = true;
    setAutoSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/prosper/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, slots }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) {
        const nextId = await resetHousehold();
        if (nextId && nextId !== householdId) setTimeout(() => { flushPendingChangesRef.current?.(); }, 400);
        return;
      }
      if (res.status === 402) {
        setError(json?.message || 'Free limit reached — please upgrade to save new data.');
        return;
      }
      if (!res.ok || !json?.snapshot) {
        setError(json?.error || 'Could not save your updates yet.');
        return;
      }
      const snapshot = json.snapshot as DashboardSummary['latestSnapshot'];
      const currentValuesPost = fieldValuesRef.current;
      for (const key of updatedKeys) {
        const currentRaw = (currentValuesPost[key] ?? '').trim();
        lastServerValuesRef.current[key] = currentRaw;
        dirtyFieldsRef.current.delete(key);
      }
      if (partnerDirty) partnerDirtyRef.current = false;
      if (housingDirty) housingDirtyRef.current = false;
      if (Object.keys(draftUpdate).length) {
        updateDraftStore(draftUpdate as Partial<OnboardingDraft>);
      }
      const summaryForApply: DashboardSummary = {
        latestSnapshot: snapshot,
        kpis: snapshot?.kpis ?? null,
        levels: snapshot?.levels ?? null,
      };
      if (json?.series) summaryForApply.series = json.series;
      setDashboardData((prev) => {
        const next: DashboardSummary = { ...(prev || {}) };
        next.latestSnapshot = snapshot;
        next.kpis = snapshot?.kpis ?? prev?.kpis ?? null;
        next.levels = snapshot?.levels ?? prev?.levels ?? null;
        if (json?.series) next.series = json.series;
        return next;
      });
      applyDashboard(summaryForApply);
    } catch {
      setError('Something went wrong while saving.');
    } finally {
      isFlushingRef.current = false;
      setAutoSaving(false);
    }
  }, [applyDashboard, householdId, updateDraftStore, resetHousehold]);

  const flushPendingChangesRef = React.useRef<(() => void) | null>(null);
  React.useEffect(() => { flushPendingChangesRef.current = flushPendingChanges; }, [flushPendingChanges]);

  const scheduleAutoSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      flushPendingChangesRef.current?.();
    }, 800);
  }, [flushPendingChanges]);

  const setField = React.useCallback((key: NumericFieldKey, next: string) => {
    const currentValue = fieldValuesRef.current[key];
    if (currentValue === next) return;
    setFieldValues((prev) => (prev[key] === next ? prev : { ...prev, [key]: next }));
    dirtyFieldsRef.current.add(key);
    setError(null);
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, []);

  const netIncomeSelf = fieldValues.netIncomeSelf;
  const netIncomePartner = fieldValues.netIncomePartner;
  const essentialExp = fieldValues.essentialExp;
  const totalExpenses = fieldValues.totalExpenses;
  const grossIncomeSelf = fieldValues.grossIncomeSelf;
  const grossIncomePartner = fieldValues.grossIncomePartner;
  const rent = fieldValues.rent;
  const mortgagePmt = fieldValues.mortgagePmt;
  const cash = fieldValues.cash;
  const emergencySavings = fieldValues.emergencySavings;
  const termDeposits = fieldValues.termDeposits;
  const investmentsTotal = fieldValues.investmentsTotal;
  const pensionTotal = fieldValues.pensionTotal;
  const homeValue = fieldValues.homeValue;
  const mortgageBalance = fieldValues.mortgageBalance;
  const housingRunningCosts = fieldValues.housingRunningCosts;
  const debtPmts = fieldValues.debtPmts;
  const debtTotal = fieldValues.debtTotal;
  const shortTermLiabilities = fieldValues.shortTermLiabilities;
  const assetsTotal = fieldValues.assetsTotal;
  const liabilitiesTotal = fieldValues.liabilitiesTotal;

  const dataWarnings = React.useMemo(() => {
    const warnings: string[] = [];
    const home = planeNumber(homeValue);
    const mortgage = planeNumber(mortgageBalance) || 0;
    if (home != null && home > 0 && mortgage > home * 1.2) {
      warnings.push('Mortgage balance looks higher than home value. Double check those numbers.');
    }
    const assetsOverride = planeNumber(assetsTotal);
    const debtsOverride = planeNumber(liabilitiesTotal);
    if (assetsOverride != null && debtsOverride != null && assetsOverride < debtsOverride) {
      warnings.push('Overrides show debts greater than assets — is that intentional?');
    }
    return warnings;
  }, [homeValue, mortgageBalance, assetsTotal, liabilitiesTotal]);

  const localNetWorth = React.useMemo(() => {
    const parse = (val: string) => planeNumber(val) ?? 0;
    const overrideAssets = planeNumber(assetsTotal);
    const overrideDebts = planeNumber(liabilitiesTotal);
    let assets = parse(cash)
      + parse(emergencySavings)
      + parse(termDeposits)
      + parse(investmentsTotal)
      + parse(pensionTotal)
      + parse(homeValue);
    let debts = parse(mortgageBalance)
      + parse(debtTotal)
      + parse(shortTermLiabilities);
    if (overrideAssets != null && !Number.isNaN(overrideAssets)) assets = overrideAssets;
    if (overrideDebts != null && !Number.isNaN(overrideDebts)) debts = overrideDebts;
    const net = assets - debts;
    return Number.isFinite(net) ? net : null;
  }, [cash, emergencySavings, termDeposits, investmentsTotal, pensionTotal, homeValue, mortgageBalance, debtTotal, shortTermLiabilities, assetsTotal, liabilitiesTotal]);

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
    if (computedNetWorth != null) return computedNetWorth;
    if (localNetWorth != null) return localNetWorth;
    const fallback = Number((kpis as any)?.net_worth);
    return Number.isFinite(fallback) ? fallback : null;
  }, [trendPoints, kpis, computedNetWorth, localNetWorth]);

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

  const fetchDashboard = React.useCallback(async () => {
    if (!householdId) return;
    try {
      const res = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`, { cache: 'no-store' });
      if (res.status === 401) {
        const nextId = await resetHousehold();
        if (nextId !== householdId) return;
      }
      if (!res.ok) return;
      const json = (await res.json()) as DashboardSummary;
      setDashboardData(json);
      applyDashboard(json);
    } catch {}
  }, [householdId, applyDashboard, resetHousehold]);

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
  const [explainingTile, setExplainingTile] = React.useState<PlanTile | null>(null);
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
  async function openExplain(target: PlanTile | string) {
    const title = typeof target === 'string' ? target : target.title;
    const tile = typeof target === 'string' ? null : target;
    if (tile) {
      const currentStatus = actionProgressRef.current[tile.id] ?? 'todo';
      if (currentStatus !== 'done') setActionStatus(tile.id, 'in-progress');
      log('simple_focus_action', { id: tile.id, stage: tile.stage });
    }
    setExplainingTile(tile);
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
    setExplainingTile(null);
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

  const planData = React.useMemo(() => {
    const tiles: PlanTile[] = [];
    let protectUnlocked = false;
    let growUnlocked = false;
    const debtTotalNum = planeNumber(debtTotal) || 0;
    const baseCash = planeNumber(cash) || 0;
    const emergencyNum = planeNumber(emergencySavings) || 0;
    const termNum = planeNumber(termDeposits) || 0;
    const cashNum = baseCash + emergencyNum + termNum;
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
    tiles.push({ id: 'have-the-money-talk', stage: 'foundations', title: 'Have the money talk', blurb: 'A quick chat to align how you want to handle money together. Simple prompts included.', recommended: !!hasPartner });
    tiles.push({ id: 'declutter-finances', stage: 'foundations', title: 'Get your £hit together', blurb: 'Streamline accounts, clean up cards, and find any lost money.', recommended: !hasPartner });
    tiles.push({ id: 'foundations', stage: 'foundations', title: 'Set your foundations', blurb: 'Learn the essentials so choices feel straightforward and calm.' });

    // Conditional starters
    if (debtTotalNum > 0) {
      tiles.push({ id: 'clear-debts', stage: 'foundations', title: 'Clear your unhealthy debts', blurb: 'Lower stress and costs by tackling expensive debts first.', recommended: true, reason: 'You mentioned outstanding debts.' });
    }
    if (suggestEmergency) {
      tiles.push({ id: 'emergency-fund-1', stage: 'foundations', title: 'Build your first emergency fund', blurb: 'Create a soft cushion for life’s surprises.', recommended: debtTotalNum === 0, reason: 'Your cash buffer looks light.' });
    }
    tiles.push({ id: 'manage-expenses', stage: 'foundations', title: 'Manage your expenses', blurb: 'Open up room to save ~20% by re‑tuning spend.', recommended: minInputs && essentialsNum / Math.max(monthlyIncome, 1) > 0.5 });
    tiles.push({ id: 'boost-income', stage: 'foundations', title: 'Boost your income', blurb: 'Practical ideas to nudge earnings without burning out.' });
    // Credit score (always available)
    tiles.push({ id: 'improve-credit', stage: 'foundations', title: 'Improve your credit score', blurb: 'Understand what moves the needle and tidy up your report.' });

    // Home goals
    if (rentSelected) {
      tiles.push({
        id: 'buy-first-home',
        stage: 'grow',
        title: 'Buy your first home',
        blurb: 'Plan your deposit, mortgage steps, and a 12‑month path.',
        gated: true,
        recommended: goal.includes('home') || goal.includes('house') || goal.includes('mortgage'),
        reason: goal ? 'You mentioned a home goal.' : undefined,
      });
    }
    if (ownSelected) {
      tiles.push({ id: 'pay-off-home', stage: 'grow', title: 'Pay off your home', blurb: 'Shave years and thousands off your mortgage.', gated: true });
    }

    // Protection (recommend when family or homeowner)
    const familyOrHome = (typeof persona.childrenCount === 'number' && persona.childrenCount > 0) || !!hasPartner || ownSelected;
    tiles.push({ id: 'insurance-protection', stage: 'protect', title: 'Protect yourself with insurance', blurb: 'Cover the big wipe‑outs so progress sticks.', gated: !familyOrHome, recommended: familyOrHome, reason: familyOrHome ? undefined : 'We can line this up after your basics.' });
    protectUnlocked = !(!familyOrHome);

    // Savings progression
    tiles.push({ id: 'emergency-fund-3m', stage: 'foundations', title: 'Increase your emergency fund', blurb: 'Grow your cushion to ~3 months for real security.', gated: !unlocked.has('emergency-fund-3m') });

    // Automation & investing (gate until foundations + cash buffer and no unhealthy debt)
    const growGate = !unlocked.has('prosper-pots') && !unlocked.has('invest-automation') && !unlocked.has('invest-long-term');
    tiles.push({ id: 'prosper-pots', stage: 'grow', title: 'Set up your Prosper Pots', blurb: 'Automate your money so good choices happen by default.', gated: !unlocked.has('prosper-pots') });
    tiles.push({ id: 'invest-automation', stage: 'grow', title: 'Automate your investing', blurb: 'Tax‑efficient, automatic contributions toward long‑term growth.', gated: !unlocked.has('invest-automation') });
    tiles.push({ id: 'invest-long-term', stage: 'grow', title: 'Invest for long‑term growth', blurb: 'Put your Prosper cash to work steadily over time.', gated: !unlocked.has('invest-long-term') });
    growUnlocked = !growGate;

    // Recommend at most two
    return {
      planTiles: tiles,
      stageUnlocks: {
        foundations: true,
        protect: protectUnlocked,
        grow: growUnlocked,
      },
    };
  }, [netIncomeSelf, netIncomePartner, hasPartner, essentialExp, rent, mortgagePmt, cash, debtPmts, debtTotal, persona.childrenCount, persona.primaryGoal, housing, unlocked]);

  const planTiles = planData.planTiles;
  const baseStageUnlocks = planData.stageUnlocks;
  const [activeStage, setActiveStage] = React.useState<StageKey>('foundations');

  const stageBuckets = React.useMemo(() => {
    const base: Record<StageKey, PlanTile[]> = { foundations: [], protect: [], grow: [] };
    planTiles.forEach((tile) => {
      base[tile.stage].push(tile);
    });
    return base;
  }, [planTiles]);

  const stageStats = React.useMemo<StageStats>(() => {
    const stats: StageStats = {
      foundations: { total: 0, done: 0, inProgress: 0, available: 0, locked: 0 },
      protect: { total: 0, done: 0, inProgress: 0, available: 0, locked: 0 },
      grow: { total: 0, done: 0, inProgress: 0, available: 0, locked: 0 },
    };
    planTiles.forEach((tile) => {
      const status = actionProgress[tile.id] ?? 'todo';
      const entry = stats[tile.stage];
      entry.total += 1;
      if (status === 'done') entry.done += 1;
      if (status === 'in-progress') entry.inProgress += 1;
      const gated = tile.gated && status !== 'done';
      if (gated) entry.locked += 1;
      else entry.available += 1;
    });
    return stats;
  }, [planTiles, actionProgress]);

  const stageUnlocks = React.useMemo<StageUnlocks>(() => {
    const next: StageUnlocks = {
      foundations: true,
      protect: baseStageUnlocks.protect,
      grow: baseStageUnlocks.grow,
    };

    if (baseStageUnlocks.protect) {
      const availableFoundations = stageBuckets.foundations.filter((tile) => !(tile.gated && (actionProgress[tile.id] ?? 'todo') !== 'done'));
      const threshold = Math.min(PROTECT_UNLOCK_THRESHOLD, Math.max(availableFoundations.length, 1));
      next.protect = stageStats.foundations.done >= threshold || availableFoundations.length === 0;
    }

    if (baseStageUnlocks.grow) {
      const availableFoundations = stageBuckets.foundations.filter((tile) => !(tile.gated && (actionProgress[tile.id] ?? 'todo') !== 'done'));
      const availableProtect = stageBuckets.protect.filter((tile) => !(tile.gated && (actionProgress[tile.id] ?? 'todo') !== 'done'));
      const foundationThreshold = Math.min(GROW_FOUNDATION_THRESHOLD, Math.max(availableFoundations.length, 1));
      const protectThreshold = Math.min(GROW_PROTECT_THRESHOLD, Math.max(availableProtect.length, 0) || 1);
      next.grow = (stageStats.foundations.done >= foundationThreshold && stageStats.protect.done >= protectThreshold) || (availableProtect.length === 0 && stageStats.foundations.done >= foundationThreshold);
    }

    return next;
  }, [baseStageUnlocks, stageBuckets, stageStats, actionProgress]);

  React.useEffect(() => {
    if (stageUnlocks[activeStage]) return;
    const firstUnlocked = PLAN_STAGE_META.find((stage) => stageUnlocks[stage.key]);
    if (firstUnlocked) setActiveStage(firstUnlocked.key);
  }, [stageUnlocks, activeStage]);

  const stageOrder: StageKey[] = ['foundations', 'protect', 'grow'];
  const actionQueue = React.useMemo(() => {
    const queue: PlanTile[] = [];
    const weight: Record<ActionStatus, number> = { 'in-progress': 0, todo: 1, 'done': 2 };
    stageOrder.forEach((stage) => {
      const unlocked = stage === 'foundations' ? true : stageUnlocks[stage];
      const tiles = stageBuckets[stage];
      tiles
        .filter((tile) => {
          const status = actionProgress[tile.id] ?? 'todo';
          if (status === 'done') return false;
          if (!unlocked) return false;
          if (tile.gated && status !== 'done') return false;
          return true;
        })
        .sort((a, b) => {
          const statusA = actionProgress[a.id] ?? 'todo';
          const statusB = actionProgress[b.id] ?? 'todo';
          const statusOrder = weight[statusA] - weight[statusB];
          if (statusOrder !== 0) return statusOrder;
          if (Boolean(a.recommended) !== Boolean(b.recommended)) return a.recommended ? -1 : 1;
          return 0;
        })
        .forEach((tile) => queue.push(tile));
    });
    return queue;
  }, [stageBuckets, stageUnlocks, actionProgress]);

  React.useEffect(() => {
    const focusIds = actionQueue.slice(0, MAX_ACTIVE_ACTIONS).map((tile) => tile.id);
    setSelected((prev) => {
      if (prev.length === focusIds.length && prev.every((id, idx) => id === focusIds[idx])) {
        return prev;
      }
      return focusIds;
    });
  }, [actionQueue]);

  const lockCopy = React.useMemo(() => {
    if (stageUnlocks[activeStage]) return null;
    if (!baseStageUnlocks[activeStage]) {
      if (activeStage === 'protect') return "We'll surface Protect once your plan says it's time. Keep building your foundations for now.";
      if (activeStage === 'grow') return "Grow unlocks after your buffers and protections are in good shape. Stick with the earlier wins first.";
      return "We'll unlock this stage when your plan signals it.";
    }
    if (activeStage === 'protect') {
      const remaining = Math.max(PROTECT_UNLOCK_THRESHOLD - stageStats.foundations.done, 0);
      if (remaining <= 0) return 'We’ll unlock this stage when your plan refreshes.';
      return `Complete ${remaining} more foundation action${remaining === 1 ? '' : 's'} to unlock Protect.`;
    }
    if (activeStage === 'grow') {
      const needFoundations = Math.max(GROW_FOUNDATION_THRESHOLD - stageStats.foundations.done, 0);
      const needProtect = Math.max(GROW_PROTECT_THRESHOLD - stageStats.protect.done, 0);
      const parts: string[] = [];
      if (needFoundations > 0) parts.push(`${needFoundations} more foundation action${needFoundations === 1 ? '' : 's'}`);
      if (needProtect > 0) parts.push(`${needProtect} protect action${needProtect === 1 ? '' : 's'}`);
      if (!parts.length) return 'We’ll unlock Grow when your plan refreshes.';
      return `Complete ${parts.join(' and ')} to unlock Grow.`;
    }
    return 'Complete the actions in earlier stages to unlock this step.';
  }, [stageUnlocks, activeStage, stageStats, baseStageUnlocks]);

  const selectedTitles = React.useMemo(() => (
    selected
      .map((id) => planTiles.find((tile) => tile.id === id)?.title)
      .filter((title): title is string => Boolean(title))
  ), [selected, planTiles]);

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
    setHasPartner((prev) => prev || !!persona.partner);
    for (const key of NUMERIC_FIELD_KEYS) {
      const maybeValue = (draft as any)[key];
      if (typeof maybeValue === 'number') {
        applyServerField(key, maybeValue);
      }
    }
    if (draft.housing === 'rent' || draft.housing === 'own' || draft.housing === 'other') setHousing(draft.housing);
  }, [draft, applyServerField, persona.partner]);

  React.useEffect(() => {
    if (typeof persona.partner === 'boolean') setHasPartner(persona.partner);
  }, [persona.partner]);

  // Listen live for onboarding profile events while on Simple (in case agent adds more numbers later)
  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        const slots = (e?.detail?.slots || {}) as Record<string, any>;
        for (const [slotKey, payload] of Object.entries(slots)) {
          if (!payload) continue;
          const fieldKey = SLOT_TO_FIELD[slotKey];
          if (!fieldKey) continue;
          const raw = typeof payload === 'object' && 'value' in payload ? (payload as any).value : payload;
          if (raw == null || raw === '') continue;
          const numeric = Number(raw);
          const value = Number.isFinite(numeric) ? numeric : raw;
          applyServerField(fieldKey, value);
        }
        const hs = slots?.housing_status?.value as any;
        if ((hs === 'rent' || hs === 'own' || hs === 'other') && housing !== hs) setHousing(hs);
      } catch {}
    };
    window.addEventListener('pp:onboarding_profile', handler as any);
    return () => window.removeEventListener('pp:onboarding_profile', handler as any);
  }, [applyServerField, housing, setHousing]);

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#041613]">
      <div className="absolute inset-0 -z-20 overflow-hidden">
        <BackgroundVideo
          src="/landing.mp4"
          className="absolute inset-0 h-full w-full object-cover blur-[6px] scale-[1.06] opacity-75"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(1200px 600px at 50% 40%, rgba(255,255,255,0.12), transparent 65%)' }}
        />
      </div>
      <div className="absolute inset-0 -z-10 bg-black/55" aria-hidden />

      <div className="relative z-10 min-h-[100svh] w-full">
      <header className="absolute top-6 left-6 right-6 z-20">
        <div className="mx-auto max-w-[1040px] px-0 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image src="/prosper_wordmark_offwhite.svg" alt="Prosper" width={160} height={40} className="h-10 w-auto opacity-95" priority />
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

                    <div className="space-y-2">
                      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                        <div>
                          <div className="text-sm text-white/80">Your Prosper Path</div>
                          <div className="text-xs text-white/70 mt-1">We’ll focus on one step at a time and unlock later stages after each win.</div>
                        </div>
                        {selectedTitles.length > 0 && (
                          <div className="inline-flex flex-wrap items-center gap-2 text-xs text-white/65">
                            <span className="uppercase tracking-widest text-white/40">In focus</span>
                            <span>{selectedTitles.join(' → ')}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {PLAN_STAGE_META.map((stage) => {
                          const unlocked = stageUnlocks[stage.key];
                          const isActiveStage = stage.key === activeStage;
                          return (
                            <button
                              key={stage.key}
                              type="button"
                              onClick={() => unlocked && setActiveStage(stage.key)}
                              disabled={!unlocked}
                              className={`px-3 py-1.5 rounded-full text-xs uppercase tracking-wide border transition ${
                                isActiveStage
                                  ? 'border-emerald-300 bg-emerald-300/15 text-white shadow'
                                  : unlocked
                                    ? 'border-white/20 bg-white/5 text-white/80 hover:text-white'
                                    : 'border-white/10 bg-white/5 text-white/40 cursor-not-allowed backdrop-blur-sm'
                              }`}
                            >
                              {stage.label}
                            </button>
                          );
                        })}
                      </div>
                      <div className="text-xs text-white/60">{PLAN_STAGE_META.find((s) => s.key === activeStage)?.sublabel}</div>
                    </div>

                    {!stageUnlocks[activeStage] ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                        {lockCopy || 'Complete the actions in earlier stages to unlock this step.'}
                      </div>
                    ) : (
                      <PlanStageActions
                        stage={activeStage}
                        tiles={stageBuckets[activeStage]}
                        selected={selected}
                        openExplain={openExplain}
                        actionProgress={actionProgress}
                        stats={stageStats[activeStage]}
                      />
                    )}

                    {error && <div className="text-sm text-red-200">{error}</div>}

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
                    <div className="flex items-center justify-between text-xs text-white/70 gap-3">
                      <span>These numbers update instantly in your Plan and Health tabs.</span>
                      {autoSaving && <span className="text-white/60">Saving…</span>}
                    </div>

                    {dataWarnings.length > 0 && (
                      <div className="rounded-xl border border-amber-300/50 bg-amber-300/15 p-3 text-xs text-amber-50">
                        <div className="text-sm font-medium text-amber-50">Quick double-check</div>
                        <ul className="mt-2 space-y-1 pl-4 list-disc marker:text-amber-100">
                          {dataWarnings.map((warning) => (
                            <li key={warning} className="text-amber-100/90">{warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}

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
                            <button
                              onClick={() => {
                                updatePersona({ partner: false });
                                setHasPartner(false);
                                partnerDirtyRef.current = true;
                                setField('netIncomePartner', '');
                                setField('grossIncomePartner', '');
                                scheduleAutoSave();
                              }}
                              className={`btn ${!hasPartner ? 'btn-active' : ''}`}
                            >
                              Solo
                            </button>
                            <button
                              onClick={() => {
                                updatePersona({ partner: true });
                                setHasPartner(true);
                                partnerDirtyRef.current = true;
                                scheduleAutoSave();
                              }}
                              className={`btn ${hasPartner ? 'btn-active' : ''}`}
                            >
                              With partner
                            </button>
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
                          <input value={netIncomeSelf} onChange={(e) => setField('netIncomeSelf', e.target.value)} placeholder="e.g., 3200" className="field" />
                        </Field>
                        <Field label="Gross income (you)" suffix="/yr">
                          <input value={grossIncomeSelf} onChange={(e) => setField('grossIncomeSelf', e.target.value)} placeholder="e.g., 52000" className="field" />
                        </Field>
                        <Field label="Essential expenses" suffix="/mo">
                          <input value={essentialExp} onChange={(e) => setField('essentialExp', e.target.value)} placeholder="e.g., 1800" className="field" />
                        </Field>
                        <Field label="Total expenses" suffix="/mo">
                          <input value={totalExpenses} onChange={(e) => setField('totalExpenses', e.target.value)} placeholder="e.g., 2600" className="field" />
                        </Field>
                        {hasPartner && (
                          <Field label="Net income (partner)" suffix="/mo">
                            <input value={netIncomePartner} onChange={(e) => setField('netIncomePartner', e.target.value)} placeholder="e.g., 2600" className="field" />
                          </Field>
                        )}
                        {hasPartner && (
                          <Field label="Gross income (partner)" suffix="/yr">
                            <input value={grossIncomePartner} onChange={(e) => setField('grossIncomePartner', e.target.value)} placeholder="e.g., 48000" className="field" />
                          </Field>
                        )}
                        <Field label="Housing">
                          <div className="flex items-center gap-3 text-sm">
                            <button
                              onClick={() => {
                                housingDirtyRef.current = true;
                                if (housing !== 'rent') {
                                  setField('mortgagePmt', '');
                                }
                                setHousing('rent');
                                scheduleAutoSave();
                              }}
                              className={`btn ${housing === 'rent' ? 'btn-active' : ''}`}
                            >
                              Rent
                            </button>
                            <button
                              onClick={() => {
                                housingDirtyRef.current = true;
                                if (housing !== 'own') {
                                  setField('rent', '');
                                }
                                setHousing('own');
                                scheduleAutoSave();
                              }}
                              className={`btn ${housing === 'own' ? 'btn-active' : ''}`}
                            >
                              Own
                            </button>
                            <button
                              onClick={() => {
                                housingDirtyRef.current = true;
                                if (housing !== 'other') {
                                  setField('rent', '');
                                  setField('mortgagePmt', '');
                                }
                                setHousing('other');
                                scheduleAutoSave();
                              }}
                              className={`btn ${housing === 'other' ? 'btn-active' : ''}`}
                            >
                              Other
                            </button>
                          </div>
                        </Field>
                        {housing === 'rent' && (
                          <Field label="Rent" suffix="/mo">
                            <input value={rent} onChange={(e) => setField('rent', e.target.value)} placeholder="e.g., 1200" className="field" />
                          </Field>
                        )}
                        {housing === 'own' && (
                          <Field label="Mortgage payment" suffix="/mo">
                            <input value={mortgagePmt} onChange={(e) => setField('mortgagePmt', e.target.value)} placeholder="e.g., 1100" className="field" />
                          </Field>
                        )}
                        <Field label="Housing running costs" suffix="/mo">
                          <input value={housingRunningCosts} onChange={(e) => setField('housingRunningCosts', e.target.value)} placeholder="e.g., 180" className="field" />
                        </Field>
                      </div>
                    </DataSection>

                    <DataSection title="Assets & liabilities" description="We use these to gauge buffers and debt pressure.">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Cash on hand">
                          <input value={cash} onChange={(e) => setField('cash', e.target.value)} placeholder="e.g., 2400" className="field" />
                        </Field>
                        <Field label="Emergency savings">
                          <input value={emergencySavings} onChange={(e) => setField('emergencySavings', e.target.value)} placeholder="e.g., 1500" className="field" />
                        </Field>
                        <Field label="Term deposits (≤3m)">
                          <input value={termDeposits} onChange={(e) => setField('termDeposits', e.target.value)} placeholder="e.g., 1000" className="field" />
                        </Field>
                        <Field label="Investments (ex home)">
                          <input value={investmentsTotal} onChange={(e) => setField('investmentsTotal', e.target.value)} placeholder="e.g., 6200" className="field" />
                        </Field>
                        <Field label="Pension balance">
                          <input value={pensionTotal} onChange={(e) => setField('pensionTotal', e.target.value)} placeholder="e.g., 18000" className="field" />
                        </Field>
                        <Field label="Home value">
                          <input value={homeValue} onChange={(e) => setField('homeValue', e.target.value)} placeholder="e.g., 325000" className="field" />
                        </Field>
                        <Field label="Mortgage balance">
                          <input value={mortgageBalance} onChange={(e) => setField('mortgageBalance', e.target.value)} placeholder="e.g., 210000" className="field" />
                        </Field>
                        <Field label="Debt payments (total)" suffix="/mo">
                          <input value={debtPmts} onChange={(e) => setField('debtPmts', e.target.value)} placeholder="e.g., 250" className="field" />
                        </Field>
                        <Field label="Debts total">
                          <input value={debtTotal} onChange={(e) => setField('debtTotal', e.target.value)} placeholder="e.g., 3800" className="field" />
                        </Field>
                        <Field label="Short-term liabilities (12m)">
                          <input value={shortTermLiabilities} onChange={(e) => setField('shortTermLiabilities', e.target.value)} placeholder="e.g., 500" className="field" />
                        </Field>
                        <Field label="Total assets">
                          <input value={assetsTotal} onChange={(e) => setField('assetsTotal', e.target.value)} placeholder="Optional override" className="field" />
                        </Field>
                        <Field label="Total debts">
                          <input value={liabilitiesTotal} onChange={(e) => setField('liabilitiesTotal', e.target.value)} placeholder="Optional override" className="field" />
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
              {explainingTile && (
                <button
                  disabled={!checklist.every((s) => !!checked[s])}
                  onClick={async () => {
                    try {
                      await fetch('/api/actions/complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: explainingTile.title, action_id: explainingTile.id }),
                      });
                    } catch {}
                    setActionStatus(explainingTile.id, 'done');
                    log('simple_action_completed', { id: explainingTile.id, stage: explainingTile.stage });
                    try {
                      explainInterrupt();
                      explainSendText(`Nice work — you just completed ${explainingTile.title}. Take a second to notice what helped.`);
                      explainSendEvent({ type: 'response.create' });
                    } catch {}
                    setCelebrateKey((k) => k + 1);
                    setCelebrateOn(true);
                    setTimeout(() => setCelebrateOn(false), 2200);
                  }}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 px-4 py-1.5 text-sm"
                >
                  Mark done
                </button>
              )}
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

      {/* Styles moved to globals.css: .field, .btn, .btn-active, focus-visible ring */}
    </div>
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/30 text-[10px] leading-none text-white/70"
      title={text}
      aria-label={text}
    >
      i
    </span>
  );
}

function Field({ label, suffix, hint, children }: { label: string; suffix?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-white/70 mb-1 flex items-center gap-1">
        <span>{label}{suffix ? <span className="opacity-60"> {' '}{suffix}</span> : null}</span>
        {hint ? <Tooltip text={hint} /> : null}
      </div>
      {children}
    </label>
  );
}

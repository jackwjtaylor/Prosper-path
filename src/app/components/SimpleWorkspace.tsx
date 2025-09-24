"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRealtimeSession } from '@/app/hooks/useRealtimeSession';
import { makeRealtimeAgent } from '@/app/agentConfigs/realtimeOnly';
import { useAppStore } from '@/app/state/store';
import { useOnboardingStore } from '@/app/state/onboarding';
import { ensureHouseholdId } from '@/app/lib/householdLocal';

type SlotVal = number | string | boolean | null;

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-xs text-white/80">
      {children}
    </span>
  );
}

function PersonaBanner() {
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
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

function ProgressTracker({ step }: { step: 1|2|3 }) {
  const items = ['Get Your Money Snapshot', 'Preview Your Prosper Plan', 'Lock Weekly Wins'];
  return (
    <div className="flex items-center gap-2 text-[11px] md:text-xs">
      {items.map((label, i) => {
        const active = step === (i+1 as 1|2|3);
        return (
          <div key={label} className={`inline-flex items-center gap-2 ${active ? 'text-white' : 'text-white/70'}`}>
            <span className={`px-2 py-1 rounded-full border ${active ? 'border-white/60 bg-white/10' : 'border-white/20 bg-white/5'}`}>{label}</span>
            {i < items.length - 1 && <span className="opacity-30">•</span>}
          </div>
        );
      })}
    </div>
  );
}

export default function SimpleWorkspace() {
  const router = useRouter();
  const persona = useOnboardingStore((s) => s.persona);
  const draft = useOnboardingStore((s) => s.draft);
  const selectedVoice = useAppStore(s => s.voice);
  const [householdId, setHouseholdId] = React.useState<string>('');
  React.useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);
  // Hydrate persona from latest snapshot on mount as a safety net
  const updatePersona = useOnboardingStore(s => s.updatePersona);
  React.useEffect(() => {
    (async () => {
      try {
        if (!householdId) return;
        const res = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`, { cache: 'no-store' });
        const j = await res.json();
        const inputs = (j?.latestSnapshot?.inputs || {}) as Record<string, any>;
        const p: any = {};
        const fullName = inputs.full_name || inputs.name || inputs.first_name || inputs.given_name;
        if (typeof fullName === 'string' && fullName.trim()) p.name = fullName.trim().split(/[\s,]+/)[0];
        if (typeof inputs.city === 'string') p.city = inputs.city;
        if (typeof inputs.country === 'string') p.country = inputs.country;
        const by = (inputs as any)?.slots?.birth_year?.value || inputs.birth_year;
        if (by && Number.isFinite(Number(by))) {
          const yr = Number(by); const now = new Date().getUTCFullYear(); const age = Math.max(0, now - yr); const decade = Math.floor(age / 10) * 10;
          if (decade >= 10) p.ageDecade = (decade.toString() + 's') as any;
        }
        const partnerVal = (typeof inputs.partner === 'boolean') ? inputs.partner : (inputs as any)?.slots?.partner?.value;
        if (typeof partnerVal === 'boolean') p.partner = partnerVal;
        const kids = inputs.childrenCount ?? inputs.children ?? (inputs as any)?.slots?.dependants_count?.value;
        if (kids != null && Number.isFinite(Number(kids))) p.childrenCount = Number(kids);
        const tone = (inputs.tone || inputs.tone_preference || '').toString().toLowerCase();
        if (tone.includes('straight')) p.tone = 'straight';
        else if (tone.includes('relax') || tone.includes('laid')) p.tone = 'relaxed';
        if (typeof inputs.primaryGoal === 'string' && inputs.primaryGoal.trim()) p.primaryGoal = inputs.primaryGoal.trim();
        if (Object.keys(p).length) updatePersona(p);
      } catch {}
    })();
  }, [householdId, updatePersona]);
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
  const [built, setBuilt] = React.useState<boolean>(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [unlocked, setUnlocked] = React.useState<Set<string>>(new Set());

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
        try { await coachConnect({ getEphemeralKey, initialAgents: [makeRealtimeAgent(selectedVoice || 'cedar')], audioElement: coachAudioRef.current! }); } catch {}
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
  // Auto-fill after snapshot saved by voice
  React.useEffect(() => {
    const onSaved = async () => {
      try {
        const res = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`, { cache: 'no-store' });
        const j = await res.json();
        const slots = (j?.latestSnapshot?.inputs?.slots || {}) as Record<string, any>;
        const setIfEmpty = (cur: string, next?: number) => (cur === '' && typeof next === 'number' ? String(next) : cur);
        const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
        setNetIncomeSelf((cur) => setIfEmpty(cur, toNum(slots?.net_income_monthly_self?.value)));
        setNetIncomePartner((cur) => setIfEmpty(cur, toNum(slots?.net_income_monthly_partner?.value)));
        setEssentialExp((cur) => setIfEmpty(cur, toNum(slots?.essential_expenses_monthly?.value)));
        const hs = slots?.housing_status?.value; if ((hs === 'rent' || hs === 'own' || hs === 'other') && housing !== hs) setHousing(hs);
        if (hs === 'rent') setRent((cur) => setIfEmpty(cur, toNum(slots?.rent_monthly?.value)));
        if (hs === 'own') setMortgagePmt((cur) => setIfEmpty(cur, toNum(slots?.mortgage_payment_monthly?.value)));
        setCash((cur) => setIfEmpty(cur, toNum(slots?.cash_liquid_total?.value)));
        setDebtPmts((cur) => setIfEmpty(cur, toNum(slots?.other_debt_payments_monthly_total?.value)));
        setDebtTotal((cur) => setIfEmpty(cur, toNum(slots?.other_debt_balances_total?.value)));
      } catch {}
    };
    window.addEventListener('pp:snapshot_saved', onSaved as any);
    return () => window.removeEventListener('pp:snapshot_saved', onSaved as any);
  }, [householdId, housing]);

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
        await explainConnect({ getEphemeralKey, initialAgents: [makeRealtimeAgent(selectedVoice || 'cedar')], audioElement: audioRef.current! });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netIncomeSelf, netIncomePartner, hasPartner, essentialExp, rent, mortgagePmt, cash, debtPmts, debtTotal, persona.childrenCount, persona.primaryGoal, housing, unlocked]);

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
        const j = await res.json();
        setError('Free limit reached — please sign in or upgrade to continue.');
      } else if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j?.error || 'Could not build your plan yet.');
      } else {
        log('simple_build_plan', { selected });
        setBuilt(true);
        // After snapshot, fetch dashboard to derive gating unlocks
        try {
          const resDash = await fetch(`/api/prosper/dashboard?householdId=${encodeURIComponent(householdId)}`, { cache: 'no-store' });
          const j = await resDash.json();
          const k = j?.latestSnapshot?.kpis || {};
          const ef = Number(k?.ef_months || 0);
          const dti = Number(k?.dti_stock || 0);
          const nu = new Set<string>();
          if (ef >= 1) nu.add('prosper-pots');
          if (ef >= 3) { nu.add('emergency-fund-3m'); nu.add('invest-automation'); }
          if (ef >= 3 && (!Number.isFinite(dti) || dti < 0.3)) nu.add('invest-long-term');
          setUnlocked(nu);
        } catch {}
      }
    } catch (e: any) {
      setError('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

  const explainTile = (tile: { id: string; title: string }) => {
    openExplain(tile.title);
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

  // Listen live for onboarding profile events while on Simple (in case agent adds more numbers later)
  React.useEffect(() => {
    const handler = (e: any) => {
      try {
        const slots = (e?.detail?.slots || {}) as Record<string, any>;
        const inputs = (e?.detail?.inputs || {}) as Record<string, any>;
        const pickNum = (...cands: any[]) => {
          for (const c of cands) { const n = Number(c); if (Number.isFinite(n)) return String(n); }
          return '';
        };
        const hs = (slots?.housing_status?.value || inputs.housing || inputs.housing_status) as any;
        if ((hs === 'rent' || hs === 'own' || hs === 'other') && housing !== hs) setHousing(hs);
        const partnerVal = (typeof inputs.partner === 'boolean') ? inputs.partner : (slots?.partner?.value as any);
        if (typeof partnerVal === 'boolean') setHasPartner(partnerVal);
        if (!netIncomeSelf) setNetIncomeSelf(pickNum(slots?.net_income_monthly_self?.value, inputs.income_net_monthly, inputs.net_income_monthly_self));
        if (!netIncomePartner && (hasPartner || partnerVal === true)) setNetIncomePartner(pickNum(slots?.net_income_monthly_partner?.value, inputs.income_net_monthly_partner, inputs.net_income_monthly_partner));
        if (!essentialExp) setEssentialExp(pickNum(slots?.essential_expenses_monthly?.value, inputs.essential_expenses_monthly, inputs.essentials_monthly));
        if (!rent && (hs === 'rent' || housing === 'rent')) setRent(pickNum(slots?.rent_monthly?.value, inputs.rent_monthly));
        if (!mortgagePmt && (hs === 'own' || housing === 'own')) setMortgagePmt(pickNum(slots?.mortgage_payment_monthly?.value, inputs.mortgage_payment_monthly));
        if (!cash) setCash(pickNum(slots?.cash_liquid_total?.value, inputs.cash_liquid_total, inputs.emergency_savings_liquid));
        if (!debtPmts) setDebtPmts(pickNum(slots?.other_debt_payments_monthly_total?.value, inputs.debt_required_payments_monthly));
        if (!debtTotal) setDebtTotal(pickNum(slots?.other_debt_balances_total?.value, inputs.debt_balances_total));
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl md:text-3xl font-semibold text-white">Welcome{persona?.name ? `, ${persona.name}` : ''}</h2>
                  <p className="text-white/80 text-sm md:text-base mt-1">Today we’ll stabilise your cash flow and set up your first two wins.</p>
                </div>
                <ProgressTracker step={1} />
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Net income (you)" suffix="/mo">
                  <input value={netIncomeSelf} onChange={(e) => setNetIncomeSelf(e.target.value)} placeholder="e.g., 3200" className="field" />
                </Field>
                <Field label="Essential expenses" suffix="/mo">
                  <input value={essentialExp} onChange={(e) => setEssentialExp(e.target.value)} placeholder="e.g., 1800" className="field" />
                </Field>

                <Field label="Do you manage with a partner?">
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => setHasPartner(false)} className={`btn ${!hasPartner ? 'btn-active' : ''}`}>Solo</button>
                    <button onClick={() => setHasPartner(true)} className={`btn ${hasPartner ? 'btn-active' : ''}`}>With partner</button>
                  </div>
                </Field>
                {hasPartner && (
                  <Field label="Net income (partner)" suffix="/mo">
                    <input value={netIncomePartner} onChange={(e) => setNetIncomePartner(e.target.value)} placeholder="e.g., 2600" className="field" />
                  </Field>
                )}

                <Field label="Housing">
                  <div className="flex items-center gap-3 text-sm">
                    <button onClick={() => setHousing('rent')} className={`btn ${housing==='rent' ? 'btn-active' : ''}`}>Rent</button>
                    <button onClick={() => setHousing('own')} className={`btn ${housing==='own' ? 'btn-active' : ''}`}>Own</button>
                    <button onClick={() => setHousing('other')} className={`btn ${housing==='other' ? 'btn-active' : ''}`}>Other</button>
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

              {/* Plan tiles */}
              <div className="mt-8">
                <div className="text-sm text-white/80 mb-2">Recommended starting points</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {planTiles.map(tile => (
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
                        {!tile.gated && (
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
                        )}
                        {tile.gated && (
                          <span className="text-[10px] px-2 py-1 rounded-full border border-white/20">Coming soon</span>
                        )}
                      </div>
                      {/* Removed extra 'Explain this' link to reduce UI noise; whole tile opens explain */}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-white/70 mt-2">Pick up to two. We’ll unlock more after your first wins.</div>
              </div>

              {error && <div className="mt-4 text-sm text-red-200">{error}</div>}

              <div className="mt-6 flex flex-col md:flex-row items-center gap-3">
                <button onClick={buildPlan} disabled={saving} className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50">
                  {saving ? 'Building your plan…' : 'Build my Prosper Plan →'}
                </button>
                <div className="text-xs text-white/70">Takes under a minute. We’ll pick the first 2 actions together.</div>
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

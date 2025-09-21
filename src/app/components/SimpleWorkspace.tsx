"use client";
import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  const [householdId, setHouseholdId] = React.useState<string>('');
  React.useEffect(() => { ensureHouseholdId().then(setHouseholdId); }, []);

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
    tiles.push({ id: 'emergency-fund-3m', title: 'Increase your emergency fund', blurb: 'Grow your cushion to ~3 months for real security.', gated: true });

    // Automation & investing (gate until foundations + cash buffer and no unhealthy debt)
    tiles.push({ id: 'prosper-pots', title: 'Set up your Prosper Pots', blurb: 'Automate your money so good choices happen by default.', gated: true });
    tiles.push({ id: 'invest-automation', title: 'Automate your investing', blurb: 'Tax‑efficient, automatic contributions toward long‑term growth.', gated: true });
    tiles.push({ id: 'invest-long-term', title: 'Invest for long‑term growth', blurb: 'Put your Prosper cash to work steadily over time.', gated: true });

    // Recommend at most two
    const recs = tiles.filter(t => t.recommended && !t.gated).slice(0, 2);
    // Preselect up to two
    if (selected.length === 0 && recs.length) setSelected(recs.map(r => r.id));
    return tiles;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netIncomeSelf, netIncomePartner, hasPartner, essentialExp, rent, mortgagePmt, cash, debtPmts, debtTotal, persona.childrenCount, persona.primaryGoal, housing]);

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
        // Head to the main app (dashboard) to continue with actions
        router.push('/app/app');
      }
    } catch (e: any) {
      setError('Something went wrong while saving.');
    } finally {
      setSaving(false);
    }
  };

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
            <div className="rounded-2xl border border-white/10 bg-white/10 backdrop-blur-md p-6 md:p-8 shadow-xl">
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
                    <button
                      key={tile.id}
                      type="button"
                      role="switch"
                      aria-checked={selected.includes(tile.id)}
                      aria-label={`Action: ${tile.title}${tile.gated ? ' (coming soon)' : ''}`}
                      onClick={() => !tile.gated && toggleSelect(tile.id)}
                      disabled={!!tile.gated}
                      className={`text-left rounded-xl border p-4 transition ${
                        tile.gated
                          ? 'border-white/10 bg-white/5 text-white/50 cursor-not-allowed'
                          : selected.includes(tile.id)
                            ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                            : 'border-white/15 bg-white/8 text-white/90 hover:bg-white/12'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{tile.title}</div>
                          <div className="text-xs mt-1 opacity-80">{tile.blurb}</div>
                          {tile.reason && <div className="text-[11px] mt-1 opacity-70">{tile.reason}</div>}
                        </div>
                        {!tile.gated && (
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${selected.includes(tile.id) ? 'border-emerald-300 bg-emerald-300/20' : 'border-white/30'}`}>
                            {selected.includes(tile.id) ? '✓' : '+'}
                          </span>
                        )}
                        {tile.gated && (
                          <span className="text-[10px] px-2 py-1 rounded-full border border-white/20">Coming soon</span>
                        )}
                      </div>
                    </button>
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

      {/* Voice dock placeholder to match app style */}
      <div className="hidden md:block fixed bottom-4 right-4 z-30">
        <Link href="/app/app" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/20">Open full app</Link>
      </div>
      <style jsx global>{`
        .field { width: 100%; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: transparent; padding: 10px 12px; color: #fff; outline: none; }
        .field::placeholder { color: rgba(255,255,255,0.4); }
        .btn { border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.06); padding: 6px 10px; border-radius: 999px; color: #fff; }
        .btn-active { border-color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.15); }
        button:focus-visible { outline: none; box-shadow: 0 0 0 2px rgba(110,231,183,0.8); }
      `}</style>
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

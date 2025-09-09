import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { generateTwoBestActions } from "@/app/lib/recommendationsV2";

export type Confidence = 'low'|'med'|'high';

export async function ensureHouseholdExists(householdId: string) {
  const { data: hh, error: hhErr } = await supabase
    .from('households')
    .select('id')
    .eq('id', householdId)
    .maybeSingle();
  if (hhErr) throw new Error(hhErr.message);
  if (!hh) {
    const { error: insErr } = await supabase.from('households').insert({ id: householdId });
    if (insErr) throw new Error(insErr.message);
  }
}

export async function loadLatestInputs(householdId: string): Promise<Record<string, any>> {
  const { data: snaps } = await supabase
    .from('snapshots')
    .select('id, created_at, inputs')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(1);
  return (snaps?.[0]?.inputs as any) || {};
}

export function canonicalSlotKey(k: string): string {
  const s = (k || '').toLowerCase();
  const map: Record<string, string> = {
    cash: 'cash_liquid_total',
    cash_total: 'cash_liquid_total',
    savings: 'cash_liquid_total',
    term_deposit: 'term_deposits_le_3m',
    term_deposits: 'term_deposits_le_3m',
    fixed_savings: 'term_deposits_le_3m',
    investments: 'investments_ex_home_total',
    investments_total: 'investments_ex_home_total',
    investment_total: 'investments_ex_home_total',
    stocks_total: 'investments_ex_home_total',
    pension_balance: 'pension_balance_total',
    pension_total: 'pension_balance_total',
    pension_contribution: 'pension_contrib_pct',
    pension_pct: 'pension_contrib_pct',
    rent: 'rent_monthly',
    mortgage_payment: 'mortgage_payment_monthly',
    essential_expenses: 'essential_expenses_monthly',
    total_expenses: 'total_expenses_monthly',
    other_debt_payments: 'other_debt_payments_monthly_total',
    other_debt_total: 'other_debt_balances_total',
    debts_total: 'debts_total',
    credit_score: 'credit_score_normalised_0_1',
    credit_score_normalized: 'credit_score_normalised_0_1',
    birthyear: 'birth_year',
    year_of_birth: 'birth_year',
    date_of_birth: 'birth_year',
    dob: 'birth_year',
    born: 'birth_year',
    age: 'birth_year',
    dependants: 'dependants_count',
    dependents: 'dependants_count',
    kids: 'dependants_count',
    sick_pay: 'sick_pay_months_full',
    sickpay: 'sick_pay_months_full',
    sick_pay_months: 'sick_pay_months_full',
    sickpay_months: 'sick_pay_months_full',
    sick_pay_full: 'sick_pay_months_full',
    sick_full: 'sick_pay_months_full',
    full_sick_pay_months: 'sick_pay_months_full',
    sick_pay_half: 'sick_pay_months_half',
    sick_half: 'sick_pay_months_half',
    half_sick_pay_months: 'sick_pay_months_half',
  };
  return map[s] || k;
}

export async function computeAndPersist(
  householdId: string,
  inputs: Record<string, any>,
) {
  const slots: Slots | undefined = inputs?.slots && typeof inputs.slots === 'object' ? (inputs.slots as Slots) : undefined;

  let kpis: any = null;
  let gates: any = null;
  let normalized: any = null;
  if (slots) {
    const r = computeKpisV2(slots);
    kpis = r.kpis;
    gates = r.gates;
    normalized = r.normalized;
  }
  const levels = assignLevelsV2(kpis || {}, gates || {});
  const recommendations = generateTwoBestActions(kpis || {}, gates || {});

  const payload: any = {
    household_id: householdId,
    inputs,
    kpis: { ...(kpis || {}), engine_version: 'v2', gates: gates || {} },
    levels,
    recommendations,
    provisional_keys: [],
  };
  const { data: snap, error: snapErr } = await supabase
    .from('snapshots')
    .insert(payload)
    .select('id, created_at')
    .single();
  if (snapErr) throw new Error(snapErr.message);

  const nw = normalized?.net_worth;
  if (typeof nw === 'number' && Number.isFinite(nw)) {
    try { await supabase.from('net_worth_points').insert({ household_id: householdId, ts: new Date().toISOString(), value: nw }); } catch {}
  }

  return {
    id: snap?.id,
    created_at: snap?.created_at,
    inputs,
    kpis: { ...(kpis || {}), engine_version: 'v2', gates: gates || {} },
    levels,
    recommendations,
  };
}

export async function updateSnapshotMerge(
  householdId: string,
  mergeInputs: Record<string, any> = {},
  mergeSlots: Record<string, { value: any; confidence?: Confidence }> = {}
) {
  await ensureHouseholdExists(householdId);
  const latest = await loadLatestInputs(householdId);
  const slots = { ...((latest?.slots as any) || {}) } as Record<string, any>;
  for (const [k, v] of Object.entries(mergeSlots || {})) {
    const key = canonicalSlotKey(k);
    slots[key] = { value: (v as any)?.value ?? null, confidence: (v as any)?.confidence ?? 'med' };
  }
  const inputs = { ...latest, ...mergeInputs, slots };
  return await computeAndPersist(householdId, inputs);
}

export async function updateSnapshotDeltas(
  householdId: string,
  deltas: Record<string, number>,
  confidences: Record<string, Confidence> = {}
) {
  await ensureHouseholdExists(householdId);
  const latest = await loadLatestInputs(householdId);
  const slots = { ...((latest?.slots as any) || {}) } as Record<string, any>;
  for (const [k, delta] of Object.entries(deltas || {})) {
    const key = canonicalSlotKey(k);
    const cur = Number((slots?.[key]?.value ?? 0) as number) || 0;
    let next = cur + Number(delta || 0);
    if (!Number.isFinite(next)) next = cur;
    if (next < 0) next = 0;
    slots[key] = { value: next, confidence: confidences[key] ?? 'med' };
  }
  const inputs = { ...latest, slots };
  return await computeAndPersist(householdId, inputs);
}

export async function updateSnapshotSingleSlot(
  householdId: string,
  key: string,
  value: any,
  confidence: Confidence = 'high'
) {
  const mergeSlots: Record<string, { value: any; confidence?: Confidence }> = {};
  mergeSlots[canonicalSlotKey(key)] = { value, confidence };
  return await updateSnapshotMerge(householdId, {}, mergeSlots);
}

// --------- Pure helpers for testing / reuse (no DB writes) ---------
export function mergeInputsAndSlots(
  latest: Record<string, any>,
  mergeInputs: Record<string, any> = {},
  mergeSlots: Record<string, { value: any; confidence?: Confidence }> = {}
) {
  const slots = { ...((latest?.slots as any) || {}) } as Record<string, any>;
  for (const [k, v] of Object.entries(mergeSlots || {})) {
    const key = canonicalSlotKey(k);
    slots[key] = { value: (v as any)?.value ?? null, confidence: (v as any)?.confidence ?? 'med' };
  }
  return { ...latest, ...mergeInputs, slots };
}

export function applyDeltasToSlots(
  latestSlots: Record<string, any> = {},
  deltas: Record<string, number> = {},
  confidences: Record<string, Confidence> = {}
) {
  const slots = { ...(latestSlots || {}) } as Record<string, any>;
  for (const [k, delta] of Object.entries(deltas || {})) {
    const key = canonicalSlotKey(k);
    const cur = Number((slots?.[key]?.value ?? 0) as number) || 0;
    let next = cur + Number(delta || 0);
    if (!Number.isFinite(next)) next = cur;
    if (next < 0) next = 0;
    slots[key] = { value: next, confidence: confidences[key] ?? 'med' };
  }
  return slots;
}

export function computeSnapshot(inputs: Record<string, any>) {
  const slots = (inputs?.slots || {}) as Slots;
  const { kpis, gates, normalized } = computeKpisV2(slots);
  const levels = assignLevelsV2(kpis, gates);
  const recommendations = generateTwoBestActions(kpis as any, gates as any);
  return { kpis, gates, levels, recommendations, normalized };
}

// --------- Paywall enforcement (shared) ---------
export async function enforceMeteredPaywall(
  householdId: string,
  opts: { origin?: string; email?: string; isAuthed?: boolean } = {}
): Promise<{ ok: true } | { ok: false; status: 402; upgrade_url?: string; login_url?: string } > {
  const { origin, email, isAuthed } = opts;
  const { data: hh } = await supabase
    .from('households')
    .select('subscription_status,current_period_end')
    .eq('id', householdId)
    .maybeSingle();
  const sub = (hh as any)?.subscription_status || null;
  const periodEnd = (hh as any)?.current_period_end ? Date.parse((hh as any).current_period_end) : 0;
  const now = Date.now();
  const premium = !!sub && ['active','trialing','past_due'].includes(sub) && (periodEnd === 0 || periodEnd > now);
  if (premium) return { ok: true };

  const { count } = await supabase
    .from('snapshots')
    .select('id', { count: 'exact', head: true })
    .eq('household_id', householdId);
  const used = count ?? 0;
  const freeLimit = Number(process.env.FREE_SNAPSHOT_LIMIT || 3);
  if (used < freeLimit) return { ok: true };

  if (isAuthed && origin) {
    try {
      const r = await fetch(`${origin}/api/billing/create-checkout-session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ householdId, email })
      });
      const j = await r.json();
      return { ok: false, status: 402, upgrade_url: j?.url };
    } catch {
      return { ok: false, status: 402, login_url: '/login' };
    }
  }
  return { ok: false, status: 402, login_url: '/login' };
}

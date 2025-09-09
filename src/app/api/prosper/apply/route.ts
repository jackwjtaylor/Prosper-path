import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { updateSnapshotMerge, enforceMeteredPaywall } from "@/app/lib/snapshotService";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";
import { parseBirthYear, parseBoolean, parseIntegerFromText, parsePercentFraction } from "@/app/lib/finance/normalize";

type SlotDelta = { value: any; confidence?: 'low'|'med'|'high' };

function canonicalSlotKey(k: string): string {
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
    // Personal details
    birthyear: 'birth_year',
    year_of_birth: 'birth_year',
    date_of_birth: 'birth_year',
    dob: 'birth_year',
    born: 'birth_year',
    age: 'birth_year', // will be converted in coerce
    names: 'full_name',
    name: 'full_name',
    email_address: 'email',
    country_code: 'country',
    zip: 'postcode',
    postal_code: 'postcode',
    zip_code: 'postcode',
    has_partner: 'partner',
    dependants: 'dependants_count',
    dependents: 'dependants_count',
    kids: 'dependants_count',
    employment: 'employment_status',
    job_status: 'employment_status',
    tenancy: 'housing_status',
    // Sick pay
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

function coerceSlotValue(slot: string, raw: any): any {
  const k = slot;
  if (k === 'birth_year') return parseBirthYear(raw);
  if (k === 'home_insured_ok' || k === 'income_protection_has' || k === 'partner' || k === 'homeowner') return parseBoolean(raw);
  if (k === 'pension_contrib_pct') return parsePercentFraction(raw);
  if (k === 'sick_pay_months_full' || k === 'sick_pay_months_half' || k === 'dependants_count') return parseIntegerFromText(raw);
  return raw;
}

const BodySchema = z.object({
  householdId: z.string().uuid().optional(),
  inputs: z.record(z.any()).optional(),
  slots: z
    .record(
      z.object({
        value: z.any(),
        confidence: z.enum(['low', 'med', 'high']).optional(),
      })
    )
    .optional(),
});

export const POST = withHouseholdAccess<z.infer<typeof BodySchema>>(
  BodySchema,
  'json',
  async ({ req, data, householdId, user }) => {
    // Enforce free-limit via shared service
    try {
      const origin = new URL(req.url).origin;
      const { data: hh } = await supabase.from('households').select('email').eq('id', householdId as string).maybeSingle();
      const check = await enforceMeteredPaywall(householdId as string, { origin, email: (hh as any)?.email, isAuthed: !!user });
      if (!check.ok) return NextResponse.json({ error: 'free_limit_exceeded', upgrade_url: (check as any).upgrade_url, login_url: (check as any).login_url }, { status: 402 });
    } catch {}

    // Load latest inputs
    const { data: snaps } = await supabase
      .from('snapshots')
      .select('id, created_at, inputs')
      .eq('household_id', householdId as string)
      .order('created_at', { ascending: false })
      .limit(1);
    const latest = snaps?.[0] || null;
    const existingInputs = (latest?.inputs as any) || {};
    const existingSlots = (existingInputs?.slots as Slots | undefined) || ({} as any);

    // Merge incoming
    const body = (data ?? {}) as Partial<z.infer<typeof BodySchema>>;
    const incomingInputs = (body.inputs && typeof body.inputs === 'object') ? body.inputs : {};
    const rawSlots = (body.slots && typeof body.slots === 'object') ? (body.slots as Record<string, SlotDelta>) : {};
    const incomingSlotsRaw: Record<string, SlotDelta> = {};
    for (const [key, v] of Object.entries(rawSlots)) {
      incomingSlotsRaw[canonicalSlotKey(key)] = v as SlotDelta;
    }

    const mergedSlots: any = {};
    for (const [k, v] of Object.entries(incomingSlotsRaw)) {
      const valRaw = (v as any)?.value;
      const val = coerceSlotValue(k, valRaw);
      const conf = (v as any)?.confidence ?? 'med';
      mergedSlots[k] = { value: val, confidence: conf };
    }
    const snapshot = await updateSnapshotMerge(householdId as string, incomingInputs, mergedSlots);
    return NextResponse.json({ ok: true, snapshot });
  },
  { rateLimit: { bucket: 'snapshot', limit: 20, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

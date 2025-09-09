import { NextResponse } from 'next/server';
import { mergeInputsAndSlots, applyDeltasToSlots, computeSnapshot } from '@/app/lib/snapshotService';

export async function GET() {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tests: Array<{ label: string; pass: boolean; value?: any; expected?: any }> = [];

  // Test: canonical merge
  const latest = { slots: { cash_liquid_total: { value: 1000, confidence: 'med' } } };
  const merged = mergeInputsAndSlots(latest, { currency: 'GBP' }, { savings: { value: 500 } });
  tests.push({ label: 'Merge adds canonical slot', pass: !!merged.slots?.cash_liquid_total });

  // Test: deltas application
  const slots2 = applyDeltasToSlots(merged.slots, { cash: 250, investments: 750 }, { investments: 'med' as any });
  tests.push({ label: 'Deltas increase cash + investments', pass: slots2.cash_liquid_total.value === 1250 && slots2.investments_ex_home_total.value === 750 });

  // Test: compute snapshot yields EF and Level
  const inputs = { ...merged, slots: { ...slots2, essential_expenses_monthly: { value: 500 } } };
  const comp = computeSnapshot(inputs);
  tests.push({ label: 'Compute has EF months', pass: typeof comp.kpis?.ef_months === 'number' });
  tests.push({ label: 'Compute yields levels', pass: !!comp.levels });

  return NextResponse.json({ ok: tests.every(t => t.pass), tests });
}

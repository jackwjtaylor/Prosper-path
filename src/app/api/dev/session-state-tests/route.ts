import { NextResponse } from 'next/server';
import { SessionState, computeFingerprint, stableStringify } from '@/app/agentConfigs/sessionState';

export async function GET() {
  if (process.env.NEXT_PUBLIC_DEV_ROUTES !== '1') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const tests: Array<{ label: string; pass: boolean; actual?: any; expected?: any }> = [];

  // Test 1: Isolation between instances
  const s1 = new SessionState();
  const s2 = new SessionState();
  s1.lastInputs = { a: 1 };
  const f1 = computeFingerprint(s1);
  const f2 = computeFingerprint(s2);
  tests.push({ label: 'Isolation: different instances produce different fingerprints', pass: f1 !== f2 });

  // Test 2: Fingerprint changes when KPIs change
  const s3 = new SessionState();
  const f3a = computeFingerprint(s3);
  s3.lastKpis = { sr: 0.1 };
  const f3b = computeFingerprint(s3);
  tests.push({ label: 'Fingerprint changes when KPIs change', pass: f3a !== f3b });

  // Test 3: Stable ordering
  const o1 = { b: 2, a: 1, c: { y: 2, x: 1 } };
  const o2 = { a: 1, c: { x: 1, y: 2 }, b: 2 };
  const s4 = new SessionState();
  const s5 = new SessionState();
  s4.lastInputs = o1; s5.lastInputs = o2;
  tests.push({ label: 'Stable stringify returns equal strings for equal objects regardless of key order', pass: stableStringify(o1) === stableStringify(o2) });
  tests.push({ label: 'Fingerprint equal for equal content regardless of key order', pass: computeFingerprint(s4) === computeFingerprint(s5) });

  const ok = tests.every(t => t.pass);
  return NextResponse.json({ ok, tests });
}

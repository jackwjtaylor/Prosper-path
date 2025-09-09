export class SessionState {
  lastInputs: Record<string, any> | null = null;
  lastSlots: Record<string, any> | null = null;
  lastKpis: any = null;
  lastGates: any = null;
  lastLevels: any = null;
  lastPersistFingerprint: string | null = null;
  lastRecommendations: any = null;
}

// Stable stringify (sorted keys) for deterministic fingerprints
export function stableStringify(value: any): string {
  const seen = new WeakSet();
  const stringify = (v: any): any => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v)) return '[Circular]';
    seen.add(v);
    if (Array.isArray(v)) return v.map(stringify);
    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = stringify(v[k]);
    return out;
  };
  try {
    return JSON.stringify(stringify(value));
  } catch {
    return JSON.stringify({});
  }
}

export function computeFingerprint(state: SessionState): string {
  const basis = {
    inputs: state.lastInputs || {},
    kpis: state.lastKpis || {},
    levels: state.lastLevels || {},
    recs: state.lastRecommendations || {},
  };
  return stableStringify(basis);
}


import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { computeAndPersist, enforceMeteredPaywall } from "@/app/lib/snapshotService";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";

/**
 * POST /api/prosper/snapshots
 * Persists a snapshot of inputs + kpis + levels (optionally recommendations), and
 * records a net worth point for the chart when computable.
 *
 * Accepts either { householdId } or { household_id } in the body for flexibility.
 */
const BodySchema = z.object({
  householdId: z.string().uuid().optional(),
  household_id: z.string().uuid().optional(),
  inputs: z.record(z.any()).optional(),
  kpis: z.record(z.any()).optional(),
  levels: z.record(z.any()).optional(),
  recommendations: z.any().optional(),
  provisional_keys: z.array(z.string()).optional(),
});

export const POST = withHouseholdAccess<z.infer<typeof BodySchema>>(
  BodySchema,
  'json',
  async ({ req, data, householdId, user }) => {
    const body = (data ?? {}) as z.infer<typeof BodySchema>;
    const effectiveId = (body.householdId || body.household_id || householdId) as string;
    // Enforce free-limit via shared service
    try {
      const origin = new URL(req.url).origin;
      const { data: hh } = await supabase.from('households').select('email').eq('id', effectiveId).maybeSingle();
      const check = await enforceMeteredPaywall(effectiveId, { origin, email: (hh as any)?.email, isAuthed: !!user });
      if (!check.ok) return NextResponse.json({ error: 'free_limit_exceeded', upgrade_url: (check as any).upgrade_url, login_url: (check as any).login_url }, { status: 402 });
    } catch {}

    // Ensure household exists (FK for snapshots)
    try {
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .eq('id', effectiveId)
        .maybeSingle();
      if (hhErr) throw hhErr;
      if (!hh) {
        const { error: insErr } = await supabase.from('households').insert({ id: effectiveId });
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'household_insert_failed', detail: e?.message || 'failed' }, { status: 500 });
    }

    const inputs = (body.inputs || {}) as Record<string, any>;
    const snapshot = await computeAndPersist(effectiveId, inputs);
    return NextResponse.json({ ok: true, id: snapshot.id, created_at: snapshot.created_at });
  },
  { rateLimit: { bucket: 'snapshot', limit: 20, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

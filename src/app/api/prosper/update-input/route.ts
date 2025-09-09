import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { updateSnapshotSingleSlot, enforceMeteredPaywall } from "@/app/lib/snapshotService";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";
import { parseByKind } from "@/app/lib/finance/normalize";

const BodySchema = z.object({
  householdId: z.string().uuid().optional(),
  key: z.string().min(1).max(100),
  value: z.any(),
  kind: z.enum(['money','percent','number','bool','text']).optional(),
});

// Parsing moved to finance/normalize.ts

export const POST = withHouseholdAccess<z.infer<typeof BodySchema>>(
  BodySchema,
  'json',
  async ({ req, data, householdId, user }) => {
    // Enforce free-limit (metered paywall) consistent with other write routes
    try {
      const origin = new URL(req.url).origin;
      const { data: hh } = await supabase.from('households').select('email').eq('id', householdId as string).maybeSingle();
      const check = await enforceMeteredPaywall(householdId as string, { origin, email: (hh as any)?.email, isAuthed: !!user });
      if (!check.ok) return NextResponse.json({ error: 'free_limit_exceeded', upgrade_url: (check as any).upgrade_url, login_url: (check as any).login_url }, { status: 402 });
    } catch {}

    const key = data.key;
    if (!key) return NextResponse.json({ error: 'key_required' }, { status: 400 });
    const val = parseByKind(data.kind || 'number', data.value);
    if (val == null && data.kind !== 'text') return NextResponse.json({ error: 'invalid_value' }, { status: 400 });

    const snapshot = await updateSnapshotSingleSlot(householdId as string, key, val, 'high');
    return NextResponse.json({ ok: true, id: snapshot.id, created_at: snapshot.created_at, kpis: snapshot.kpis, gates: (snapshot.kpis as any)?.gates, levels: snapshot.levels, recommendations: snapshot.recommendations });
  },
  { rateLimit: { bucket: 'snapshot', limit: 20, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

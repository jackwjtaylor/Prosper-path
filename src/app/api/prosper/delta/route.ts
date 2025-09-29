import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { updateSnapshotDeltas, enforceMeteredPaywall } from "@/app/lib/snapshotService";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";

const DeltaBodySchema = z.object({
  householdId: z.string().uuid().optional(),
  deltas: z.record(z.number().finite()),
  confidences: z.record(z.enum(['low','med','high'])).optional(),
});

export const POST = withHouseholdAccess<z.infer<typeof DeltaBodySchema>>(
  DeltaBodySchema,
  'json',
  async ({ req, data, householdId, user }) => {
    // Enforce free-limit via shared service
    try {
      const origin = new URL(req.url).origin;
      const { data: hh } = await supabase.from('households').select('email').eq('id', householdId as string).maybeSingle();
      const check = await enforceMeteredPaywall(householdId as string, { origin, email: (hh as any)?.email, isAuthed: !!user });
      if (!check.ok) return NextResponse.json({ error: 'free_limit_exceeded', upgrade_url: (check as any).upgrade_url, login_url: (check as any).login_url }, { status: 402 });
    } catch {}

    const body = (data ?? {}) as z.infer<typeof DeltaBodySchema>;
    const snapshot = await updateSnapshotDeltas(householdId!, body.deltas || {}, (body.confidences || {}) as any);
    return NextResponse.json({ ok: true, snapshot });
  },
  { rateLimit: { bucket: 'snapshot', limit: 20, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

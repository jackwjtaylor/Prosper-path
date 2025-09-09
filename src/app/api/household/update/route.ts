import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";

const BodySchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email().optional(),
  full_name: z.string().min(1).max(200).optional(),
});

export const POST = withHouseholdAccess<z.infer<typeof BodySchema>>(
  BodySchema,
  'json',
  async ({ data, householdId }) => {
    // Ensure row exists; upsert only provided fields to avoid clobbering
    const updates: any = { id: householdId };
    if (typeof data.email === 'string' && data.email.trim()) updates.email = data.email.trim();
    if (typeof data.full_name === 'string' && data.full_name.trim()) updates.full_name = data.full_name.trim();

    const { data: upserted, error } = await supabase
      .from('households')
      .upsert(updates, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    if (error) return NextResponse.json({ error: 'upsert_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: upserted?.id });
  },
  { sameOrigin: true, rateLimit: { bucket: 'household_update', limit: 30, windowMs: 60_000, addHouseholdToKey: true } }
);

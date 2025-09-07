import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { z, parseJson } from "@/app/api/_lib/validation";

const BodySchema = z.object({
  householdId: z.string().uuid(),
  email: z.string().email().optional(),
  full_name: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, BodySchema);
    if (!parsed.ok) return parsed.res;
    const { householdId, email, full_name } = parsed.data as z.infer<typeof BodySchema>;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    // Ensure row exists; upsert only provided fields to avoid clobbering
    const updates: any = { id: householdId };
    if (typeof email === 'string' && email.trim()) updates.email = email.trim();
    if (typeof full_name === 'string' && full_name.trim()) updates.full_name = full_name.trim();

    const { data, error } = await supabase
      .from('households')
      .upsert(updates, { onConflict: 'id' })
      .select('id')
      .maybeSingle();

    if (error) return NextResponse.json({ error: 'upsert_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

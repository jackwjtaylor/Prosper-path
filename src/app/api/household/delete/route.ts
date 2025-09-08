import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { z, parseJson } from "@/app/api/_lib/validation";
import { assertHouseholdAccess } from "@/app/lib/auth";

const BodySchema = z.object({ householdId: z.string().uuid() });

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, BodySchema);
    if (!parsed.ok) return parsed.res;
    const { householdId } = parsed.data as z.infer<typeof BodySchema>;
    const authz = await assertHouseholdAccess(req, householdId);
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.code });

    // Delete dependent rows (best-effort order to avoid FK constraints if any)
    try { await supabase.from('net_worth_points').delete().eq('household_id', householdId); } catch {}
    try { await supabase.from('snapshots').delete().eq('household_id', householdId); } catch {}
    try { await supabase.from('actions').delete().eq('household_id', householdId); } catch {}
    try { await supabase.from('feedback').delete().eq('household_id', householdId); } catch {}
    try { await supabase.from('households').delete().eq('id', householdId); } catch {}

    const res = NextResponse.json({ ok: true });
    try {
      const cookieStore = await cookies();
      cookieStore.set({ name: 'pp_household_id', value: '', path: '/', maxAge: 0 });
    } catch {}
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}


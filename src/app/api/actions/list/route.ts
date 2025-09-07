import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { z, parseQuery } from "@/app/api/_lib/validation";

export async function GET(req: NextRequest) {
  try {
    const q = parseQuery(req, z.object({ householdId: z.string().uuid().optional() }));
    if (!('ok' in q) || !q.ok) return q.res;
    const qId = q.data.householdId;
    const cookieStore = await cookies();
    const cId = cookieStore.get("pp_household_id")?.value;
    const householdId = qId || cId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    const { data, error } = await supabase
      .from('actions')
      .select('id, action_id, title, status, completed_at, notes')
      .eq('household_id', householdId)
      .order('completed_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

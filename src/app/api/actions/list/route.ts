import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";

export const GET = withHouseholdAccess<{ householdId?: string }>(
  z.object({ householdId: z.string().uuid().optional() }),
  'query',
  async ({ householdId }) => {
    const { data, error } = await supabase
      .from('actions')
      .select('id, action_id, title, status, completed_at, notes')
      .eq('household_id', householdId!)
      .order('completed_at', { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  },
  { rateLimit: { bucket: 'actions_list', limit: 60, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

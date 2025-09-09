import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";
import { cookies } from "next/headers";

const BodySchema = z.object({ householdId: z.string().uuid() });

export const POST = withHouseholdAccess<z.infer<typeof BodySchema>>(
  BodySchema,
  'json',
  async ({ data, householdId }) => {
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
  },
  { sameOrigin: true, rateLimit: { bucket: 'household_delete', limit: 10, windowMs: 60_000, addHouseholdToKey: true } }
);

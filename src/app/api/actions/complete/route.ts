import { NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { withHouseholdAccess, z } from "@/app/api/_lib/withApi";

const bodySchema = z.object({
  householdId: z.string().uuid().optional(),
  title: z.string().min(1).max(300).optional(),
  action_id: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withHouseholdAccess<z.infer<typeof bodySchema>>(
  bodySchema,
  'json',
  async ({ data, householdId }) => {
    const title = data?.title;
    const action_id = data?.action_id;
    const notes = data?.notes;
    if (!title && !action_id) return NextResponse.json({ error: 'title_or_action_id_required' }, { status: 400 });

    const row: any = {
      household_id: householdId,
      title: title?.toString().slice(0, 300) || null,
      action_id: action_id?.toString().slice(0, 200) || null,
      status: 'done',
      notes: notes?.toString().slice(0, 2000) || null,
      completed_at: new Date().toISOString(),
    };

    const { data: inserted, error } = await supabase
      .from('actions')
      .insert(row)
      .select('id, completed_at')
      .single();
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: inserted?.id, completed_at: inserted?.completed_at });
  },
  { rateLimit: { bucket: 'actions_write', limit: 30, windowMs: 60_000, addHouseholdToKey: true }, sameOrigin: true }
);

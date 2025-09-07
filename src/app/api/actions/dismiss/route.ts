import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { z, parseJson } from "@/app/api/_lib/validation";

export async function POST(req: NextRequest) {
  try {
    const schema = z.object({
      householdId: z.string().uuid().optional(),
      title: z.string().min(1).max(300).optional(),
      action_id: z.string().min(1).max(200).optional(),
      notes: z.string().max(2000).optional(),
    });
    const parsed = await parseJson(req, schema);
    if (!parsed.ok) return parsed.res;
    const body = parsed.data as z.infer<typeof schema>;
    const cookieStore = await cookies();
    const cookieId = cookieStore.get("pp_household_id")?.value;
    const householdId: string | undefined = body?.householdId || cookieId;
    const title: string | undefined = body?.title;
    const action_id: string | undefined = body?.action_id;
    const notes: string | undefined = body?.notes;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });
    if (!title && !action_id) return NextResponse.json({ error: 'title_or_action_id_required' }, { status: 400 });

    const row: any = {
      household_id: householdId,
      title: title?.toString().slice(0, 300) || null,
      action_id: action_id?.toString().slice(0, 200) || null,
      status: 'dismissed',
      notes: notes?.toString().slice(0, 2000) || null,
    };

    const { data, error } = await supabase
      .from('actions')
      .insert(row)
      .select('id')
      .single();
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

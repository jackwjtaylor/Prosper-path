import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { z, parseJson } from "@/app/api/_lib/validation";

export async function POST(req: NextRequest) {
  const dev = process.env.NEXT_PUBLIC_DEV_ROUTES === '1';
  const token = req.headers.get('x-admin-token');
  const envToken = process.env.FEEDBACK_ADMIN_TOKEN;
  if (!dev && (!envToken || token !== envToken)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    const schema = z.object({ id: z.string().uuid(), status: z.string().optional(), priority: z.string().optional() });
    const parsed = await parseJson(req, schema);
    if (!parsed.ok) return parsed.res;
    const body = parsed.data as z.infer<typeof schema>;
    const id = body.id;
    if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
    const patch: any = {};
    if (body.status) patch.status = String(body.status);
    if (body.priority) patch.priority = String(body.priority);
    const { error } = await supabase.from('feedback').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

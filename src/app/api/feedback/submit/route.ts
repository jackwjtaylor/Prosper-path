import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { z, parseJson } from "@/app/api/_lib/validation";

const FBBody = z.object({
  householdId: z.string().uuid().optional(),
  name: z.string().max(200).optional(),
  email: z.string().email().optional(),
  category: z.string().max(50).optional(),
  severity: z.string().max(50).optional(),
  message: z.string().max(5000).optional(),
  page_url: z.string().max(1000).optional(),
  extra: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJson(req, FBBody);
    if (!parsed.ok) return parsed.res;
    const body = parsed.data as z.infer<typeof FBBody>;
    const cookieStore = await cookies();
    const cookieId = cookieStore.get("pp_household_id")?.value;
    const householdId = body.householdId || cookieId || null;
    const ua = req.headers.get('user-agent') || '';

    const row: any = {
      household_id: householdId,
      name: (body.name || '').toString().slice(0, 200) || null,
      email: (body.email || '').toString().slice(0, 200) || null,
      category: (body.category || '').toString().slice(0, 50) || null,
      severity: (body.severity || '').toString().slice(0, 50) || null,
      message: (body.message || '').toString().slice(0, 5000) || '',
      page_url: (body.page_url || '').toString().slice(0, 1000) || null,
      user_agent: ua.slice(0, 500),
      status: 'open',
      priority: 'p3',
      extra: body.extra || {},
    };

    const { data, error } = await supabase
      .from('feedback')
      .insert(row)
      .select('id, created_at')
      .single();
    if (error) return NextResponse.json({ error: 'insert_failed', detail: error.message }, { status: 500 });

    // Optional Slack notification
    try {
      const hook = process.env.SLACK_WEBHOOK_URL;
      if (hook) {
        const sev = row.severity || 'med';
        const cat = row.category || 'other';
        const emoji = sev === 'critical' ? '🚨' : sev === 'high' ? '⚠️' : sev === 'med' ? '📝' : '💡';
        const text = `${emoji} *Feedback* (${cat}/${sev})\n${row.message || ''}\n\nFrom: ${row.name || 'anon'} ${row.email ? `<${row.email}>` : ''}\nHousehold: ${householdId || '-'}\nPage: ${row.page_url || '-'}\nUA: ${ua}`;
        await fetch(hook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      }
    } catch {}

    return NextResponse.json({ ok: true, id: data?.id, created_at: data?.created_at });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

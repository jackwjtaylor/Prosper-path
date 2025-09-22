import { NextResponse } from 'next/server';
import { withApi, z } from '@/app/api/_lib/withApi';
import supabase from '@/app/lib/supabaseServer';

const BodySchema = z.object({
  id: z.string().uuid(),
  status: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
});

export const POST = withApi<z.infer<typeof BodySchema>>(
  { parse: 'json', schema: BodySchema, sameOrigin: true, rateLimit: { bucket: 'leads_update', limit: 30, windowMs: 60_000 } },
  async ({ data }) => {
    const patch: any = {};
    if (typeof data?.status === 'string') patch.status = data.status;
    if (typeof data?.notes === 'string') patch.notes = data.notes;
    if (!Object.keys(patch).length) return NextResponse.json({ ok: true });
    try {
      const { error } = await supabase.from('prosper_leads').update(patch).eq('id', data!.id);
      if (error) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
      return NextResponse.json({ ok: true });
    } catch {
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }
);


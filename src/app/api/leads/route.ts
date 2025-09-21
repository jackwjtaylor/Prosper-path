import { NextResponse } from 'next/server';
import { withApi, z } from '@/app/api/_lib/withApi';
import supabase from '@/app/lib/supabaseServer';

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(6).max(30).optional(),
  city: z.string().max(200).optional(),
  country: z.string().max(100).optional(),
  ageDecade: z.string().max(10).optional(),
  partner: z.boolean().optional(),
  childrenCount: z.number().int().min(0).max(20).optional(),
  tone: z.string().max(20).optional(),
  primaryGoal: z.string().max(400).optional(),
  triedBefore: z.string().max(400).optional(),
});

export const POST = withApi<z.infer<typeof BodySchema>>(
  { parse: 'json', schema: BodySchema, sameOrigin: true, rateLimit: { bucket: 'lead_capture', limit: 30, windowMs: 60_000 } },
  async ({ data, householdId }) => {
    const payload = { ...data, householdId: householdId || null, ts: new Date().toISOString() } as any;
    // Try to persist to Supabase if table exists; otherwise fall back to server log
    try {
      const row: any = {
        household_id: payload.householdId,
        name: (payload.name || null),
        email: (payload.email || null),
        phone: (payload.phone || null),
        city: (payload.city || null),
        country: (payload.country || null),
        age_decade: (payload.ageDecade || null),
        partner: typeof payload.partner === 'boolean' ? payload.partner : null,
        children_count: typeof payload.childrenCount === 'number' ? payload.childrenCount : null,
        tone: (payload.tone || null),
        primary_goal: (payload.primaryGoal || null),
        tried_before: (payload.triedBefore || null),
        status: 'onboarding',
        created_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('prosper_leads').insert(row);
      if (error) {
        // eslint-disable-next-line no-console
        console.log('[lead_capture:fallback]', { error: error.message, payload });
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log('[lead_capture:error]', { error: e?.message, payload });
    }
    return NextResponse.json({ ok: true });
  }
);

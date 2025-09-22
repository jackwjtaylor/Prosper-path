import { NextResponse } from 'next/server';
import { withApi, z } from '@/app/api/_lib/withApi';
import supabase from '@/app/lib/supabaseServer';

export const GET = withApi<{}>(
  { parse: 'none', sameOrigin: true, rateLimit: { bucket: 'leads_list', limit: 30, windowMs: 60_000 } },
  async () => {
    try {
      const { data, error } = await supabase
        .from('prosper_leads')
        .select('id, created_at, household_id, name, email, phone, city, country, age_decade, partner, children_count, tone, primary_goal, tried_before, status')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) return NextResponse.json({ items: [], warning: 'leads_table_missing' });
      return NextResponse.json({ items: data || [] });
    } catch {
      return NextResponse.json({ items: [], warning: 'leads_fetch_failed' });
    }
  }
);


import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import supabase from '@/app/lib/supabaseServer';

export async function getAuthUser(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const supa = createClient(url, anon, { auth: { persistSession: false } });
  const token = req.headers.get('authorization')?.replace(/Bearer\s+/i, '') || '';
  if (!token) return null;
  try {
    const { data, error } = await supa.auth.getUser(token);
    if (error) return null;
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function assertHouseholdAccess(req: NextRequest, householdId?: string) {
  if (!householdId) return { ok: false, code: 400 as const };
  const user = await getAuthUser(req);
  try {
    const { data, error } = await supabase
      .from('households')
      .select('id,user_id')
      .eq('id', householdId)
      .maybeSingle();
    if (error) return { ok: false, code: 500 as const };
    if (!data) return { ok: false, code: 404 as const };
    if (user) {
      if (data.user_id && data.user_id !== user.id) return { ok: false, code: 403 as const };
      return { ok: true, user } as const;
    } else {
      // Allow anonymous access only if the household is not owned
      if (!data.user_id) return { ok: true, user: null } as const;
      return { ok: false, code: 401 as const };
    }
  } catch {
    return { ok: false, code: 500 as const };
  }
}

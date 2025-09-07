import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import supabase from '@/app/lib/supabaseServer';
import { getAuthUser } from '@/app/lib/auth';

const COOKIE = 'pp_household_id';
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function POST(req: NextRequest) {
  // Ensure an authenticated user has an owned household and align cookie
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(COOKIE)?.value || null;

  // Find household by user_id
  const { data: owned } = await supabase
    .from('households')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  let householdId = owned?.id || null;

  if (!householdId) {
    // Try to claim cookie household if it exists and is unowned
    if (existingCookie) {
      const { data: hh } = await supabase
        .from('households')
        .select('id,user_id')
        .eq('id', existingCookie)
        .maybeSingle();
      if (hh && !hh.user_id) {
        await supabase.from('households').update({ user_id: user.id }).eq('id', existingCookie);
        householdId = existingCookie;
      }
    }
  }

  if (!householdId) {
    // Create new owned household
    const { data: ins, error } = await supabase
      .from('households')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    if (error || !ins) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    householdId = ins.id;
  }

  const res = NextResponse.json({ ok: true, householdId });
  res.cookies.set({
    name: COOKIE,
    value: householdId!,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ONE_YEAR,
    path: '/',
  });
  return res;
}


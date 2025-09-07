import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.json({ error: 'supabase_env_missing' }, { status: 500 });

  const supa = createClient(url!, anon!, { auth: { persistSession: false } });
  try {
    const authHeader = req.headers.get('authorization') || '';
    const tokenMatch = authHeader.match(/Bearer\s+(.+)/i);
    const accessToken = tokenMatch?.[1];
    if (!accessToken) return NextResponse.json({ user: null }, { status: 200 });
    const { data, error } = await supa.auth.getUser(accessToken);
    if (error) return NextResponse.json({ user: null }, { status: 200 });
    // Link cookie household to user if not already linked would happen in an upsert path (future)
    const cookieStore = await cookies();
    const hh = cookieStore.get('pp_household_id')?.value || null;
    return NextResponse.json({ user: data.user || null, householdId: hh });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}


import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import { rateLimit } from "@/app/api/_lib/rateLimit";

const COOKIE = "pp_household_id";
const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET(req: Request) {
  // Simple per-IP limit to avoid abuse
  // Cast to NextRequest-like minimal for header access
  const nextReq = req as any;
  const rl = await rateLimit(nextReq, 'login_flow', { limit: 10, windowMs: 60_000, keyParts: [] });
  if (!rl.ok) return rl.res;
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE)?.value;

  if (existing) {
    return NextResponse.json({ id: existing });
  }

  const { data, error } = await supabase
    .from("households")
    .insert({})   // id defaults to uuid
    .select("id")
    .single();

  if (error || !data) {
    console.error("supabase insert households error", error);
    return NextResponse.json({ error: "failed_to_create_household" }, { status: 500 });
  }

  const res = NextResponse.json({ id: data.id });
  res.cookies.set({
    name: COOKIE,
    value: data.id,
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_YEAR,
    path: "/",
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

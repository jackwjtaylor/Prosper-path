import { NextRequest, NextResponse } from "next/server";
import supabase from "@/app/lib/supabaseServer";
import { rateLimit } from "@/app/api/_lib/rateLimit";

function isValidEmail(email: unknown): email is string {
  if (typeof email !== "string") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "waitlist", { limit: 10, windowMs: 60 * 60 * 1000 });
  if (!limited.ok) return limited.res;

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : null;
  const utm = body?.utm && typeof body.utm === "object" ? body.utm : null;
  if (!isValidEmail(email)) return NextResponse.json({ error: "invalid_email" }, { status: 400 });

  const ua = req.headers.get("user-agent") || null;
  const ref = req.headers.get("referer") || null;

  const payload = {
    email,
    name,
    source: ref,
    user_agent: ua,
    utm_source: utm?.utm_source || null,
    utm_medium: utm?.utm_medium || null,
    utm_campaign: utm?.utm_campaign || null,
  } as const;

  const { error } = await supabase
    .from("waitlist_signups")
    .upsert(payload as any, { onConflict: "email" });

  if (error) {
    // Do not leak DB details
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}


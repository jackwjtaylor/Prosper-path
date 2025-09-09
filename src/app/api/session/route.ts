import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "../_lib/rateLimit";

function isSameOrigin(req: NextRequest): boolean {
  try {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const sfs = req.headers.get("sec-fetch-site");
    const expected = new URL(req.url).origin;
    if (sfs && sfs.toLowerCase() === "same-origin") return true;
    if (origin && origin === expected) return true;
    if (!origin && referer && referer.startsWith(expected)) return true;
  } catch {}
  return false;
}

export async function GET(req: NextRequest) {
  try {
    // Enforce same-origin to reduce abuse from other sites
    if (!isSameOrigin(req)) {
      return NextResponse.json({ error: "forbidden_origin" }, { status: 403 });
    }

    // Small per-IP rate limit (prefer Upstash if configured, else in-memory)
    const rl = await rateLimit(req, "session_ephemeral", { limit: 10, windowMs: 60_000 });
    if (!rl.ok) return rl.res;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    async function createSession(model: string) {
      const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model }),
      });
      const json = await res.json().catch(() => ({}));
      return { ok: res.ok, json } as const;
    }

    // Try preferred model first, then fallback to the stable preview if needed
    const preferred = process.env.REALTIME_MODEL || "gpt-realtime";
    let attempt = await createSession(preferred);
    if (!attempt.ok || !attempt.json?.client_secret?.value) {
      const fallbackModel = "gpt-4o-realtime-preview-2025-06-03";
      const fallback = await createSession(fallbackModel);
      if (fallback.ok && fallback.json?.client_secret?.value) {
        return NextResponse.json({ ...fallback.json, model: fallbackModel, fallback_used: true });
      }
      // Neither worked — return the best error info
      const errInfo = attempt.json?.error || fallback.json?.error || { message: "failed_to_create_ephemeral_session" };
      return NextResponse.json({ error: errInfo }, { status: 500 });
    }

    // Success with preferred model
    return NextResponse.json({ ...attempt.json, model: preferred, fallback_used: false });
  } catch (error) {
    console.error("Error in /session:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

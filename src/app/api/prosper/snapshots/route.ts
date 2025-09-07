import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import supabase from "@/app/lib/supabaseServer";
import type { Slots } from "@/app/lib/schema/slots";
import { computeKpisV2 } from "@/app/lib/kpiEngine";
import { assignLevelsV2 } from "@/app/lib/levelEngine";
import { assertHouseholdAccess } from "@/app/lib/auth";

/**
 * POST /api/prosper/snapshots
 * Persists a snapshot of inputs + kpis + levels (optionally recommendations), and
 * records a net worth point for the chart when computable.
 *
 * Accepts either { householdId } or { household_id } in the body for flexibility.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const cookieStore = await cookies();
    const cookieId = cookieStore.get('pp_household_id')?.value;
    const householdId: string | undefined = body.householdId || body.household_id || cookieId;
    if (!householdId) return NextResponse.json({ error: 'household_id_required' }, { status: 400 });

    const authz = await assertHouseholdAccess(req, householdId);
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.code });

    // Enforce free-limit for free/anonymous users
    try {
      const { data: hh } = await supabase
        .from('households')
        .select('subscription_status,current_period_end,email')
        .eq('id', householdId)
        .maybeSingle();
      const sub = hh?.subscription_status || null;
      const periodEnd = hh?.current_period_end ? Date.parse(hh.current_period_end) : 0;
      const now = Date.now();
      const premium = !!sub && ['active','trialing','past_due'].includes(sub) && (periodEnd === 0 || periodEnd > now);
      if (!premium) {
        const { count } = await supabase
          .from('snapshots')
          .select('id', { count: 'exact', head: true })
          .eq('household_id', householdId);
        const used = count ?? 0;
        const freeLimit = Number(process.env.FREE_SNAPSHOT_LIMIT || 3);
        if (used >= freeLimit) {
          const isAuthed = !!authz.user;
          let url: string | undefined;
          if (isAuthed) {
            try {
              const origin = new URL(req.url).origin;
              const r = await fetch(`${origin}/api/billing/create-checkout-session`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ householdId, email: hh?.email })
              });
              const j = await r.json();
              url = j?.url;
            } catch {}
          }
          return NextResponse.json({ error: 'free_limit_exceeded', upgrade_url: url, login_url: '/login' }, { status: 402 });
        }
      }
    } catch {}

    // Ensure household exists (FK for snapshots)
    try {
      const { data: hh, error: hhErr } = await supabase
        .from('households')
        .select('id')
        .eq('id', householdId)
        .maybeSingle();
      if (hhErr) throw hhErr;
      if (!hh) {
        const { error: insErr } = await supabase.from('households').insert({ id: householdId });
        if (insErr) throw insErr;
      }
    } catch (e: any) {
      return NextResponse.json({ error: 'household_insert_failed', detail: e?.message || 'failed' }, { status: 500 });
    }

    const inputs = (body.inputs || {}) as Record<string, any>;
    const providedKpis = (body.kpis || null) as any;
    const providedLevels = (body.levels || null) as any;
    const recommendations = (body.recommendations || null) as any;
    const provisional_keys = Array.isArray(body.provisional_keys) ? body.provisional_keys : [];

    // Compute KPIs/levels if not supplied; prefer slots if present.
    let kpis = providedKpis;
    let levels = providedLevels;
    let netWorth: number | null = null;
    try {
      if (!kpis || !levels) {
        const slots: Slots | undefined = inputs?.slots && typeof inputs.slots === 'object' ? (inputs.slots as Slots) : undefined;
        if (slots) {
          const { kpis: k, gates, normalized } = computeKpisV2(slots);
          kpis = { ...k, engine_version: 'v2', gates } as any;
          levels = assignLevelsV2(k, gates);
          if (typeof normalized?.net_worth === 'number' && Number.isFinite(normalized.net_worth)) netWorth = normalized.net_worth as number;
        }
      }
    } catch {}

    // If kpis include normalized net worth in some future shape, prefer it
    if (netWorth == null) {
      try {
        const maybeNW = (kpis as any)?.normalized?.net_worth;
        if (typeof maybeNW === 'number' && Number.isFinite(maybeNW)) netWorth = maybeNW as number;
      } catch {}
    }

    // As a final fallback for net worth, if inputs contain slots compute normalized just for NW
    if (netWorth == null) {
      try {
        const slots: Slots | undefined = inputs?.slots && typeof inputs.slots === 'object' ? (inputs.slots as Slots) : undefined;
        if (slots) {
          const { normalized } = computeKpisV2(slots);
          if (typeof normalized?.net_worth === 'number' && Number.isFinite(normalized.net_worth)) netWorth = normalized.net_worth as number;
        }
      } catch {}
    }

    const insertPayload: any = {
      household_id: householdId,
      inputs,
      kpis: kpis || null,
      levels: levels || null,
      recommendations: recommendations || null,
      provisional_keys,
    };

    const { data: snap, error: snapErr } = await supabase
      .from('snapshots')
      .insert(insertPayload)
      .select('id, created_at')
      .single();
    if (snapErr) return NextResponse.json({ error: 'snapshot_insert_failed', detail: snapErr.message }, { status: 500 });

    // Persist a net-worth point if we have a figure
    if (typeof netWorth === 'number' && Number.isFinite(netWorth)) {
      try {
        await supabase.from('net_worth_points').insert({ household_id: householdId, ts: new Date().toISOString(), value: netWorth });
      } catch {}
    }

    return NextResponse.json({ ok: true, id: snap?.id, created_at: snap?.created_at });
  } catch (e: any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
  }
}

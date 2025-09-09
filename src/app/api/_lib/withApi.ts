import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZodTypeAny, z } from 'zod';
import { rateLimit as rl } from './rateLimit';
import { parseJson, parseQuery } from './validation';
import { assertHouseholdAccess, getAuthUser } from '@/app/lib/auth';

export type ParseMode = 'json' | 'query' | 'none';

type RateLimitOpts = { bucket: string; limit: number; windowMs: number; addHouseholdToKey?: boolean };

type Options = {
  parse?: ParseMode;
  schema?: ZodTypeAny;
  sameOrigin?: boolean;
  rateLimit?: RateLimitOpts;
  household?: 'required' | 'optional' | 'none';
};

export type HandlerContext<T = unknown> = {
  req: NextRequest;
  data?: T;
  householdId?: string | null;
  user: any | null;
};

function isSameOrigin(req: NextRequest): boolean {
  try {
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    const sfs = req.headers.get('sec-fetch-site');
    const expected = new URL(req.url).origin;
    if (sfs && sfs.toLowerCase() === 'same-origin') return true;
    if (origin && origin === expected) return true;
    if (!origin && referer && referer.startsWith(expected)) return true;
  } catch {}
  return false;
}

async function resolveHouseholdId(req: NextRequest, parsedData?: any): Promise<string | null> {
  // Prefer explicit householdId (body or query), else cookie
  const fromData = parsedData?.householdId || parsedData?.household_id || null;
  if (typeof fromData === 'string' && fromData.length > 10) return fromData;
  try {
    const url = new URL(req.url);
    const fromQuery = url.searchParams.get('householdId');
    if (fromQuery) return fromQuery;
  } catch {}
  try {
    const c = await cookies();
    const cookieId = c.get('pp_household_id')?.value;
    if (cookieId) return cookieId;
  } catch {}
  return null;
}

export function withApi<T = unknown>(options: Options, handler: (ctx: HandlerContext<T>) => Promise<NextResponse> | NextResponse) {
  const parseMode = options.parse || 'none';
  const schema = options.schema;
  const householdMode = options.household || 'none';
  const sameOrigin = options.sameOrigin ?? false;
  const rateLimit = options.rateLimit;

  return async function wrapped(req: NextRequest): Promise<NextResponse> {
    try {
      if (sameOrigin && !isSameOrigin(req)) {
        return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
      }

      // Rate limit (per IP; optionally bucketed by household)
      if (rateLimit && !rateLimit.addHouseholdToKey) {
        // Per-IP only; no household keying required
        const base = await rl(req, rateLimit.bucket, { limit: rateLimit.limit, windowMs: rateLimit.windowMs });
        if (!base.ok) return base.res;
      }

      // Parse input
      let parsed: any = undefined;
      if (parseMode === 'json' && schema) {
        const p = await parseJson(req, schema);
        if (!p.ok) return p.res;
        parsed = p.data;
      } else if (parseMode === 'query' && schema) {
        const p = parseQuery(req, schema);
        if (!p.ok) return p.res;
        parsed = p.data;
      }

      // Auth and household access
      const user = await getAuthUser(req);
      let householdId: string | null = null;
      if (householdMode !== 'none') {
        householdId = await resolveHouseholdId(req, parsed);
        if (!householdId && householdMode === 'required') {
          return NextResponse.json({ error: 'household_id_required' }, { status: 400 });
        }
        if (householdId) {
          const authz = await assertHouseholdAccess(req, householdId);
          if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.code });
        }
      }

      // Optional rate limit keyed by household, after resolution
      if (rateLimit && rateLimit.addHouseholdToKey) {
        // Apply rate limit using household key when available, else fall back to IP-only
        const opts = { limit: rateLimit.limit, windowMs: rateLimit.windowMs, keyParts: householdId ? [householdId] : [] as any } as any;
        const keyed = await rl(req, rateLimit.bucket, opts);
        if (!keyed.ok) return keyed.res;
      }

      return await handler({ req, data: parsed as T, householdId, user });
    } catch (e: any) {
      return NextResponse.json({ error: 'bad_request', detail: e?.message || 'failed' }, { status: 400 });
    }
  };
}

// Convenience wrappers for common cases
export function withHouseholdAccess<T = unknown>(schema: ZodTypeAny | undefined, parse: ParseMode, handler: (ctx: HandlerContext<T>) => Promise<NextResponse> | NextResponse, opts?: { rateLimit?: RateLimitOpts; sameOrigin?: boolean }) {
  return withApi<T>({ parse, schema, household: 'required', rateLimit: opts?.rateLimit, sameOrigin: opts?.sameOrigin }, handler);
}

export { z };

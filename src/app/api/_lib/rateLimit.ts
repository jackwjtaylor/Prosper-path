import { NextRequest, NextResponse } from 'next/server';

type Options = {
  limit: number;
  windowMs: number;
  keyParts?: (string | null | undefined)[];
};

type Result = { ok: true; remaining: number; resetAt: number } | { ok: false; res: NextResponse };

const memoryStore: Map<string, { count: number; resetAt: number }> = new Map();

async function limitWithUpstash(key: string, limit: number, windowMs: number): Promise<{ remaining: number; resetAt: number } | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const commands = [
      ["INCR", key],
      ["PEXPIRE", key, String(windowMs), "NX"],
      ["PTTL", key],
    ];
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands }),
      // avoid Next caching
      cache: 'no-store' as any,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(json)) return null;
    const count = Number(json[0]?.result ?? json[0]);
    const pttl = Number(json[2]?.result ?? json[2]);
    const ttlMs = Number.isFinite(pttl) && pttl > 0 ? pttl : windowMs;
    const resetAt = Date.now() + ttlMs;
    return { remaining: Math.max(0, limit - count), resetAt };
  } catch {
    return null;
  }
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const xri = req.headers.get('x-real-ip');
  if (xri) return xri.trim();
  try {
    // next/server may expose ip on request
    // @ts-ignore
    if (req.ip) return String(req.ip);
  } catch {}
  return '0.0.0.0';
}

function buildKey(bucket: string, parts: (string | null | undefined)[]): string {
  const safe = parts.map((p) => (p == null || p === '' ? 'na' : String(p))).join('::');
  return `rl:${bucket}:${safe}`;
}

function headers(remaining: number, limit: number, resetAt: number) {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, remaining)),
    'X-RateLimit-Reset': String(Math.floor(resetAt / 1000)),
    'Retry-After': String(Math.max(0, Math.ceil((resetAt - Date.now()) / 1000))),
  };
}

function limitInMemory(key: string, limit: number, windowMs: number): { remaining: number; resetAt: number } {
  const now = Date.now();
  const item = memoryStore.get(key);
  if (!item || item.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { remaining: limit - 1, resetAt };
  }
  item.count += 1;
  memoryStore.set(key, item);
  return { remaining: Math.max(0, limit - item.count), resetAt: item.resetAt };
}

export async function rateLimit(req: NextRequest, bucket: string, opts: Options): Promise<Result> {
  const ip = getClientIp(req);
  const limit = Math.max(1, opts.limit);
  const windowMs = Math.max(1000, opts.windowMs);
  const key = buildKey(bucket, [ip, ...(opts.keyParts || [])]);

  // Prefer Upstash Redis if configured; fallback to in-memory
  const redis = await limitWithUpstash(key, limit, windowMs);
  const { remaining, resetAt } = redis || limitInMemory(key, limit, windowMs);
  if (remaining >= 0) {
    return { ok: true, remaining, resetAt };
  }
  const res = NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: headers(0, limit, resetAt) });
  return { ok: false, res };
}

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodTypeAny } from 'zod';

export const Uuid = z.string().uuid();

function zodIssues(err: ZodError) {
  return err.errors.map((e) => ({ path: e.path.join('.'), message: e.message }));
}

export async function parseJson<T>(req: NextRequest, schema: ZodTypeAny): Promise<
  | { ok: true; data: any }
  | { ok: false; res: NextResponse }
> {
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'invalid_request', issues: zodIssues(result.error) },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}

export function parseQuery<T>(req: NextRequest, schema: ZodTypeAny):
  | { ok: true; data: any }
  | { ok: false; res: NextResponse } {
  const url = new URL(req.url);
  const params: Record<string, string> = Object.fromEntries(url.searchParams.entries());
  const result = schema.safeParse(params);
  if (!result.success) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'invalid_query', issues: zodIssues(result.error) },
        { status: 400 }
      ),
    };
  }
  return { ok: true, data: result.data };
}

export function jsonOk<T>(data: T, schema?: ZodTypeAny, status = 200): NextResponse {
  if (schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      // Fail closed: don’t leak unexpected data; return a generic server error
      console.error('Invalid response payload', zodIssues(parsed.error));
      return NextResponse.json({ error: 'invalid_response' }, { status: 500 });
    }
    return NextResponse.json(parsed.data, { status });
  }
  return NextResponse.json(data as any, { status });
}

export function coerceBoolean(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  const s = String(v ?? '').toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return null;
}

export { z };

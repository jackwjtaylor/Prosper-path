import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z, parseJson } from "@/app/api/_lib/validation";
import { rateLimit } from "@/app/api/_lib/rateLimit";

// Hardened proxy for a very specific internal use (guardrails classifier)
const ALLOWED_MODELS = [
  'gpt-4o-mini',
  'gpt-4.1-mini',
];

const MAX_MESSAGES = 8;
const MAX_CHARS_PER_MESSAGE = 2000;

const MessageSchema = z.object({
  role: z.enum(['user']).default('user'),
  content: z.string().min(1).max(MAX_CHARS_PER_MESSAGE),
});

const TextFormatSchema = z.object({
  type: z.string().optional(),
}).passthrough().optional();

const RequestSchema = z.object({
  model: z.string(),
  input: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
  text: z.object({ format: TextFormatSchema }).partial().optional(),
}).strict();

export async function POST(req: NextRequest) {
  // Rate limit calls to avoid abuse
  const rl = await rateLimit(req, 'responses_proxy', { limit: 10, windowMs: 60_000 });
  if (!rl.ok) return rl.res;

  const parsed = await parseJson(req, RequestSchema);
  if (!parsed.ok) return parsed.res;
  const body = parsed.data as z.infer<typeof RequestSchema>;

  // Enforce model allow-list
  const model = body.model;
  if (!ALLOWED_MODELS.includes(model)) {
    return NextResponse.json({ error: 'model_not_allowed' }, { status: 400 });
  }

  // Make a minimal, sanitized payload for the Responses API
  const sanitizedInput = body.input.map(m => ({ role: 'user', content: String(m.content).slice(0, MAX_CHARS_PER_MESSAGE) }));
  const payload: any = { model, input: sanitizedInput, stream: false };
  if (body.text?.format) payload.text = { format: body.text.format };

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // If structured output was requested via json_schema type, use parse()
    const isStructured = body.text?.format && (body.text.format as any).type === 'json_schema';
    const response = isStructured
      ? await openai.responses.parse(payload)
      : await openai.responses.create(payload);
    return NextResponse.json(response);
  } catch (err: any) {
    console.error('responses proxy error', err);
    const status = (err?.status as number) || 500;
    return NextResponse.json({ error: 'failed', detail: err?.message || 'proxy_error' }, { status });
  }
}
  

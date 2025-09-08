import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function base64UrlDecode(input: string) {
  input = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = input.length % 4;
  if (pad) input += '='.repeat(4 - pad);
  return Buffer.from(input, 'base64').toString('utf8');
}

function verifySignedRequest(signed_request: string, appSecret: string): { ok: boolean; payload?: any } {
  try {
    const [encodedSig, encodedPayload] = signed_request.split('.');
    if (!encodedSig || !encodedPayload) return { ok: false };
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const expectedSig = crypto
      .createHmac('sha256', appSecret)
      .update(encodedPayload)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    if (expectedSig !== encodedSig) return { ok: false };
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

export async function GET(req: NextRequest) {
  return await handle(req);
}

export async function POST(req: NextRequest) {
  return await handle(req);
}

async function handle(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const signed = url.searchParams.get('signed_request') || undefined;
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
  const appSecret = process.env.FACEBOOK_APP_SECRET || process.env.FB_APP_SECRET || '';

  let userId: string | undefined;
  if (signed && appSecret) {
    const v = verifySignedRequest(signed, appSecret);
    if (v.ok) userId = v.payload?.user_id || v.payload?.user?.id || undefined;
  }

  const confirmationCode = `fb_${(userId || Math.random().toString(36).slice(2)).toString()}`;
  const statusUrl = `${appUrl}/data-deletion-status?code=${encodeURIComponent(confirmationCode)}`;

  // Facebook expects: { url, confirmation_code }
  return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode });
}


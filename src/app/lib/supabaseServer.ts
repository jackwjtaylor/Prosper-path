import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  // Avoid throwing at import time during builds without envs; fall back to harmless placeholders
  const safeUrl = url || 'https://placeholder.supabase.co';
  const safeKey = (service || anon) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';
  return createClient(safeUrl, safeKey, { auth: { persistSession: false } });
}

function getClient(): SupabaseClient {
  if (!cached) cached = buildClient();
  return cached;
}

const supabase = new Proxy({} as any, {
  get(_target, prop) {
    const c = getClient() as any;
    return c[prop as any];
  }
});

export default supabase;

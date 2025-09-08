"use client";
import React from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

export default function LoginPage() {
  const supa = getSupabaseClient();
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);
  const [oauthLoading, setOauthLoading] = React.useState<string | null>(null);

  const sendLink = async () => {
    if (!supa || !email.trim()) return;
    setLoading(true);
    setStatus('Sending magic link…');
    try {
      const redirectTo = new URL('/auth/callback', window.location.origin);
      // Preserve requested destination; default home
      redirectTo.searchParams.set('redirect', '/');
      const { error } = await supa.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo.toString() } });
      if (error) setStatus('Failed to send link.');
      else setStatus('Check your email for the magic link.');
    } finally {
      setLoading(false);
    }
  };

  const signInWithOAuth = async (provider: 'google') => {
    if (!supa) {
      setStatus('Auth not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart dev server.');
      return;
    }
    setOauthLoading(provider);
    setStatus('Redirecting to provider…');
    try {
      const redirectTo = new URL('/auth/callback', window.location.origin);
      redirectTo.searchParams.set('redirect', '/');
      const { error } = await supa.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo.toString() } as any });
      if (error) {
        setStatus('Failed to start sign-in.');
        setOauthLoading(null);
      }
    } catch {
      setStatus('Failed to start sign-in.');
      setOauthLoading(null);
    }
  };

  const ensureHousehold = async () => {
    setStatus('Linking your household…');
    try {
      const sess = await supa?.auth.getSession();
      const token = sess?.data?.session?.access_token;
      const res = await fetch('/api/household/ensure', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) setStatus('Household linked. You can close this tab.');
      else setStatus('Failed to link household.');
    } catch {
      setStatus('Failed to link household.');
    }
  };

  React.useEffect(() => {
    // If redirected back with a session in URL, ensure household now
    const doEnsure = async () => {
      try { await ensureHousehold(); } catch {}
    };
    doEnsure();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-center mb-2">
          <img src="/2D76K394f.eps.svg" alt="Prosper Logo" className="h-10 w-10" />
        </div>
        <h1 className="text-xl font-semibold mb-4 text-center">Sign in to Prosper</h1>
        <div className="space-y-3">
          <button onClick={() => signInWithOAuth('google')} disabled={!!oauthLoading || !supa}
            className="w-full h-10 rounded border bg-white hover:bg-gray-50 flex items-center justify-center gap-2">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12   c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.311,6.053,29.409,4,24,4C12.955,4,4,12.955,4,24   s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
              <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.629,16.108,18.927,13,24,13c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657   C34.311,6.053,29.409,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
              <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.197l-6.186-5.238C29.211,35.091,26.715,36,24,36   c-5.202,0-9.619-3.317-11.277-7.946l-6.55,5.047C9.49,39.556,16.227,44,24,44z"/>
              <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.094,5.565c0,0,0,0,0,0l6.186,5.238   C36.882,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
            </svg>
            <span>Continue with Google</span>
          </button>
        </div>

        <div className="my-4 text-center text-xs text-gray-500">or</div>

        <div className="space-y-2">
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button
            className="w-full h-10 rounded bg-gray-900 text-white disabled:opacity-50"
            onClick={sendLink}
            disabled={loading || !email.trim()}
          >
            Send magic link
          </button>
          {status && <div className="text-xs text-gray-700 text-center">{status}</div>}
        </div>
      </div>
    </div>
  );
}

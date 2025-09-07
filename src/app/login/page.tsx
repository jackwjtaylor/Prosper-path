"use client";
import React from 'react';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

export default function LoginPage() {
  const supa = getSupabaseClient();
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<string>('');
  const [loading, setLoading] = React.useState(false);

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

  const signOut = async () => {
    if (!supa) return;
    await supa.auth.signOut();
    setStatus('Signed out.');
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
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-semibold mb-4">Sign in</h1>
      <div className="space-y-3">
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
        <button
          className="w-full h-10 rounded border"
          onClick={signOut}
        >
          Sign out
        </button>
        {status && <div className="text-sm text-gray-700">{status}</div>}
      </div>
    </div>
  );
}

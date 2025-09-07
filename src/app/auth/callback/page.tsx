"use client";
import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const supa = getSupabaseClient();
  const [status, setStatus] = React.useState('Signing you in…');

  React.useEffect(() => {
    (async () => {
      try {
        await new Promise((r) => setTimeout(r, 200));
        const sessRes = await supa?.auth.getSession();
        const token = sessRes && 'data' in sessRes ? sessRes.data?.session?.access_token : undefined;
        if (!token) {
          setStatus('No session found. You can close this tab.');
          return;
        }
        setStatus('Linking your account…');
        const res = await fetch('/api/household/ensure', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
          setStatus('Linked failed. Please try again.');
          return;
        }
        setStatus('All set! Redirecting…');
        const dest = params.get('redirect') || '/';
        router.replace(dest);
      } catch {
        setStatus('Something went wrong. You can close this tab.');
      }
    })();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <div className="animate-pulse text-gray-700">{status}</div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense fallback={<div className="max-w-md mx-auto p-6 text-center">Loading…</div>}>
      <CallbackInner />
    </React.Suspense>
  );
}

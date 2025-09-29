"use client";

import React, { Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';

function LeadsAdminInner() {
  const sp = useSearchParams();
  const key = (sp.get('key') || '').trim();
  const ADMIN_KEY = (process.env.NEXT_PUBLIC_ADMIN_KEY || '').trim();
  const allowed = !ADMIN_KEY || key === ADMIN_KEY;
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<{ status?: string } | null>({});

  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/leads/list', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.detail || j?.error || 'failed');
      setItems(j.items || []);
    } catch (e: any) { setError(e?.message || 'failed'); }
    setLoading(false);
  }, []);

  React.useEffect(() => { if (allowed) load(); }, [load, allowed]);

  const filtered = items.filter((it) => (!filter?.status || it.status === filter.status));

  if (!allowed) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <Link href="/home" className="flex items-center gap-2 text-sm font-semibold">
              <Image src="/favicon.png" alt="Prosper" width={24} height={24} className="h-6 w-6 rounded-sm" />
              Prosper — Leads Admin
            </Link>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-8 text-sm">
          <div className="mb-2 font-medium">Access restricted</div>
          <div>Append <code>?key=YOUR_ADMIN_KEY</code> to the URL to view. Set NEXT_PUBLIC_ADMIN_KEY in your environment.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2 text-sm font-semibold">
            <Image src="/favicon.png" alt="Prosper" width={24} height={24} className="h-6 w-6 rounded-sm" />
            Prosper — Leads Admin
          </Link>
          <button onClick={load} className="text-sm px-3 py-1 rounded border bg-white hover:bg-gray-50">Refresh</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">{error}</div>}
        <div className="mb-4 flex flex-wrap gap-3 text-sm">
          <select value={filter?.status || ''} onChange={(e) => setFilter({ status: e.target.value || undefined })} className="border rounded px-2 py-1">
            <option value="">All status</option>
            <option value="onboarding">Onboarding</option>
            <option value="contacted">Contacted</option>
            <option value="converted">Converted</option>
          </select>
        </div>

        <div className="overflow-x-auto border rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2">Created</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Contact</th>
                <th className="text-left px-3 py-2">Location</th>
                <th className="text-left px-3 py-2">Profile</th>
                <th className="text-left px-3 py-2">Goal</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Notes</th>
                <th className="text-left px-3 py-2">Household</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="px-3 py-2" colSpan={8}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td className="px-3 py-2" colSpan={8}>No leads yet.</td></tr>
              ) : (
                filtered.map((it) => (
                  <tr key={it.id} className="border-t align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(it.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2">{it.name || '—'}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900">{it.email || '—'}</div>
                      <div className="text-xs text-gray-500">{it.phone || ''}</div>
                    </td>
                    <td className="px-3 py-2">{[it.city, it.country].filter(Boolean).join(', ')}</td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-700">Age: {it.age_decade || '—'}</div>
                      <div className="text-xs text-gray-700">Partner: {it.partner ? 'Yes' : 'No'}</div>
                      <div className="text-xs text-gray-700">Children: {typeof it.children_count === 'number' ? it.children_count : '—'}</div>
                      <div className="text-xs text-gray-700">Tone: {it.tone || '—'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-xs text-gray-900 truncate max-w-[240px]" title={it.primary_goal || ''}>{it.primary_goal || '—'}</div>
                      <div className="text-[11px] text-gray-500 truncate max-w-[240px]" title={it.tried_before || ''}>{it.tried_before || ''}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={it.status || 'onboarding'}
                        onChange={async (e) => {
                          try {
                            await fetch('/api/leads/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status: e.target.value }) });
                            await load();
                          } catch {}
                        }}
                        className="border rounded px-1 py-0.5 text-xs"
                      >
                        <option value="onboarding">Onboarding</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        defaultValue={it.notes || ''}
                        onBlur={async (e) => {
                          try { await fetch('/api/leads/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, notes: e.target.value }) }); } catch {}
                        }}
                        rows={2}
                        className="border rounded px-2 py-1 text-xs w-56"
                        placeholder="Notes..."
                      />
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">{it.household_id || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default function LeadsAdminPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <LeadsAdminInner />
    </Suspense>
  );
}

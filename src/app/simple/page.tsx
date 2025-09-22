import React, { Suspense } from 'react';
import SimpleWorkspace from '@/app/components/SimpleWorkspace';
import { TranscriptProvider } from '@/app/contexts/TranscriptContext';
import { EventProvider } from '@/app/contexts/EventContext';

export const metadata = {
  title: 'Prosper – Workspace',
  description: 'A focused, minimal Prosper workspace to get started.',
};

export default function Page() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <main className="relative min-h-[100svh] w-screen overflow-hidden bg-bg text-fg">
        <TranscriptProvider>
          <EventProvider>
            <SimpleWorkspace />
          </EventProvider>
        </TranscriptProvider>
      </main>
    </Suspense>
  );
}

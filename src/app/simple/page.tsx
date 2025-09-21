import React from 'react';
import BackgroundVideo from '@/app/components/BackgroundVideo';
import SimpleWorkspace from '@/app/components/SimpleWorkspace';

export const metadata = {
  title: 'Prosper – Workspace',
  description: 'A focused, minimal Prosper workspace to get started.',
};

export default function Page() {
  return (
    <main className="relative min-h-[100svh] w-screen overflow-hidden bg-bg text-fg">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundVideo src="/landing.mp4" poster="/og.png" />
      </div>
      <div className="absolute inset-0 bg-black/40 z-0" />
      <SimpleWorkspace />
    </main>
  );
}


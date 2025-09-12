'use client';
import { useRef } from 'react';

export default function DemoDialog() {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        onClick={() => ref.current?.showModal()}
        className="rounded-full px-6 py-3 border border-dim text-dim hover:text-fg hover:border-fg"
      >
        Watch the demo
      </button>

      <dialog ref={ref} className="backdrop:bg-black/70 rounded-xl p-0">
        <div className="w-[90vw] max-w-[960px] aspect-video bg-black relative">
          <iframe
            src="https://www.youtube.com/embed/MNG2_t_juvg?autoplay=1&mute=1"
            title="Prosper Demo"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <button
            onClick={() => ref.current?.close()}
            className="absolute top-4 right-4 text-fg/70 hover:text-fg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </dialog>
    </>
  );
}


"use client";
import React from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
};

export default function BackgroundVideo({ src, poster, className = "absolute inset-0 h-full w-full object-cover" }: Props) {
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const onEnded = () => {
      try {
        v.currentTime = 0;
        // Attempt to restart in case some browsers ignore loop
        v.play().catch(() => {});
      } catch {}
    };
    v.addEventListener('ended', onEnded);
    // Nudge playback in case autoplay is blocked until muted flag settles
    const ensure = () => {
      try { if (v.paused) v.play().catch(() => {}); } catch {}
    };
    const id = setInterval(ensure, 3000);
    ensure();
    return () => { v.removeEventListener('ended', onEnded); clearInterval(id); };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      poster={poster}
      controls={false}
      aria-hidden
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}


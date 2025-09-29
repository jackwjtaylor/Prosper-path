"use client";
import React from "react";

type Props = {
  src?: string; // mp4 fallback
  webmSrc?: string; // optional webm for faster start
  poster?: string;
  className?: string;
};

export default function BackgroundVideo({ src, webmSrc, poster, className = "absolute inset-0 h-full w-full object-cover" }: Props) {
  const hasVideo = Boolean(src || webmSrc);
  const ref = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    if (!hasVideo) return;
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
  }, [hasVideo]);

  if (!hasVideo) return null;

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
      {webmSrc ? <source src={webmSrc} type="video/webm" /> : null}
      {src ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}

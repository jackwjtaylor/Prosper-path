import Link from 'next/link'
import Image from 'next/image'
import WaitlistForm from "@/app/components/WaitlistForm";
import BackgroundVideo from "@/app/components/BackgroundVideo";
import ScarcityCounter from "@/app/components/ScarcityCounter";

export const metadata = {
  title: 'Prosper - Your Personal Money Coach',
  description: 'One-screen clarity. Real coaching. Better money habits.',
};

// Top-right nav hidden for now

function Footer() {
  return (
    <footer className="absolute bottom-6 inset-x-0 z-20">
      <div className="mx-auto max-w-[1040px] px-6 flex items-center justify-between text-sm text-dim">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-fg">Privacy</Link>
          <Link href="/terms" className="hover:text-fg">Terms</Link>
          <Link href="/contact" className="hover:text-fg">Contact</Link>
        </div>
        <p className="text-xs text-dim/80 sm:text-sm">© {new Date().getFullYear()} Prosper</p>
      </div>
    </footer>
  )
}

export default function Page() {
  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-bg text-fg">
      {/* Logo top-left */}
      <header className="absolute top-6 left-6 z-20">
        <Link href="/waitlist" className="inline-flex items-center gap-3">
          <Image src="/prosper_wordmark_offwhite.svg" alt="Prosper wordmark" width={200} height={60} className="h-10 md:h-12 w-auto opacity-95" priority />
          <span className="sr-only">Prosper</span>
        </Link>
      </header>
      {/* Background MP4 video (place file at public/landing.mp4) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundVideo src="/landing.mp4" poster="/og.png" />
      </div>

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/40 z-10" />

      {/* Optional soft glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% 40%, rgba(255,255,255,0.08), transparent 60%)',
        }}
      />

      {/* Nav hidden */}

      <section className="relative z-20 flex h-full items-center justify-center">
        <div className="w-full max-w-[1120px] px-6">
          <div className="flex flex-col items-center text-center gap-6 md:gap-8">
            <Image src="/favicon.png" alt="" aria-hidden width={32} height={32} className="h-7 w-7 md:h-8 md:w-8 opacity-95 rounded-sm" />
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl md:leading-tight">
              Your personal money coach
            </h1>
            <p className="text-dim text-lg md:text-xl md:text-balance max-w-[680px]">
              Get a step-by-step plan to build long term wealth
            </p>
            <div className="flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <WaitlistForm includeName={false} buttonLabel="Join Waitlist" placeholder="Enter your email" />
            </div>
            <p className="text-xs text-dim md:text-sm">
              <ScarcityCounter />
              <span> — join for early access 🎁</span>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

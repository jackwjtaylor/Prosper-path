import Link from 'next/link'
import WaitlistForm from "@/app/components/WaitlistForm";
import BackgroundVideo from "@/app/components/BackgroundVideo";

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
          <img src="/prosper_wordmark.svg" alt="Prosper wordmark" className="h-10 md:h-12 w-auto opacity-95" />
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

      <section className="relative z-20 flex h-full items-center justify-center px-6">
        <div className="relative w-full max-w-[1120px]">
          <div className="pointer-events-none absolute inset-0 rounded-[36px] border border-white/10 bg-gradient-to-br from-white/8 via-white/4 to-white/0 opacity-70 blur-xl" />
          <div className="relative mx-auto flex w-full max-w-[720px] flex-col items-center gap-8 rounded-[32px] border border-white/15 bg-black/55 px-8 py-12 text-center shadow-[0_30px_90px_-35px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:px-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs uppercase tracking-[0.22em] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
              Private waitlist now open
            </div>
            <div className="flex flex-col gap-5 md:gap-6">
              <h1 className="text-4xl font-semibold tracking-tight md:text-[56px] md:leading-[1.05]">
                Wealth coaching that keeps you moving forward every week
              </h1>
              <p className="mx-auto max-w-[640px] text-balance text-base text-white/80 md:text-lg">
                Prosper’s human coach audits your accounts, builds a roadmap tailored to your goals, and checks in every seven days so the next best money move is always clear.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-white/75 md:text-base">
              <span className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-medium">
                First plan delivered within 5 business days
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-medium">
                Weekly accountability + progress reports
              </span>
              <span className="rounded-full border border-white/20 bg-white/5 px-4 py-2 font-medium">
                Founding members keep concierge pricing
              </span>
            </div>
            <div className="flex w-full max-w-[520px] flex-col gap-4">
              <WaitlistForm includeName={true} buttonLabel="Join the Waitlist" placeholder="Your best email" />
              <div className="grid gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-xs text-white/70 sm:text-sm">
                <p className="font-medium text-white/80">What to expect next</p>
                <ul className="space-y-1 leading-relaxed">
                  <li>• A confirmation note with the Prosper launch preview.</li>
                  <li>• Early-access scheduling once your cohort opens.</li>
                  <li>• No spam — unsubscribe anytime in one click.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

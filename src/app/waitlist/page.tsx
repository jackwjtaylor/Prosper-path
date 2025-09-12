import Link from 'next/link'
import WaitlistForm from "@/app/components/WaitlistForm";
import BackgroundVideo from "@/app/components/BackgroundVideo";

export const metadata = {
  title: 'Prosper — Your Voice-First Money Coach',
  description: 'One-screen clarity. Real coaching. Better money habits.',
};

// Top-right nav hidden for now

function Footer() {
  return (
    <footer className="absolute bottom-6 inset-x-0 z-20">
      <div className="mx-auto max-w-[1040px] px-6 flex items-center justify-between text-xs text-dim">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-fg">Privacy</Link>
          <Link href="/terms" className="hover:text-fg">Terms</Link>
          <Link href="/contact" className="hover:text-fg">Contact</Link>
        </div>
        <a href="https://x.com/" className="hover:text-fg">X</a>
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
          <img src="/openai-logomark.svg" alt="Prosper logo" className="h-8 w-8 md:h-10 md:w-10 opacity-95" />
          <span className="text-fg/90 text-sm md:text-base font-semibold tracking-tight">prosperpath.io</span>
          <span className="sr-only">Prosper</span>
        </Link>
      </header>
      {/* Background MP4 video (place file at public/landing.mp4) */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundVideo src="/landing.mp4" poster="/og.png" />
      </div>

      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black/50 z-10" />

      {/* Optional soft glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60 z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% 40%, rgba(255,255,255,0.06), transparent 60%)',
        }}
      />

      {/* Nav hidden */}

      <section className="relative h-full flex items-center z-20">
        <div className="mx-auto max-w-[1040px] px-6 w-full">
          <div className="flex flex-col items-center text-center gap-8">
            <h1 className="text-[12vw] leading-none md:text-[9rem] font-extrabold tracking-tight">
              Prosper Path
            </h1>
            <p className="text-dim text-lg md:text-xl max-w-[720px]">
              <strong className="text-fg">The money mentor you never had. </strong><br />
              Get a tailored, step-by-step plan to grow your wealth.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
              {/* Inline email capture */}
              {/* Uses light input styling for contrast over video overlay */}
              {/* No name collected per request */}
              {/* The form is responsive: stacks on small, inline on larger screens */}
              {/* Button label tuned to "Join Waitlist" */}
              {/* Placeholder tuned to match dark UI */}
              {/* Success + error messages appear under the form */}
              <WaitlistForm includeName={false} buttonLabel="Join Waitlist" placeholder="Enter your email" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

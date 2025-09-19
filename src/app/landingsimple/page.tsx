import Link from 'next/link'
import BackgroundVideo from "@/app/components/BackgroundVideo";

export const metadata = {
  title: 'Prosper - Start Your Money Coach',
  description: 'A streamlined view of Prosper for quick evaluation.',
};

function Footer() {
  return (
    <footer className="absolute bottom-6 inset-x-0 z-20">
      <div className="mx-auto max-w-[1040px] px-6 flex items-center justify-between text-sm text-dim">
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-fg">Privacy</Link>
          <Link href="/terms" className="hover:text-fg">Terms</Link>
          <Link href="/contact" className="hover:text-fg">Contact</Link>
        </div>
        <div className="flex items-center gap-3">
          <a href="https://x.com/" className="hover:text-fg">X</a>
          <a href="https://instagram.com/" className="hover:text-fg" aria-label="Instagram">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm border border-current text-xs">IG</span>
          </a>
        </div>
      </div>
    </footer>
  )
}

export default function Page() {
  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-bg text-fg">
      <header className="absolute top-6 left-6 z-20">
        <Link href="/waitlist" className="inline-flex items-center gap-3">
          <img src="/prosper_wordmark.svg" alt="Prosper wordmark" className="h-10 md:h-12 w-auto opacity-95" />
          <span className="sr-only">Prosper</span>
        </Link>
      </header>

      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundVideo src="/landing.mp4" poster="/og.png" />
      </div>

      <div className="absolute inset-0 bg-black/40 z-10" />

      <div
        className="pointer-events-none absolute inset-0 opacity-60 z-10"
        style={{
          background:
            'radial-gradient(1200px 600px at 50% 40%, rgba(255,255,255,0.08), transparent 60%)',
        }}
      />

      <section className="relative z-20 flex h-full items-center justify-center">
        <div className="w-full max-w-[1120px] px-6">
          <div className="flex flex-col items-center text-center gap-6 md:gap-8">
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl md:leading-tight">
              Your personal money coach
            </h1>
            <p className="text-dim text-lg md:text-xl md:text-balance max-w-[680px]">
              Get a clear plan to grow your wealth, just by having a simple conversation
            </p>
            <div className="flex w-full max-w-[360px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Link
                href="/"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-dim bg-[#EFEEEB] px-7 py-3 text-sm font-medium text-[#083630] hover:opacity-90"
              >
                Start
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

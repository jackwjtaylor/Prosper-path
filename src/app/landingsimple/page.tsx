import Link from 'next/link'
import Image from 'next/image'
import BackgroundVideo from "@/app/components/BackgroundVideo";

export const metadata = {
  title: 'Prosperpath.io',
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
  const useOnboardingV2 = String(process.env.NEXT_PUBLIC_VOICE_ONBOARDING_V2 || '').toLowerCase() === 'true'
    || String(process.env.NEXT_PUBLIC_VOICE_ONBOARDING_V2 || '').toLowerCase() === '1'
    || String(process.env.NEXT_PUBLIC_VOICE_ONBOARDING_V2 || '').toLowerCase() === 'yes';
  const startHref = useOnboardingV2
    ? '/app?source=landing-simple&agentConfig=onboardingV2'
    : '/app?source=landing-simple';
  return (
    <main className="relative h-[100svh] w-screen overflow-hidden bg-bg text-fg">
      <header className="absolute top-6 left-6 z-20">
        <Link href="/waitlist" className="inline-flex items-center gap-3">
          <Image src="/prosper_wordmark_offwhite.svg" alt="Prosper wordmark" width={200} height={60} className="h-10 md:h-12 w-auto opacity-95" priority />
          <span className="sr-only">Prosper</span>
        </Link>
      </header>

      <div className="absolute inset-0 z-0 overflow-hidden">
        <BackgroundVideo webmSrc="/landing.webm" src="/landing.mp4" poster="/og.png" />
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
              Get a step-by-step plan to build long term wealth
            </p>
            <div className="flex w-full max-w-[360px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
              <Link
                href={startHref}
                prefetch
                className="inline-flex cursor-pointer pointer-events-auto items-center justify-center whitespace-nowrap rounded-full border border-dim bg-[#EFEEEB] px-7 py-3 text-sm font-medium text-[#083630] hover:opacity-90"
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

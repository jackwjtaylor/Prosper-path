import WaitlistForm from "@/app/components/WaitlistForm";
import Link from "next/link";

export const metadata = {
  title: "Prosper – Get Started",
  description: "Join the Prosper waitlist.",
};

export default function GetStartedPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="mx-auto max-w-[1040px] px-6 py-6 flex items-center justify-between">
        <Link href="/waitlist" className="text-fg/80 hover:text-fg">← Back</Link>
        <div className="text-sm text-fg/70">Prosper</div>
      </header>
      <section className="mx-auto max-w-[1040px] px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-3">Join the waitlist</h1>
        <p className="text-dim mb-6">Get early access and product updates. No spam.</p>
        <WaitlistForm buttonLabel="Join" placeholder="you@example.com" />
      </section>
    </main>
  );
}


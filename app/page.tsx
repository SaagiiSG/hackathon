import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-brand-navy px-4 py-24 text-center text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/4 size-[30rem] rounded-full bg-brand-teal/30 blur-3xl" />
        <div className="absolute -right-24 bottom-0 size-[26rem] rounded-full bg-brand-purple/30 blur-3xl" />
        <div className="absolute bottom-10 -left-24 size-72 rounded-full bg-brand-pink/20 blur-3xl" />
      </div>
      <h1 className="relative max-w-2xl text-5xl font-semibold leading-[1.1] tracking-[-1px] md:text-[56px]">
        Your friendships, built into a town.
      </h1>
      <p className="relative max-w-xl text-lg leading-normal text-on-dark-muted">
        Every memory your group shares adds a floor. Watch your town grow.
      </p>
      <div className="relative flex gap-3">
        <Button
          asChild
          size="lg"
          className="glass-prominent h-12 rounded-full bg-primary/80 px-7 text-base hover:bg-primary/95"
        >
          <Link href="/login">Start your town</Link>
        </Button>
      </div>
    </main>
  );
}

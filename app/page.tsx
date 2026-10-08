import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-brand-navy px-4 py-24 text-center text-white">
      <h1 className="max-w-2xl text-5xl font-semibold leading-[1.1] tracking-[-1px] md:text-[56px]">
        Your friendships, built into a town.
      </h1>
      <p className="max-w-xl text-lg leading-normal text-on-dark-muted">
        Every memory your group shares adds a floor. Watch your town grow.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/login">Start your town</Link>
        </Button>
      </div>
    </main>
  );
}

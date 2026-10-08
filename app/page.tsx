import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-brand-navy px-4 py-24 text-center text-white">
      <h1 className="max-w-2xl text-5xl font-semibold leading-[1.1] tracking-[-1px] md:text-[56px]">
        Your hackathon idea goes here
      </h1>
      <p className="max-w-xl text-lg leading-normal text-on-dark-muted">
        Replace this with one sentence on what the product does for whom.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <Link href="/login">Get started</Link>
        </Button>
      </div>
    </main>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function TownError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid h-dvh place-items-center bg-card-tint-mint p-4">
      <Card className="w-full max-w-sm gap-3 px-6 py-6">
        <h1 className="text-lg font-semibold text-ink">We couldn&apos;t load your town.</h1>
        <p className="text-sm text-slate">Check your connection and try again.</p>
        <Button variant="outline" className="h-10 self-start" onClick={reset}>
          Try again
        </Button>
      </Card>
    </main>
  );
}

import { Suspense } from "react";
import { getTownState } from "@/lib/town/server";
import { TownApp } from "@/components/town/town-app";

export default function TownPage() {
  return (
    <Suspense fallback={<TownLoading />}>
      <TownLoader />
    </Suspense>
  );
}

// Reads the session, so it streams in behind Suspense.
async function TownLoader() {
  const state = await getTownState();
  return <TownApp initial={state} />;
}

function TownLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-card-tint-mint">
      <p className="text-sm text-steel">Building your town…</p>
    </main>
  );
}

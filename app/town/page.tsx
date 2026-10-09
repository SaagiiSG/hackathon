import { connection } from "next/server";
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
  await connection(); // per-request: keeps Date.now() in auth/session code out of the prerender
  const state = await getTownState();
  return <TownApp initial={state} />;
}

function TownLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-background">
      <p className="text-sm text-steel">Building your town…</p>
    </main>
  );
}

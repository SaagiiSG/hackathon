import { Suspense } from "react";
import { MOCK_DATA } from "@/lib/mode";
import { getTownState } from "@/lib/town/server";
import { TownApp } from "@/components/town/town-app";

export default function TownPage({ searchParams }: PageProps<"/town">) {
  return (
    <Suspense fallback={<TownLoading />}>
      <TownLoader searchParams={searchParams} />
    </Suspense>
  );
}

// Reads the session (and ?preview= in mock mode), so it streams in behind Suspense.
async function TownLoader({ searchParams }: { searchParams: PageProps<"/town">["searchParams"] }) {
  const { preview } = await searchParams;
  const state = await getTownState(typeof preview === "string" ? preview : undefined);
  return <TownApp initial={state} mock={MOCK_DATA} />;
}

function TownLoading() {
  return (
    <main className="grid h-dvh place-items-center bg-card-tint-mint">
      <p className="text-sm text-steel">Building your town…</p>
    </main>
  );
}

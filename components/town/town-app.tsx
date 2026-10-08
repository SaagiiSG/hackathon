"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Copy, Maximize, Minus, Plus } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { longMonthLabel, monthKey } from "@/lib/town/dates";
import { buildLayout, plural, progressFor, unlockCrossed } from "@/lib/town/layout";
import { friendBgClass } from "@/lib/town/palette";
import type { Memory, Town, TownState, Viewer } from "@/lib/town/types";
import { AddMemoryPanel } from "./add-memory-panel";
import { Onboarding } from "./onboarding";
import { PlacePanel } from "./place-panel";
import type { SceneCommand } from "./town-scene";

const TownScene = dynamic(() => import("./town-scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-sm text-steel">Building your town…</div>
  ),
});

const EMPTY_TOWN = buildLayout([], [], {});

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia("(prefers-reduced-motion: reduce)");
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

export function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function copyCode(code: string) {
  navigator.clipboard?.writeText(formatCode(code)).then(
    () => toast("Invite code copied."),
    () => toast(`Your invite code is ${formatCode(code)}`),
  );
}

export function TownApp({ initial, mock }: { initial: TownState; mock: boolean }) {
  // Server data wins whenever it changes (e.g. after router.refresh()).
  const [state, setState] = useState(initial);
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    setState(initial);
  }
  const reducedMotion = useReducedMotion();

  if (state.kind === "onboarding") {
    return (
      <main className="relative h-dvh w-full overflow-hidden bg-card-tint-mint">
        <div className="absolute inset-0 opacity-60" aria-hidden>
          <TownScene
            layout={EMPTY_TOWN}
            selected={null}
            onSelect={() => {}}
            zoom={0.3}
            onZoom={() => {}}
            command={null}
            reducedMotion={reducedMotion}
          />
        </div>
        <Onboarding
          suggestedName={state.suggestedName}
          mock={mock}
          onMockTown={(town) => setState({ kind: "town", viewer: state.viewer, town })}
        />
      </main>
    );
  }

  return (
    <TownView
      town={state.town}
      viewer={state.viewer}
      mock={mock}
      reducedMotion={reducedMotion}
      onTown={(town) => setState({ ...state, town })}
    />
  );
}

function TownView({
  town,
  viewer,
  mock,
  reducedMotion,
  onTown,
}: {
  town: Town;
  viewer: Viewer;
  mock: boolean;
  reducedMotion: boolean;
  onTown: (town: Town) => void;
}) {
  const layout = useMemo(
    () => buildLayout(town.memories, town.members, town.buildingNames),
    [town.memories, town.members, town.buildingNames],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.25);
  const [command, setCommand] = useState<SceneCommand | null>(null);
  const [adding, setAdding] = useState<{ month?: string } | null>(null);

  const select = (key: string) => {
    setSelected(key);
    setCommand({ type: "focus", key, n: Date.now() });
  };

  const onAdded = (memory: Memory) => {
    const before = town.memories.length;
    const month = monthKey(memory.happenedOn);
    const newBuilding =
      memory.kind === "shared" &&
      !town.memories.some((m) => m.kind === "shared" && monthKey(m.happenedOn) === month);
    const newLodge =
      memory.kind === "solo" && !town.memories.some((m) => m.kind === "solo" && m.authorId === memory.authorId);
    onTown({ ...town, memories: [...town.memories, memory] });
    setAdding(null);
    const key = memory.kind === "shared" ? `month:${month}` : `lodge:${memory.authorId}`;
    setCommand({ type: "focus", key, n: Date.now() });
    const unlock = unlockCrossed(before, before + 1);
    toast(
      unlock ??
        (memory.kind === "solo"
          ? newLodge
            ? "A lodge went up in the woods."
            : "Your lodge in the woods grew."
          : newBuilding
            ? `A new building went up for ${longMonthLabel(month)}.`
            : `Added to ${longMonthLabel(month)}. Your town grew a floor.`),
    );
  };

  const progress = progressFor(layout.total);
  const empty = town.memories.length === 0;
  const step = (d: number) => setZoom((z) => Math.min(1, Math.max(0, z + d)));

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-card-tint-mint">
      <div
        className="absolute inset-0"
        role="img"
        aria-label={`3D map of ${town.name}: ${plural(layout.buildings.length, "building")} and ${plural(layout.lodges.length, "lodge")}.`}
      >
        <TownScene
          layout={layout}
          selected={selected}
          onSelect={select}
          zoom={zoom}
          onZoom={setZoom}
          command={command}
          reducedMotion={reducedMotion}
        />
      </div>

      {/* Town bar */}
      <Card className="absolute top-3 left-3 z-20 max-w-[calc(100%-6rem)] gap-2 px-4 py-3 shadow-[0_4px_12px_rgba(15,15,15,0.08)] md:top-4 md:left-4">
        <h1 className="truncate text-lg leading-snug font-semibold text-ink">{town.name}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {town.members.map((m) => (
            <span key={m.userId} className="flex items-center gap-1.5 text-[13px] text-slate">
              <span className={`size-2.5 rounded-full ${friendBgClass(m.colorIndex)}`} aria-hidden />
              {m.displayName}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[13px] text-steel">
          <span>
            Invite code <span className="font-semibold tracking-[1px] text-ink">{formatCode(town.inviteCode)}</span>
          </span>
          <Button variant="ghost" size="icon-sm" onClick={() => copyCode(town.inviteCode)} aria-label="Copy invite code">
            <Copy />
          </Button>
        </div>
      </Card>

      {/* Account */}
      <div className="absolute top-3 right-3 z-20 md:top-4 md:right-4">
        {mock ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Exit demo</Link>
          </Button>
        ) : (
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm" title={viewer.email}>
              Sign out
            </Button>
          </form>
        )}
      </div>

      {/* Progress */}
      {!empty && (
        <Card className="absolute bottom-20 left-3 z-20 gap-1 px-4 py-3 shadow-[0_4px_12px_rgba(15,15,15,0.08)] md:bottom-4 md:left-4">
          <p className="text-sm font-medium text-ink">
            {plural(layout.total, "memory", "memories")} · {plural(layout.months, "month")}
          </p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-hairline" aria-hidden>
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.pct}%` }} />
          </div>
          <p className="text-[13px] text-slate">{progress.caption}</p>
        </Card>
      )}

      {/* Empty town */}
      {empty && (
        <Card className="absolute bottom-20 left-1/2 z-20 w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 gap-3 px-5 py-4 shadow-[0_4px_12px_rgba(15,15,15,0.08)]">
          <h2 className="text-lg font-semibold text-ink">Your town is an empty plot</h2>
          <p className="text-sm text-slate">
            Add your first memory and the first building goes up. Every memory adds a floor.
          </p>
          <p className="flex items-center gap-1 text-[13px] text-steel">
            Invite friends with code <span className="font-semibold text-ink">{formatCode(town.inviteCode)}</span>
            <Button variant="link" size="sm" onClick={() => copyCode(town.inviteCode)}>
              Copy
            </Button>
          </p>
        </Card>
      )}

      {/* Add memory */}
      <div className="absolute inset-x-3 bottom-3 z-20 md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2">
        <Button size="lg" className="h-11 w-full px-5 text-sm md:w-auto" onClick={() => setAdding({})}>
          <Plus />
          {empty ? "Add the first memory" : "Add memory"}
        </Button>
      </div>

      {/* Zoom */}
      <Card className="absolute right-3 bottom-20 z-20 flex-row items-center gap-1 p-1 shadow-[0_4px_12px_rgba(15,15,15,0.08)] md:right-4 md:bottom-4">
        <Button variant="ghost" size="icon" onClick={() => step(-0.1)} aria-label="Zoom out">
          <Minus />
        </Button>
        <span className="hidden w-10 text-center text-[12px] font-medium text-steel tabular-nums md:block">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon" onClick={() => step(0.1)} aria-label="Zoom in">
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            setSelected(null);
            setCommand({ type: "reset", n: Date.now() });
          }}
          aria-label="Reset view"
          title="Reset view"
        >
          <Maximize />
        </Button>
      </Card>

      {selected && (
        <PlacePanel
          key={selected}
          placeKey={selected}
          town={town}
          layout={layout}
          viewer={viewer}
          onClose={() => setSelected(null)}
          onAdd={(month) => setAdding({ month })}
          onNamed={(month, name) => onTown({ ...town, buildingNames: { ...town.buildingNames, [month]: name } })}
        />
      )}

      {adding && (
        <AddMemoryPanel
          town={town}
          viewer={viewer}
          month={adding.month}
          onClose={() => setAdding(null)}
          onAdded={onAdded}
        />
      )}
    </main>
  );
}

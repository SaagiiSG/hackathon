"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { CalendarDays, Maximize, Minus, Plus, UserPlus, Volume2, VolumeX } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { GlassPanel } from "@/components/glass-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { longMonthLabel, monthKey } from "@/lib/town/dates";
import { buildLayout, plural, progressFor, unlockCrossed } from "@/lib/town/layout";
import { friendRingClass } from "@/lib/town/palette";
import { sound } from "@/lib/town/sound";
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

const noSubscribe = () => () => {};

// Browsers only start audio from a user gesture, so the first press anywhere unlocks it.
function useSound(traffic: number) {
  const stored = useSyncExternalStore(noSubscribe, () => sound.isEnabled(), () => true);
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    const unlock = () => {
      sound.unlock();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      sound.pause();
    };
  }, []);
  useEffect(() => sound.setTraffic(traffic), [traffic]);
  const enabled = on ?? stored;
  const toggle = () => {
    sound.setEnabled(!enabled);
    setOn(!enabled);
  };
  return [enabled, toggle] as const;
}

export function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)).toUpperCase() || "?";
}

function copyCode(code: string) {
  navigator.clipboard?.writeText(formatCode(code)).then(
    () => toast("Invite code copied."),
    () => toast(`Your invite code is ${formatCode(code)}`),
  );
}

export function TownApp({ initial }: { initial: TownState }) {
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
      <main className="relative h-dvh w-full overflow-hidden bg-background">
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
        />
      </main>
    );
  }

  return (
    <TownView
      town={state.town}
      viewer={state.viewer}
      reducedMotion={reducedMotion}
      onTown={(town) => setState({ ...state, town })}
    />
  );
}

function TownView({
  town,
  viewer,
  reducedMotion,
  onTown,
}: {
  town: Town;
  viewer: Viewer;
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
  // Cars park under reduced motion, so the engines go quiet with them.
  const [soundOn, toggleSound] = useSound(reducedMotion ? 0 : layout.carCount);

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
  const me = town.members.find((m) => m.userId === viewer.id);
  const months = [...layout.buildings].sort((a, b) => b.month.localeCompare(a.month));
  const count = (month: string) =>
    town.memories.filter((m) => m.kind === "shared" && monthKey(m.happenedOn) === month).length;
  // Up to 6 of the selected place's photos, newest last, for the scene's photo fan.
  const selectedPhotos = useMemo(() => {
    if (!selected) return [];
    const [kind, id] = [selected.slice(0, selected.indexOf(":")), selected.slice(selected.indexOf(":") + 1)];
    return town.memories
      .filter((m) =>
        kind === "month"
          ? m.kind === "shared" && monthKey(m.happenedOn) === id
          : m.kind === "solo" && m.authorId === id,
      )
      .filter((m) => m.photoUrl)
      .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt))
      .slice(-6)
      .map((m) => ({ id: m.id, url: m.photoUrl!, title: m.title }));
  }, [selected, town.memories]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
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
          selectedPhotos={selectedPhotos}
          onAddTo={(month) => setAdding({ month })}
        />
      </div>

      {/* Town bar */}
      <GlassPanel className="absolute top-3 left-3 z-20 max-w-[calc(100%-8.5rem)] gap-2 px-4 py-3 md:top-4 md:left-4 md:max-w-sm">
        <h1 className="truncate text-lg leading-snug font-semibold text-ink">{town.name}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          {town.members.map((m) => (
            <Tooltip key={m.userId}>
              <TooltipTrigger asChild>
                <Avatar size="sm" className={`ring-2 ring-offset-1 ${friendRingClass(m.colorIndex)}`}>
                  <AvatarFallback className="text-[11px] font-semibold text-ink">{initials(m.displayName)}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>{m.displayName}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <div className="-ml-2 flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm">
                <UserPlus />
                Invite
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="flex w-72 flex-col gap-2">
              <p className="text-sm font-medium text-ink">Invite friends</p>
              <p className="text-[22px] font-semibold tracking-[1px] text-ink">{formatCode(town.inviteCode)}</p>
              <p className="text-[13px] text-steel">Friends sign up, choose Join with a code, and type this in.</p>
              <Button variant="outline" size="sm" className="self-start" onClick={() => copyCode(town.inviteCode)}>
                Copy code
              </Button>
            </PopoverContent>
          </Popover>
          {months.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <CalendarDays />
                  Months
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {months.map((b) => (
                  <DropdownMenuItem key={b.key} onSelect={() => select(b.key)}>
                    {b.longLabel} · {count(b.month)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </GlassPanel>

      {/* Sound + account */}
      <div className="absolute top-3 right-3 z-20 flex gap-2 md:top-4 md:right-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="glass-clear size-11 rounded-full"
              onClick={toggleSound}
              aria-label={soundOn ? "Mute sound" : "Turn sound on"}
            >
              {soundOn ? <Volume2 /> : <VolumeX />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{soundOn ? "Mute sound" : "Turn sound on"}</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="glass-clear size-11 rounded-full" aria-label="Account">
              <Avatar className={me ? `ring-2 ring-offset-1 ${friendRingClass(me.colorIndex)}` : undefined}>
                <AvatarFallback className="bg-white/80 text-xs font-semibold text-ink">
                  {initials(me?.displayName ?? viewer.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="truncate text-[13px] font-normal text-steel">
              {viewer.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => copyCode(town.inviteCode)}>Copy invite code</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void signOut()}>Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress */}
      {!empty && (
        <GlassPanel className="absolute right-[4.25rem] bottom-[4.5rem] left-3 z-20 gap-1 px-4 py-2.5 md:right-auto md:bottom-4 md:left-4 md:py-3">
          <p className="text-sm font-medium text-ink">
            {plural(layout.total, "memory", "memories")} · {plural(layout.months, "month")}
          </p>
          <Progress value={progress.pct} className="h-1.5 w-full bg-hairline-soft md:w-48" aria-label="Progress to the next unlock" />
          <p className="text-[13px] text-slate">{progress.caption}</p>
        </GlassPanel>
      )}

      {/* Empty town */}
      {empty && (
        <GlassPanel className="absolute bottom-[7.5rem] left-1/2 z-20 w-[min(26rem,calc(100%-1.5rem))] -translate-x-1/2 gap-3 px-5 py-4 md:bottom-20">
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
        </GlassPanel>
      )}

      {/* Add memory */}
      <div className="absolute inset-x-3 bottom-3 z-20 md:inset-x-auto md:bottom-4 md:left-1/2 md:-translate-x-1/2">
        <Button size="lg" className="glass-prominent h-12 w-full rounded-full bg-primary/80 px-6 text-sm hover:bg-primary/90 md:w-auto" onClick={() => setAdding({})}>
          <Plus />
          {empty ? "Add the first memory" : "Add memory"}
        </Button>
      </div>

      {/* Zoom */}
      <GlassPanel className="absolute right-3 bottom-[4.5rem] z-20 flex-row items-center gap-1 rounded-full p-1 md:right-4 md:bottom-4">
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => step(-0.1)} aria-label="Zoom out">
          <Minus />
        </Button>
        <Slider
          value={[zoom]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([z]) => setZoom(z)}
          className="hidden w-32 md:flex"
          aria-label="Zoom"
        />
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => step(0.1)} aria-label="Zoom in">
          <Plus />
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelected(null);
                setCommand({ type: "reset", n: Date.now() });
              }}
              aria-label="Reset view"
            >
              <Maximize />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset view</TooltipContent>
        </Tooltip>
      </GlassPanel>

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

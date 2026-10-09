"use client";

import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { monthKey, monthName, shortDay } from "@/lib/town/dates";
import { nameBuilding } from "@/lib/town/client";
import { plural, type TownLayout } from "@/lib/town/layout";
import { friendBgClass } from "@/lib/town/palette";
import type { Memory, Town, Viewer } from "@/lib/town/types";

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const q = window.matchMedia("(min-width: 768px)");
      q.addEventListener("change", cb);
      return () => q.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );
}

// What opens when you click a building (a month) or a lodge (one friend's solo memories).
export function PlacePanel({
  placeKey,
  town,
  layout,
  viewer,
  onClose,
  onAdd,
  onNamed,
}: {
  placeKey: string;
  town: Town;
  layout: TownLayout;
  viewer: Viewer;
  onClose: () => void;
  onAdd: (month: string) => void;
  onNamed: (month: string, name: string) => void;
}) {
  const desktop = useIsDesktop();
  const building = layout.buildings.find((b) => b.key === placeKey);
  const lodge = layout.lodges.find((l) => l.key === placeKey);
  if (!building && !lodge) return null;

  const memories = town.memories
    .filter((m) =>
      building
        ? m.kind === "shared" && monthKey(m.happenedOn) === building.month
        : m.kind === "solo" && m.authorId === lodge!.userId,
    )
    .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt));
  const member = (id: string) => town.members.find((m) => m.userId === id);
  const authors = [...new Set(memories.map((m) => m.authorId))].map((id) => member(id)?.displayName ?? "Someone");

  return (
    // Non-modal: no scrim, so the town and the photos popping out of the building stay in view.
    <Sheet open modal={false} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        onInteractOutside={(e) => {
          if ((e.target as Element | null)?.closest?.("[data-town-photo]")) e.preventDefault();
        }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Non-modal sheets dismiss on focus leaving them; menus hand focus back to their trigger.
        onFocusOutside={(e) => e.preventDefault()}
        side={desktop ? "right" : "bottom"}
        className="glass max-h-[60dvh] overflow-y-auto bg-white/60 data-[side=bottom]:rounded-t-3xl data-[side=right]:max-h-none data-[side=right]:rounded-l-3xl data-[side=right]:sm:max-w-[400px]"
      >
        <SheetHeader className="pr-10">
          <SheetTitle className="text-[22px] leading-tight font-semibold text-ink">
            {building ? building.longLabel : `${lodge!.displayName}'s lodge`}
          </SheetTitle>
          <SheetDescription className="text-sm text-slate">
            {building
              ? `${plural(memories.length, "shared memory", "shared memories")} from ${listNames(authors)}`
              : `${plural(memories.length, "solo memory", "solo memories")} in the woods`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-4 px-4 pb-4">

          {building && (
            <BuildingName
              key={building.name ?? ""}
              town={town}
              viewer={viewer}
              month={building.month}
              name={building.name}
              onNamed={onNamed}
            />
          )}

          <ol className="flex flex-col gap-3">
            {memories.map((m) => (
              <MemoryCard key={m.id} memory={m} author={member(m.authorId)} />
            ))}
          </ol>

          {building && (
            <Button variant="outline" className="h-10" onClick={() => onAdd(building.month)}>
              <Plus />
              Add a memory to {monthName(building.month)}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BuildingName({
  town,
  viewer,
  month,
  name,
  onNamed,
}: {
  town: Town;
  viewer: Viewer;
  month: string;
  name: string | null;
  onNamed: (month: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name ?? "");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return name ? (
      <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-medium text-ink">“{name}”</p>
        <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Rename this building">
          <Pencil />
        </Button>
      </div>
    ) : (
      <Button variant="link" className="h-auto justify-start p-0" onClick={() => setEditing(true)}>
        Name this building
      </Button>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = value.trim();
    if (!next) return;
    setSaving(true);
    try {
      await nameBuilding(town.id, viewer, month, next);
      onNamed(month, next);
      toast("Building named.");
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="flex gap-2">
      <Input
        autoFocus
        value={value}
        maxLength={60}
        onChange={(e) => setValue(e.target.value)}
        placeholder="The best month of my life"
        aria-label="Building name"
        className="h-10"
      />
      <Button type="submit" className="h-10" disabled={saving || !value.trim()}>
        Save
      </Button>
      <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </form>
  );
}

function MemoryCard({ memory, author }: { memory: Memory; author?: Town["members"][number] }) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <li className="overflow-hidden rounded-xl border border-hairline bg-white">
      {memory.photoUrl &&
        (broken ? (
          <div className="grid aspect-[4/3] place-items-center bg-card-tint-gray text-[13px] text-steel">
            Photo unavailable
          </div>
        ) : (
          <div className="relative aspect-[4/3]">
            {!loaded && <Skeleton className="absolute inset-0 rounded-none" />}
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs and local previews */}
            <img
              src={memory.photoUrl}
              alt={memory.title}
              className="size-full object-cover"
              onLoad={() => setLoaded(true)}
              onError={() => setBroken(true)}
            />
          </div>
        ))}
      <div className="flex flex-col gap-1 px-4 py-3">
        <p className="font-medium text-ink">{memory.title}</p>
        {memory.body && <p className="text-[15px] leading-relaxed text-charcoal">{memory.body}</p>}
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-steel">
          <span className={`size-2 rounded-full ${friendBgClass(author?.colorIndex ?? 0)}`} aria-hidden />
          {author?.displayName ?? "Someone"} · {shortDay(memory.happenedOn)}
        </p>
      </div>
    </li>
  );
}

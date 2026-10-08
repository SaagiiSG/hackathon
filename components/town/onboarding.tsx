"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTown, joinTown } from "@/lib/town/client";
import { MOCK_TOWN, MOCK_VIEWER } from "@/lib/town/mock";
import type { Town } from "@/lib/town/types";

// Not in a town yet: start one, or join friends with their code.
export function Onboarding({
  suggestedName,
  mock,
  onMockTown,
}: {
  suggestedName: string;
  mock: boolean;
  onMockTown: (town: Town) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"start" | "join">("start");
  const [townName, setTownName] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState(suggestedName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const me = name.trim();
    if (!me) return setError("Add the name your friends call you.");
    if (tab === "start" && !townName.trim()) return setError("Give your town a name.");
    const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (tab === "join" && cleanCode.length !== 8) {
      return setError("That code doesn't match a town. Check the 8 characters.");
    }

    setBusy(true);
    try {
      if (mock) {
        if (tab === "join" && cleanCode !== MOCK_TOWN.inviteCode) {
          throw new Error("That code doesn't match a town. Check the 8 characters.");
        }
        const self = { userId: MOCK_VIEWER.id, displayName: me, joinedAt: new Date().toISOString(), colorIndex: 0 };
        onMockTown(
          tab === "start"
            ? { ...MOCK_TOWN, name: townName.trim(), members: [self], memories: [], buildingNames: {} }
            : MOCK_TOWN,
        );
        return;
      }
      if (tab === "start") await createTown(townName.trim(), me);
      else await joinTown(cleanCode, me);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 grid place-items-center overflow-y-auto p-3">
      <Card className="w-full max-w-sm gap-5 px-6 py-6 shadow-[0_16px_48px_-8px_rgba(15,15,15,0.16)]">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] font-semibold text-ink">Start your town</h1>
          <p className="text-sm text-slate">
            Memotown turns your group&apos;s memories into a little city. Start a town, or join your friends with
            their code.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface p-1">
          {(["start", "join"] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={tab === t ? "outline" : "ghost"}
              aria-pressed={tab === t}
              className="h-9"
              onClick={() => {
                setTab(t);
                setError(null);
              }}
            >
              {t === "start" ? "Start a town" : "Join with a code"}
            </Button>
          ))}
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          {tab === "start" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="town-name">Name your town</Label>
              <Input
                id="town-name"
                value={townName}
                maxLength={40}
                placeholder="Saagii & friends"
                className="h-11"
                onChange={(e) => setTownName(e.target.value)}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="town-code">Invite code</Label>
              <Input
                id="town-code"
                value={code}
                maxLength={9}
                placeholder="K7QM-2XPA"
                autoCapitalize="characters"
                className="h-11 tracking-[1px] uppercase"
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="display-name">Your name</Label>
            <Input
              id="display-name"
              value={name}
              maxLength={30}
              placeholder="What your friends call you"
              className="h-11"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className="text-[13px] text-destructive">{error}</p>}
          <Button type="submit" className="h-11" disabled={busy}>
            {tab === "start" ? "Start town" : "Join town"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

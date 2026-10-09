import { createClient } from "@/lib/supabase/client";
import type { Member, Memory } from "./types";

// Live updates for one town: friends' new memories, building names and members.
// Needs the tables in the `supabase_realtime` publication (supabase/realtime.sql).
// RLS still applies, so a subscriber only hears about their own town.

type MemoryRow = {
  id: string;
  author_id: string;
  kind: Memory["kind"];
  title: string;
  body: string | null;
  photo_path: string | null;
  happened_on: string;
  created_at: string;
};

export type TownEvents = {
  onMemory: (memory: Memory) => void;
  onBuildingName: (month: string, name: string) => void;
  onMember: (member: Omit<Member, "colorIndex">) => void;
};

export function subscribeTown(townId: string, events: TownEvents) {
  const supabase = createClient();
  const filter = `group_id=eq.${townId}`;

  const channel = supabase
    .channel(`town:${townId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "memories", filter }, async (payload) => {
      const row = payload.new as MemoryRow;
      let photoUrl: string | null = null;
      if (row.photo_path) {
        const { data } = await supabase.storage.from("memory-photos").createSignedUrl(row.photo_path, 60 * 60 * 6);
        photoUrl = data?.signedUrl ?? null;
      }
      events.onMemory({
        id: row.id,
        authorId: row.author_id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        photoUrl,
        happenedOn: row.happened_on,
        createdAt: row.created_at,
      });
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "building_names", filter }, (payload) => {
      const row = payload.new as { month?: string; name?: string };
      if (row.month && row.name) events.onBuildingName(String(row.month).slice(0, 7), row.name);
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_members", filter }, (payload) => {
      const row = payload.new as { user_id: string; display_name: string; joined_at: string };
      events.onMember({ userId: row.user_id, displayName: row.display_name, joinedAt: row.joined_at });
    })
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

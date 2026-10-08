import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { MOCK_DATA } from "@/lib/mode";
import { createClient } from "@/lib/supabase/server";
import { mockState } from "./mock";
import type { TownState } from "./types";

// Loads everything /town needs. Reads cookies, so callers sit behind <Suspense>.
export async function getTownState(preview?: string): Promise<TownState> {
  if (MOCK_DATA) return mockState(preview);

  const viewer = await getCurrentUser();
  const supabase = await createClient();
  const { data: me, error: meError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (meError) throw new Error(meError.message);
  if (!me) {
    return { kind: "onboarding", viewer, suggestedName: viewer.email.split("@")[0] ?? "" };
  }

  const gid: string = me.group_id;
  const [group, members, memories, names] = await Promise.all([
    supabase.from("groups").select("id, name, invite_code").eq("id", gid).single(),
    supabase.from("group_members").select("user_id, display_name, joined_at").eq("group_id", gid).order("joined_at"),
    supabase
      .from("memories")
      .select("id, author_id, kind, title, body, photo_path, happened_on, created_at")
      .eq("group_id", gid)
      .order("happened_on")
      .order("created_at"),
    supabase.from("building_names").select("month, name").eq("group_id", gid),
  ]);
  const error = group.error ?? members.error ?? memories.error ?? names.error;
  if (error) throw new Error(error.message);
  if (!group.data || !members.data || !memories.data || !names.data) throw new Error("Town data missing");

  // Photos live in a private bucket; hand the browser short-lived links.
  const paths = memories.data.flatMap((m) => (m.photo_path ? [m.photo_path as string] : []));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("memory-photos").createSignedUrls(paths, 60 * 60 * 6);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return {
    kind: "town",
    viewer,
    town: {
      id: group.data.id,
      name: group.data.name,
      inviteCode: group.data.invite_code,
      members: members.data.map((m, i) => ({
        userId: m.user_id,
        displayName: m.display_name,
        joinedAt: m.joined_at,
        colorIndex: i,
      })),
      memories: memories.data.map((m) => ({
        id: m.id,
        authorId: m.author_id,
        kind: m.kind,
        title: m.title,
        body: m.body,
        photoUrl: m.photo_path ? (urls.get(m.photo_path) ?? null) : null,
        happenedOn: m.happened_on,
        createdAt: m.created_at,
      })),
      buildingNames: Object.fromEntries(names.data.map((n) => [String(n.month).slice(0, 7), n.name])),
    },
  };
}

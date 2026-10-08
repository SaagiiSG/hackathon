import { MOCK_DATA } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { toDay, today } from "./dates";
import type { Memory, NewMemory, Viewer } from "./types";

// Browser-side writes. RLS on Supabase decides what each person may do.

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const PHOTO_TYPES = Object.keys(EXT);
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const ERRORS: Record<string, string> = {
  invalid_code: "That code doesn't match a town. Check the 8 characters.",
  already_in_town: "You're already in a town.",
  invalid_name: "Check the names: they can't be empty or too long.",
  not_signed_in: "Your session ended. Sign in again.",
};

function friendly(message: string) {
  const known = Object.keys(ERRORS).find((k) => message.includes(k));
  return known ? ERRORS[known] : "Something went wrong. Check your connection and try again.";
}

export async function saveMemory(townId: string, viewer: Viewer, input: NewMemory): Promise<Memory> {
  const localUrl = input.photo ? URL.createObjectURL(input.photo) : null;
  if (MOCK_DATA) {
    await new Promise((r) => setTimeout(r, 300));
    return {
      id: crypto.randomUUID(),
      authorId: viewer.id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      photoUrl: localUrl,
      happenedOn: input.happenedOn,
      createdAt: new Date().toISOString(),
    };
  }

  const supabase = createClient();
  let photoPath: string | null = null;
  if (input.photo) {
    photoPath = `${townId}/${crypto.randomUUID()}.${EXT[input.photo.type]}`;
    const { error } = await supabase.storage
      .from("memory-photos")
      .upload(photoPath, input.photo, { contentType: input.photo.type, upsert: false });
    if (error) throw new Error(friendly(error.message));
  }
  const { data, error } = await supabase
    .from("memories")
    .insert({
      group_id: townId,
      author_id: viewer.id,
      kind: input.kind,
      title: input.title,
      body: input.body,
      photo_path: photoPath,
      happened_on: input.happenedOn,
    })
    .select("id, created_at")
    .single();
  if (error) throw new Error(friendly(error.message));
  return {
    id: data.id,
    authorId: viewer.id,
    kind: input.kind,
    title: input.title,
    body: input.body,
    photoUrl: localUrl,
    happenedOn: input.happenedOn,
    createdAt: data.created_at,
  };
}

export async function nameBuilding(townId: string, viewer: Viewer, month: string, name: string) {
  if (MOCK_DATA) return;
  const { error } = await createClient()
    .from("building_names")
    .upsert({ group_id: townId, month: `${month}-01`, name, named_by: viewer.id }, { onConflict: "group_id,month" });
  if (error) throw new Error(friendly(error.message));
}

export async function createTown(name: string, displayName: string) {
  const { error } = await createClient().rpc("create_group", { p_name: name, p_display_name: displayName });
  if (error) throw new Error(friendly(error.message));
}

export async function joinTown(code: string, displayName: string) {
  const { error } = await createClient().rpc("join_group", { p_code: code, p_display_name: displayName });
  if (error) throw new Error(friendly(error.message));
}

// "When was it?" from the photo itself, when the camera recorded it.
export async function photoDate(file: File): Promise<string | null> {
  try {
    const exifr = (await import("exifr")).default;
    const tags = await exifr.parse(file, ["DateTimeOriginal", "CreateDate"]);
    const date: unknown = tags?.DateTimeOriginal ?? tags?.CreateDate;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const day = toDay(date);
    return day <= today() ? day : null;
  } catch {
    return null;
  }
}

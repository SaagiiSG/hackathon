import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type User = { id: string; email: string };

// Data Access Layer: the one place pages read the current user.
// Reads cookies, so callers must sit behind a <Suspense> boundary.
export async function getCurrentUser(): Promise<User> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return { id: claims.sub, email: (claims.email as string) ?? "" };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Signed display URLs (1-hour) for staff who have an avatar. The avatars bucket
 * is private (tenant-scoped), so display goes through signed URLs. Returns a
 * plain object (staffId -> url) so it can cross into client components.
 */
export async function signedAvatarUrls(
  supabase: SupabaseClient,
  staff: { id: string; avatar_path: string | null }[]
): Promise<Record<string, string>> {
  const withAvatar = staff.filter((s) => s.avatar_path);
  if (withAvatar.length === 0) return {};
  const { data } = await supabase.storage
    .from("avatars")
    .createSignedUrls(
      withAvatar.map((s) => s.avatar_path as string),
      3600
    );
  const byPath = new Map(
    (data ?? [])
      .filter((d) => d.signedUrl && d.path)
      .map((d) => [d.path as string, d.signedUrl])
  );
  const out: Record<string, string> = {};
  for (const s of withAvatar) {
    const url = byPath.get(s.avatar_path as string);
    if (url) out[s.id] = url;
  }
  return out;
}

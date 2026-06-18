"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically re-fetches the current server-component tree so schedule-derived
 * views stay live without a manual reload. My Schedule ("My Status Now") uses
 * this so a shift change a manager just made shows up here too — mirrors the
 * Live Board's poll. Renders nothing.
 *
 * (True sub-second cross-device push would need Supabase Realtime — deferred;
 * this poll plus revalidatePath on the mutating actions covers the demo.)
 */
export default function AutoRefresh({
  intervalMs = 45_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

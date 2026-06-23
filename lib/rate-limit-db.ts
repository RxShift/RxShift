import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";

// Shared, cross-instance rate limiting backed by the Postgres `rate_limit` table
// (migration 0036). Replaces the old in-memory `Map` throttles, which didn't
// share state across serverless instances and were therefore bypassable.

/** Best-effort client IP from the proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

/**
 * Returns true if the request is ALLOWED, false if the limit is exceeded.
 * Fixed window: at most `max` hits per `windowSeconds` for (bucket, identifier).
 *
 * Fails OPEN (returns true) if the limiter itself errors — we never lock a real
 * user out because of a transient DB hiccup. The trade-off is acceptable: the
 * abuse this guards (email-bomb / enumeration at scale) is a nuisance, not a
 * data breach.
 */
export async function checkRateLimit(
  bucket: string,
  identifier: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const id = identifier?.trim().toLowerCase();
  if (!id) return true;
  try {
    const service = createServiceClient();
    const { data, error } = await service.rpc("check_rate_limit", {
      p_bucket: bucket,
      p_identifier: id,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[rate-limit] check failed (allowing):", error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error("[rate-limit] check threw (allowing):", e);
    return true;
  }
}

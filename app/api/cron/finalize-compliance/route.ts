import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { finalizeAllTenants } from "@/lib/compliance-record";

// Finalize the Compliance Record (as-worked). For every ratio tenant, this
// writes an immutable compliance_record row for each completed hour not yet
// recorded — reconstructing actual presence from the published schedule adjusted
// by the live-status history. Idempotent: it only fills missing hours, so a
// missed run self-heals on the next one.
//
// CADENCE: scheduled DAILY in vercel.json (`0 9 * * *`) because Vercel Hobby
// caps crons at daily — each morning it finalizes yesterday + any earlier
// not-yet-recorded hours. The Compliance Record is retrospective, so daily
// finalization of completed days is fully defensible. When the RxShift Vercel
// account moves to Pro (the first-customer trigger), change the schedule to
// hourly (`5 * * * *`) for a near-real-time record — same code, just cadence.
// The lookback below covers several days so a skipped daily run never leaves a
// permanent hole.

export const dynamic = "force-dynamic";

const LOOKBACK_DAYS = 4;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const results = await finalizeAllTenants(supabase, { lookbackDays: LOOKBACK_DAYS });
  const recorded = results.reduce((n, r) => n + r.recorded, 0);

  return NextResponse.json({
    ok: true,
    tenants: results.length,
    recorded,
    at: new Date().toISOString(),
  });
}

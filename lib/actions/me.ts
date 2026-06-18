"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { nowInTimeZone } from "@/lib/dates";
import { timeToMinutes, minutesToTime } from "@/lib/engine/ratio";
import type { ShiftSegment } from "@/lib/types";
import {
  ActionError,
  logActivity,
  requireMember,
  runAction,
  type ActionResult,
} from "./helpers";

const schema = z.object({
  shift_id: z.string().uuid(),
  work_type_id: z.string().uuid().nullable(),
});

/**
 * A staff member changes their OWN work type in real time, from My Schedule.
 * Effective now: the segment covering the current minute is split at "now" so
 * history is preserved (what they were doing until now stays; the new work type
 * applies from now to the end of the shift). The ratio recomputes immediately
 * (board + My Schedule revalidated). Managers set work types in advance by
 * splitting a shift in the editor; this is the on-the-floor, ad-hoc version.
 *
 * Writes go through the service client because shift_segment edits are
 * manager-only under RLS — but ONLY after verifying the shift belongs to the
 * caller and the work type belongs to their tenant.
 */
export async function setMyWorkType(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    const data = schema.parse(input);
    if (!ctx.appUser.staff_id)
      throw new ActionError("Your sign-in isn't linked to a staff record yet.");

    const supabase = await createClient();

    // Ownership + validity checks (RLS-safe reads).
    const { data: shift } = await supabase
      .from("shift")
      .select("*, shift_segment(*)")
      .eq("id", data.shift_id)
      .maybeSingle();
    if (!shift) throw new ActionError("Shift not found.");
    if (shift.staff_id !== ctx.appUser.staff_id)
      throw new ActionError("That isn't your shift.");

    if (data.work_type_id) {
      const { data: wt } = await supabase
        .from("work_type")
        .select("id")
        .eq("id", data.work_type_id)
        .eq("tenant_id", ctx.tenantId)
        .maybeSingle();
      if (!wt) throw new ActionError("Unknown work type.");
    }

    const { date: today, minutes: nowMin } = nowInTimeZone(ctx.tenant.timezone);
    if (shift.date !== today)
      throw new ActionError("You can only change your work type on today's shift.");

    const segments = (shift.shift_segment ?? []) as ShiftSegment[];
    const current = segments.find((seg) => {
      const start = timeToMinutes(String(seg.start_time).slice(0, 5));
      const end0 = timeToMinutes(String(seg.end_time).slice(0, 5));
      const end = end0 > start ? end0 : 1440;
      return start <= nowMin && nowMin < end;
    });
    if (!current)
      throw new ActionError("You don't have an active shift segment right now.");

    const svc = createServiceClient();
    const startMin = timeToMinutes(String(current.start_time).slice(0, 5));
    const endMin = timeToMinutes(String(current.end_time).slice(0, 5));
    const overnight = endMin <= startMin;

    if (!overnight && nowMin > startMin && nowMin < endMin) {
      // Split at "now": the existing part keeps its work type; the rest takes
      // the new one.
      const splitAt = minutesToTime(nowMin);
      const { error: e1 } = await svc
        .from("shift_segment")
        .update({ end_time: splitAt })
        .eq("id", current.id);
      if (e1) throw new ActionError(e1.message);
      const { error: e2 } = await svc.from("shift_segment").insert({
        shift_id: data.shift_id,
        tenant_id: ctx.tenantId,
        start_time: splitAt,
        end_time: current.end_time,
        work_type_id: data.work_type_id,
        counts_toward_ratio: null, // follow the work type's default
      });
      if (e2) throw new ActionError(e2.message);
    } else {
      // At the very start of the segment (or an overnight edge) — change it whole.
      const { error } = await svc
        .from("shift_segment")
        .update({ work_type_id: data.work_type_id, counts_toward_ratio: null })
        .eq("id", current.id);
      if (error) throw new ActionError(error.message);
    }

    await logActivity(ctx, "work_type_change", "shift", data.shift_id, {
      work_type_id: data.work_type_id,
      at: minutesToTime(nowMin),
    });
    revalidatePath("/app/me");
    revalidatePath("/app/board");
    return undefined;
  });
}

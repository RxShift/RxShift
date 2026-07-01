"use server";

// Scheduler-direct PTO. A manager marks someone off for a day straight from the
// schedule grid (the "PTO" checkbox on the shift editor). This writes the same
// pto_day record that time-off APPROVAL writes (lib/actions/requests.ts), so both
// paths render identically. Marking PTO also deletes any shift that day — PTO
// affects ratio only via the absence of a shift, and the compliance engine never
// reads pto_day, so the engine stays the single source of compliance truth.
//
// The optional reason lives on pto_day.reason, NEVER in override_log (that channel
// is only for acknowledged compliance-flag overrides). tenant.pto_reason_required
// makes the reason mandatory.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { eachDate } from "@/lib/dates";
import {
  ActionError,
  logActivity,
  requireManager,
  revalidateScheduleViews,
  runAction,
  type ActionResult,
} from "./helpers";

const setSchema = z.object({
  staff_id: z.string().uuid(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  // Inclusive end. Equals start_date for a single day; a later date marks a
  // continuous block off in one action (mirrors the shift "copy through" flow).
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().max(500).nullish(),
});

/**
 * Mark a person off for a single day OR a continuous range in one action. Writes
 * the same pto_day record that time-off APPROVAL writes, so both paths render
 * identically, and deletes any shift in the range (PTO = absence of a shift; the
 * engine never reads pto_day). Independent of publish state and of the schedule
 * view window — a two-week vacation can be entered even if the grid only shows a
 * week.
 */
export async function setPtoRange(
  input: unknown
): Promise<ActionResult<{ days: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = setSchema.parse(input);
    const supabase = await createClient();

    if (data.end_date < data.start_date)
      throw new ActionError("The end date is before the start date.");
    const dates = eachDate(data.start_date, data.end_date);
    if (dates.length > 366)
      throw new ActionError("Please keep a PTO block within a year at a time.");

    if (ctx.tenant.pto_reason_required && !data.reason?.trim()) {
      throw new ActionError("A reason is required for PTO at this pharmacy.");
    }

    // PTO blacks out each day: remove any shift the person has in the range so
    // the grid and the compliance engine both see them as absent.
    await supabase
      .from("shift")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("staff_id", data.staff_id)
      .gte("date", data.start_date)
      .lte("date", data.end_date);

    const reason = data.reason?.trim() || null;
    const { error } = await supabase.from("pto_day").upsert(
      dates.map((date) => ({
        tenant_id: ctx.tenantId,
        staff_id: data.staff_id,
        date,
        reason,
        created_by: ctx.actingUserId,
      })),
      { onConflict: "tenant_id,staff_id,date" }
    );
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "pto_set", "pto_day", null, {
      staff_id: data.staff_id,
      start_date: data.start_date,
      end_date: data.end_date,
      days: dates.length,
    });
    revalidateScheduleViews();
    return { days: dates.length };
  });
}

const clearSchema = z.object({
  staff_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function clearPtoDay(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = clearSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase
      .from("pto_day")
      .delete()
      .eq("tenant_id", ctx.tenantId)
      .eq("staff_id", data.staff_id)
      .eq("date", data.date);
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "pto_clear", "pto_day", null, {
      staff_id: data.staff_id,
      date: data.date,
    });
    revalidateScheduleViews();
    return undefined;
  });
}

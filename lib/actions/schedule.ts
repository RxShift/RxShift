"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPeriodStart,
  nextPeriodStart,
  periodEnd,
  addDaysStr,
} from "@/lib/dates";
import { buildComplianceRecords, loadPeriodBundle } from "@/lib/schedule-data";
import { deficiencyStreaks } from "@/lib/engine/compliance";
import { sendNotificationEmail } from "@/lib/email";
import {
  ActionError,
  logActivity,
  requireManager,
  runAction,
  type ActionResult,
} from "./helpers";

// ─── Periods ─────────────────────────────────────────────────────────────────

export async function createNextPeriod(
  locationId: string
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const cycle = ctx.tenant.schedule_cycle;

    const { data: last } = await supabase
      .from("schedule_period")
      .select("*")
      .eq("location_id", locationId)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const start = last
      ? nextPeriodStart(last.end_date)
      : defaultPeriodStart(cycle);
    const end = periodEnd(start, cycle);

    const { data: row, error } = await supabase
      .from("schedule_period")
      .insert({
        tenant_id: ctx.tenantId,
        location_id: locationId,
        cycle,
        start_date: start,
        end_date: end,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "create", "schedule_period", row.id, { start, end });
    revalidatePath("/app/schedule");
    return { id: row.id as string };
  });
}

// ─── Shifts ──────────────────────────────────────────────────────────────────

const segmentSchema = z.object({
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  work_type_id: z.string().uuid().nullish(),
  counts_toward_ratio: z.boolean().nullish(),
});

const shiftSchema = z.object({
  schedule_period_id: z.string().uuid(),
  location_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  ratio_zone_id: z.string().uuid().nullish(),
  department_id: z.string().uuid().nullish(),
  notes: z.string().max(500).nullish(),
  break_minutes: z.coerce.number().int().min(0).max(240).default(0),
  segments: z.array(segmentSchema).min(1).max(8),
});

export async function upsertShift(
  shiftId: string | null,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = shiftSchema.parse(input);
    const supabase = await createClient();

    const { segments, ...shiftFields } = data;
    let id = shiftId;

    if (id) {
      const { error } = await supabase
        .from("shift")
        .update(shiftFields)
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId);
      if (error) throw new ActionError(error.message);
      await supabase.from("shift_segment").delete().eq("shift_id", id);
    } else {
      const { data: row, error } = await supabase
        .from("shift")
        .insert({
          ...shiftFields,
          tenant_id: ctx.tenantId,
          created_by: ctx.userId,
          // New shifts inherit the period's status so edits to a published
          // schedule stay published (and re-validate)
        })
        .select("id")
        .single();
      if (error) throw new ActionError(error.message);
      id = row.id as string;
    }

    const { error: segError } = await supabase.from("shift_segment").insert(
      segments.map((s) => ({
        ...s,
        shift_id: id,
        tenant_id: ctx.tenantId,
      }))
    );
    if (segError) throw new ActionError(segError.message);

    await logActivity(ctx, shiftId ? "update" : "create", "shift", id, {
      staff_id: data.staff_id,
      date: data.date,
    });
    revalidatePath("/app/schedule");
    return { id };
  });
}

export async function deleteShift(shiftId: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const { error } = await supabase
      .from("shift")
      .delete()
      .eq("id", shiftId)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "delete", "shift", shiftId);
    revalidatePath("/app/schedule");
    return undefined;
  });
}

// ─── Copy forward ────────────────────────────────────────────────────────────

export async function copyForward(
  periodId: string
): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();

    const bundle = await loadPeriodBundle(periodId);
    if (!bundle) throw new ActionError("Period not found.");
    if (bundle.shifts.length > 0)
      throw new ActionError(
        "This period already has shifts. Copy forward only fills an empty period."
      );

    const { data: prev } = await supabase
      .from("schedule_period")
      .select("*")
      .eq("location_id", bundle.period.location_id)
      .lt("end_date", bundle.period.start_date)
      .order("end_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prev) throw new ActionError("There's no earlier period to copy from.");

    const prevBundle = await loadPeriodBundle(prev.id);
    if (!prevBundle || prevBundle.shifts.length === 0)
      throw new ActionError("The previous period has no shifts to copy.");

    const dayOffset = Math.round(
      (Date.parse(`${bundle.period.start_date}T00:00:00Z`) -
        Date.parse(`${prev.start_date}T00:00:00Z`)) /
        86400000
    );

    let copied = 0;
    for (const shift of prevBundle.shifts) {
      const newDate = addDaysStr(shift.date, dayOffset);
      if (newDate > bundle.period.end_date) continue;

      const { data: row, error } = await supabase
        .from("shift")
        .insert({
          tenant_id: ctx.tenantId,
          location_id: shift.location_id,
          department_id: shift.department_id,
          ratio_zone_id: shift.ratio_zone_id,
          staff_id: shift.staff_id,
          date: newDate,
          schedule_period_id: periodId,
          status: "draft",
          break_minutes: shift.break_minutes ?? 0,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error || !row) continue;

      await supabase.from("shift_segment").insert(
        shift.segments.map((s) => ({
          shift_id: row.id,
          tenant_id: ctx.tenantId,
          start_time: s.start_time,
          end_time: s.end_time,
          work_type_id: s.work_type_id,
          counts_toward_ratio: s.counts_toward_ratio,
        }))
      );
      copied += 1;
    }

    await logActivity(ctx, "copy_forward", "schedule_period", periodId, {
      from: prev.id,
      copied,
    });
    revalidatePath("/app/schedule");
    return { copied };
  });
}

// ─── Publish (with override logging when flags are acknowledged) ───────────

export async function publishPeriod(
  periodId: string,
  overrideReason: string | null
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();

    const bundle = await loadPeriodBundle(periodId);
    if (!bundle) throw new ActionError("Period not found.");

    // Compliance-affecting warnings require a logged, human-entered reason
    const { validateBundle } = await import("@/lib/schedule-data");
    const validation = validateBundle(bundle, ctx.tenant);
    const flagCount =
      validation.ratioFlags.length + validation.constraintFlags.length;
    if (flagCount > 0) {
      if (!overrideReason || overrideReason.trim().length < 3) {
        throw new ActionError(
          `This schedule has ${flagCount} open flag${flagCount === 1 ? "" : "s"}. Publishing requires a reason, which is logged.`
        );
      }
      await supabase.from("override_log").insert({
        tenant_id: ctx.tenantId,
        actor_user_id: ctx.userId,
        target_type: "shift",
        target_id: periodId,
        warning_type: validation.ratioFlags.length > 0 ? "ratio" : "constraint",
        reason: overrideReason.trim(),
      });
    }

    const { error } = await supabase
      .from("schedule_period")
      .update({
        status: "published",
        published_at: new Date().toISOString(),
        published_by: ctx.userId,
      })
      .eq("id", periodId)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    await supabase
      .from("shift")
      .update({ status: "published" })
      .eq("schedule_period_id", periodId);

    // Snapshot the compliance record at publish (Appendix D retention)
    const records = buildComplianceRecords(bundle, ctx.tenant);
    const streakAlerts: string[] = [];
    for (const { zone, rows } of records) {
      await supabase.from("compliance_snapshot").insert({
        tenant_id: ctx.tenantId,
        schedule_period_id: periodId,
        ratio_zone_id: zone.id,
        rows,
      });
      // 3+ consecutive deficient days: alert the pharmacy's OWN managers.
      // RxShift never contacts any board — whether to report is the
      // pharmacy's decision; this makes sure they know the moment the
      // threshold is crossed.
      const streaks = deficiencyStreaks(rows);
      for (const s of streaks.streaks.filter((x) => x.length >= 3)) {
        streakAlerts.push(
          `${zone.name}: ${s.length} consecutive deficient days starting ${s.start}`
        );
      }
    }

    if (streakAlerts.length > 0) {
      const { data: managers } = await supabase
        .from("app_user")
        .select("supabase_user_id, staff(work_email, login_email)")
        .eq("tenant_id", ctx.tenantId)
        .in("role", ["owner_admin", "scheduler", "supervisor"]);
      const lines = [
        "This published schedule contains 3 or more consecutive deficient days — the threshold at which a board report may be required:",
        ...streakAlerts,
        "Review the compliance record in RxShift. Whether and how to report is your pharmacy's decision — RxShift never contacts the board.",
      ];
      for (const m of managers ?? []) {
        await supabase.from("notification").insert({
          tenant_id: ctx.tenantId,
          user_id: m.supabase_user_id,
          type: "deficiency_streak",
          payload: { period_id: periodId, streaks: streakAlerts },
          channel: "in_app",
        });
        const addr =
          (m.staff as { work_email?: string; login_email?: string } | null)
            ?.work_email ??
          (m.staff as { login_email?: string } | null)?.login_email;
        if (addr) {
          await sendNotificationEmail(
            ctx.tenant,
            addr,
            "Deficiency streak alert — a board report may be required",
            lines
          );
        }
      }
    }

    await logActivity(ctx, "publish", "schedule_period", periodId, {
      flags_overridden: flagCount,
      streak_alerts: streakAlerts.length,
    });
    revalidatePath("/app/schedule");
    revalidatePath("/app/log");
    return undefined;
  });
}

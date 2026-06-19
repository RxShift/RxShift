"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  defaultPeriodStart,
  nextPeriodStart,
  periodEnd,
  addDaysStr,
  mondayOf,
  monthStart,
} from "@/lib/dates";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleCycle, Shift, ShiftSegment } from "@/lib/types";
import { buildComplianceRecords, loadPeriodBundle } from "@/lib/schedule-data";
import { deficiencyStreaks } from "@/lib/engine/compliance";
import { sendNotificationEmail } from "@/lib/email";
import {
  ActionError,
  logActivity,
  requireManager,
  revalidateScheduleViews,
  runAction,
  type ActionResult,
} from "./helpers";

// ─── Periods ─────────────────────────────────────────────────────────────────

/**
 * Find the period covering (location, date), or create the cycle-aligned one.
 * Lets scheduling under the All-Locations matrix "just work" — periods are
 * invisible plumbing; we materialize them on demand when a shift lands in a
 * week that has no period yet.
 */
export async function ensurePeriodForDate(
  supabase: SupabaseClient,
  tenantId: string,
  cycle: ScheduleCycle,
  locationId: string,
  date: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("schedule_period")
    .select("id, status")
    .eq("location_id", locationId)
    .lte("start_date", date)
    .gte("end_date", date)
    .order("status", { ascending: false }) // prefer 'published' over 'draft'
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;

  const start = cycle === "monthly" ? monthStart(date) : mondayOf(date);
  const end = periodEnd(start, cycle);
  const { data: row, error } = await supabase
    .from("schedule_period")
    .insert({
      tenant_id: tenantId,
      location_id: locationId,
      cycle,
      start_date: start,
      end_date: end,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new ActionError(error.message);
  return row.id as string;
}

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
  // Optional: when omitted (All-Locations scheduling), the period covering
  // (location_id, date) is found or created automatically.
  schedule_period_id: z.string().uuid().nullish(),
  location_id: z.string().uuid(),
  staff_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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

    const { segments, schedule_period_id, ...rest } = data;
    // Resolve (or create) the period covering this location + date.
    const periodId =
      schedule_period_id ??
      (await ensurePeriodForDate(
        supabase,
        ctx.tenantId,
        ctx.tenant.schedule_cycle,
        data.location_id,
        data.date
      ));
    const shiftFields = { ...rest, schedule_period_id: periodId };
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
    revalidateScheduleViews();
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
    revalidateScheduleViews();
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
    revalidateScheduleViews();
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
    for (const { location, rows } of records) {
      await supabase.from("compliance_snapshot").insert({
        tenant_id: ctx.tenantId,
        schedule_period_id: periodId,
        location_id: location.id,
        rows,
      });
      // 3+ consecutive deficient days: alert the pharmacy's OWN managers.
      // RxShift never contacts any board — whether to report is the
      // pharmacy's decision; this makes sure they know the moment the
      // threshold is crossed.
      const streaks = deficiencyStreaks(rows);
      for (const s of streaks.streaks.filter((x) => x.length >= 3)) {
        streakAlerts.push(
          `${location.name}: ${s.length} consecutive deficient days starting ${s.start}`
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
    revalidateScheduleViews();
    return undefined;
  });
}

// ─── Window-level operations (the All-Locations toolbar) ─────────────────────

/** Publish every draft period overlapping a window — all locations, or one. */
export async function publishWindow(
  viewStart: string,
  viewEnd: string,
  locationId: string | null,
  overrideReason: string | null
): Promise<ActionResult<{ published: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    let q = supabase
      .from("schedule_period")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "draft")
      .lte("start_date", viewEnd)
      .gte("end_date", viewStart);
    if (locationId) q = q.eq("location_id", locationId);
    const { data: drafts } = await q;
    if (!drafts || drafts.length === 0)
      throw new ActionError(
        "Nothing to publish — there's no draft schedule in this window."
      );
    let published = 0;
    for (const p of drafts) {
      // Reuse the per-period publish (flag/override + compliance snapshot).
      const result = await publishPeriod(p.id as string, overrideReason);
      if (!result.ok) throw new ActionError(result.error);
      published += 1;
    }
    return { published };
  });
}

/** Copy the previous window's shifts into the current one (per location). */
export async function copyForwardWindow(
  viewStart: string,
  viewEnd: string,
  locationId: string | null
): Promise<ActionResult<{ copied: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const len =
      Math.round(
        (Date.parse(`${viewEnd}T00:00:00Z`) -
          Date.parse(`${viewStart}T00:00:00Z`)) /
          86400000
      ) + 1;
    const priorStart = addDaysStr(viewStart, -len);
    const priorEnd = addDaysStr(viewStart, -1);

    let pq = supabase
      .from("shift")
      .select("*")
      .gte("date", priorStart)
      .lte("date", priorEnd);
    if (locationId) pq = pq.eq("location_id", locationId);
    const { data: prior } = await pq;
    const priorShifts = (prior ?? []) as Shift[];
    if (priorShifts.length === 0)
      throw new ActionError("No shifts in the previous window to copy.");

    let tq = supabase
      .from("shift")
      .select("staff_id, location_id, date")
      .gte("date", viewStart)
      .lte("date", viewEnd);
    if (locationId) tq = tq.eq("location_id", locationId);
    const { data: existing } = await tq;
    const taken = new Set(
      (existing ?? []).map(
        (s) => `${s.staff_id}|${s.location_id}|${s.date}`
      )
    );

    const { data: segs } = await supabase
      .from("shift_segment")
      .select("*")
      .in(
        "shift_id",
        priorShifts.map((s) => s.id)
      );
    const segByShift = new Map<string, ShiftSegment[]>();
    for (const sg of (segs ?? []) as ShiftSegment[]) {
      const list = segByShift.get(sg.shift_id) ?? [];
      list.push(sg);
      segByShift.set(sg.shift_id, list);
    }

    const periodCache = new Map<string, string>();
    let copied = 0;
    for (const sh of priorShifts) {
      const newDate = addDaysStr(sh.date, len);
      if (newDate > viewEnd) continue;
      const cellKey = `${sh.staff_id}|${sh.location_id}|${newDate}`;
      if (taken.has(cellKey)) continue;
      const pcKey = `${sh.location_id}|${newDate}`;
      let periodId = periodCache.get(pcKey);
      if (!periodId) {
        periodId = await ensurePeriodForDate(
          supabase,
          ctx.tenantId,
          ctx.tenant.schedule_cycle,
          sh.location_id,
          newDate
        );
        periodCache.set(pcKey, periodId);
      }
      const { data: row, error } = await supabase
        .from("shift")
        .insert({
          tenant_id: ctx.tenantId,
          location_id: sh.location_id,
          department_id: sh.department_id,
          staff_id: sh.staff_id,
          date: newDate,
          schedule_period_id: periodId,
          status: "draft",
          break_minutes: sh.break_minutes ?? 0,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error || !row) continue;
      const shiftSegs = segByShift.get(sh.id) ?? [];
      if (shiftSegs.length) {
        await supabase.from("shift_segment").insert(
          shiftSegs.map((s) => ({
            shift_id: row.id,
            tenant_id: ctx.tenantId,
            start_time: s.start_time,
            end_time: s.end_time,
            work_type_id: s.work_type_id,
            counts_toward_ratio: s.counts_toward_ratio,
          }))
        );
      }
      taken.add(cellKey);
      copied += 1;
    }
    await logActivity(ctx, "copy_forward_window", "schedule", null, {
      viewStart,
      viewEnd,
      copied,
    });
    revalidateScheduleViews();
    return { copied };
  });
}

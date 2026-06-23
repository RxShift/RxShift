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
import {
  buildComplianceRecords,
  fetchAllRows,
  loadAllLocationsBundle,
  loadPeriodBundle,
  validateRangeBundle,
} from "@/lib/schedule-data";
import { deficiencyStreaks, SUSTAINED_DEFICIENCY_DAYS } from "@/lib/engine/compliance";
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
): Promise<ActionResult<{ flagsOverridden: number }>> {
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
        actor_user_id: ctx.actingUserId,
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
      // A sustained run of deficient days: alert the pharmacy's OWN managers.
      // RxShift never contacts any board — whether to report anything is the
      // pharmacy's decision; this just makes sure managers see it early.
      const streaks = deficiencyStreaks(rows);
      for (const s of streaks.streaks.filter(
        (x) => x.length >= SUSTAINED_DEFICIENCY_DAYS
      )) {
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
        `This published schedule contains ${SUSTAINED_DEFICIENCY_DAYS} or more consecutive deficient days — a sustained deficiency your managers should review:`,
        ...streakAlerts,
        "Review the Compliance Record in RxShift. Whether and how to act on this is your pharmacy's decision — RxShift never contacts any board.",
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
            "Sustained deficiency alert — please review the Compliance Record",
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
    return { flagsOverridden: flagCount };
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

    // Gate on the SAME validation the user saw (window-wide, all locations) —
    // never trust a client-supplied flag count. Per-period publish alone can
    // miss window-only flags (a cross-location double-booking, or an hour cap
    // that only trips across the window), which is how a flagged schedule could
    // publish with no reason. Re-validate the window here so the reason
    // requirement always matches the flags shown in the publish dialog.
    const windowBundle = await loadAllLocationsBundle(viewStart, viewEnd);
    const windowValidation = validateRangeBundle(windowBundle, ctx.tenant);
    const windowFlagCount =
      windowValidation.ratioFlags.length +
      windowValidation.constraintFlags.length;
    if (
      windowFlagCount > 0 &&
      (!overrideReason || overrideReason.trim().length < 3)
    ) {
      throw new ActionError(
        `This schedule has ${windowFlagCount} open flag${windowFlagCount === 1 ? "" : "s"}. Publishing requires a reason, which is logged.`
      );
    }

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
    let flagsLogged = 0;
    for (const p of drafts) {
      // Reuse the per-period publish (flag/override + compliance snapshot).
      const result = await publishPeriod(p.id as string, overrideReason);
      if (!result.ok) throw new ActionError(result.error);
      flagsLogged += result.data?.flagsOverridden ?? 0;
      published += 1;
    }

    // If the window had flags but no single period reproduced them (e.g. a
    // cross-location double-booking), publishPeriod logged nothing — record the
    // acknowledged reason once here so the override log never loses it.
    if (windowFlagCount > 0 && flagsLogged === 0 && overrideReason) {
      await supabase.from("override_log").insert({
        tenant_id: ctx.tenantId,
        actor_user_id: ctx.actingUserId,
        target_type: "shift",
        target_id: drafts[0].id as string,
        warning_type:
          windowValidation.ratioFlags.length > 0 ? "ratio" : "constraint",
        reason: overrideReason.trim(),
      });
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

    // Paginate: a month-long copy fetches 800+ shifts and even MORE segments.
    // A single query caps at 1000 rows, so the segment fetch below used to
    // silently drop segments for shifts past row 1000 — creating shifts with no
    // segments (the phantom "SMRX" cells). fetchAllRows pages past the cap.
    const priorShifts = await fetchAllRows<Shift>((from, to) => {
      let pq = supabase
        .from("shift")
        .select("*")
        .gte("date", priorStart)
        .lte("date", priorEnd)
        .order("id")
        .range(from, to);
      if (locationId) pq = pq.eq("location_id", locationId);
      return pq;
    });
    if (priorShifts.length === 0)
      throw new ActionError("No shifts in the previous window to copy.");

    const existing = await fetchAllRows<{
      staff_id: string;
      location_id: string;
      date: string;
    }>((from, to) => {
      let tq = supabase
        .from("shift")
        .select("staff_id, location_id, date")
        .gte("date", viewStart)
        .lte("date", viewEnd)
        .order("staff_id")
        .range(from, to);
      if (locationId) tq = tq.eq("location_id", locationId);
      return tq;
    });
    const taken = new Set(
      existing.map((s) => `${s.staff_id}|${s.location_id}|${s.date}`)
    );

    const priorIds = priorShifts.map((s) => s.id);
    const segs = await fetchAllRows<ShiftSegment>((from, to) =>
      supabase
        .from("shift_segment")
        .select("*")
        .in("shift_id", priorIds)
        .order("id")
        .range(from, to)
    );
    const segByShift = new Map<string, ShiftSegment[]>();
    for (const sg of segs) {
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

// ─── Carry one shift forward across days ─────────────────────────────────────

const copyShiftSchema = z.object({
  shiftId: z.string().uuid(),
  targetDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(60),
});

/**
 * Clone one shift (its segments, break, department, location) onto a set of
 * following dates in ONE action — so entering Monday's shift and repeating it
 * through Friday is a single move, not re-entry each day. Skips any target day
 * where the person already has a shift or is out (approved time off OR a pto_day),
 * mirroring the AI create_shifts skip logic.
 */
export async function copyShiftForward(
  input: unknown
): Promise<ActionResult<{ copied: number; skipped: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const { shiftId, targetDates } = copyShiftSchema.parse(input);
    const supabase = await createClient();

    const { data: src } = await supabase
      .from("shift")
      .select("*")
      .eq("id", shiftId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!src) throw new ActionError("Shift not found.");

    const { data: srcSegs } = await supabase
      .from("shift_segment")
      .select("*")
      .eq("shift_id", shiftId);
    const segments = (srcSegs ?? []) as ShiftSegment[];

    const dates = [...new Set(targetDates)]
      .filter((d) => d !== src.date)
      .sort();
    if (dates.length === 0) throw new ActionError("No days to copy to.");
    const minD = dates[0];
    const maxD = dates[dates.length - 1];

    // Which of those days is the person already busy or off?
    const [{ data: existing }, { data: tor }, { data: pto }] =
      await Promise.all([
        supabase
          .from("shift")
          .select("date")
          .eq("tenant_id", ctx.tenantId)
          .eq("staff_id", src.staff_id)
          .gte("date", minD)
          .lte("date", maxD),
        supabase
          .from("time_off_request")
          .select("start_date, end_date")
          .eq("tenant_id", ctx.tenantId)
          .eq("staff_id", src.staff_id)
          .eq("status", "approved")
          .lte("start_date", maxD)
          .gte("end_date", minD),
        supabase
          .from("pto_day")
          .select("date")
          .eq("tenant_id", ctx.tenantId)
          .eq("staff_id", src.staff_id)
          .gte("date", minD)
          .lte("date", maxD),
      ]);
    const hasShift = new Set((existing ?? []).map((s) => s.date as string));
    const ptoDates = new Set((pto ?? []).map((p) => p.date as string));
    const torRanges = (tor ?? []) as { start_date: string; end_date: string }[];
    const isOut = (d: string) =>
      ptoDates.has(d) ||
      torRanges.some((t) => t.start_date <= d && d <= t.end_date);

    const periodCache = new Map<string, string>();
    let copied = 0;
    let skipped = 0;
    for (const d of dates) {
      if (hasShift.has(d) || isOut(d)) {
        skipped += 1;
        continue;
      }
      let periodId = periodCache.get(d);
      if (!periodId) {
        periodId = await ensurePeriodForDate(
          supabase,
          ctx.tenantId,
          ctx.tenant.schedule_cycle,
          src.location_id,
          d
        );
        periodCache.set(d, periodId);
      }
      const { data: row, error } = await supabase
        .from("shift")
        .insert({
          tenant_id: ctx.tenantId,
          location_id: src.location_id,
          department_id: src.department_id,
          staff_id: src.staff_id,
          date: d,
          schedule_period_id: periodId,
          status: "draft",
          break_minutes: src.break_minutes ?? 0,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error || !row) {
        skipped += 1;
        continue;
      }
      if (segments.length) {
        await supabase.from("shift_segment").insert(
          segments.map((s) => ({
            shift_id: row.id,
            tenant_id: ctx.tenantId,
            start_time: s.start_time,
            end_time: s.end_time,
            work_type_id: s.work_type_id,
            counts_toward_ratio: s.counts_toward_ratio,
          }))
        );
      }
      copied += 1;
    }

    await logActivity(ctx, "copy_shift_forward", "shift", shiftId, {
      copied,
      skipped,
    });
    revalidateScheduleViews();
    return { copied, skipped };
  });
}

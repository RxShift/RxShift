"use server";

// Server glue for the propose-and-accept flow. The resolver (lib/scheduling-rules.ts)
// is pure; this loads the data it needs, enriches results with names for the UI,
// applies accepted proposals as real shifts (same insert path as Ask AI's
// create_shifts), and logs dismissed warnings to the override log. Rules never
// auto-commit — every shift here is created only because a human clicked Accept.

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  loadAllLocationsBundle,
} from "@/lib/schedule-data";
import { eachDate, monthStart, periodEnd } from "@/lib/dates";
import { timeToMinutes } from "@/lib/engine/ratio";
import {
  resolveScheduleRules,
  type ExistingShift,
  type RuleProposal,
} from "@/lib/scheduling-rules";
import { ensurePeriodForDate } from "./schedule";
import type { StaffSchedulingRule } from "@/lib/types";
import {
  ActionError,
  logActivity,
  requireManager,
  revalidateScheduleViews,
  runAction,
  type ActionResult,
} from "./helpers";

export interface ProposalDTO extends RuleProposal {
  staff_name: string;
  work_type_name: string | null;
  location_name: string | null;
}
export interface UnmetDTO {
  rule_id: string;
  staff_id: string;
  staff_name: string;
  rule_type: string;
  message: string;
}

/**
 * Resolve scheduling-rule proposals + unmet warnings for a window. Optionally
 * scoped to one staff member (the slide-over) and/or one location (the builder's
 * current location filter). Quotas are counted across the whole month(s) the
 * window touches, so a one-week view doesn't over-report monthly gaps.
 */
export async function resolveProposals(input: {
  windowStart: string;
  windowEnd: string;
  staffId?: string | null;
  locationFilter?: string | null;
}): Promise<ActionResult<{ proposals: ProposalDTO[]; unmet: UnmetDTO[] }>> {
  return runAction(async () => {
    await requireManager();
    const { windowStart, windowEnd, staffId, locationFilter } = input;

    // Expand to whole months for accurate quota counting; propose only in-window.
    const dataStart = monthStart(windowStart);
    const dataEnd = periodEnd(monthStart(windowEnd), "monthly");
    const bundle = await loadAllLocationsBundle(dataStart, dataEnd);

    const supabase = await createClient();
    let q = supabase
      .from("staff_scheduling_rule")
      .select("*")
      .eq("is_active", true);
    if (staffId) q = q.eq("staff_id", staffId);
    const { data: ruleRows, error } = await q;
    if (error) throw new ActionError(error.message);
    const rules = (ruleRows ?? []) as StaffSchedulingRule[];
    if (rules.length === 0) return { proposals: [], unmet: [] };

    const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
    const workTypeById = new Map(bundle.workTypes.map((w) => [w.id, w]));
    const locationById = new Map(bundle.locations.map((l) => [l.id, l]));

    const existingShifts: ExistingShift[] = bundle.shifts.map((s) => ({
      staff_id: s.staff_id,
      date: s.date,
      work_type_ids: (s.segments ?? [])
        .map((g) => g.work_type_id)
        .filter((x): x is string => !!x),
    }));

    const offCells = new Set<string>();
    for (const p of bundle.ptoDays) offCells.add(`${p.staff_id}|${p.date}`);
    for (const t of bundle.approvedTimeOff)
      for (const d of eachDate(t.start_date, t.end_date))
        offCells.add(`${t.staff_id}|${d}`);

    const staffHomeLocation = new Map(
      bundle.staff.map((s) => [s.id, s.home_location_id])
    );

    const { proposals, unmet } = resolveScheduleRules({
      windowStart,
      windowEnd,
      rules,
      existingShifts,
      offCells,
      staffHomeLocation,
      workTypeName: (id) => workTypeById.get(id)?.name,
    });

    const inLoc = (locId: string | null) =>
      !locationFilter || locId === locationFilter;

    const proposalDTOs: ProposalDTO[] = proposals
      .filter((p) => inLoc(p.location_id))
      .map((p) => ({
        ...p,
        staff_name: staffById.get(p.staff_id)?.full_name ?? "?",
        work_type_name: p.work_type_id
          ? (workTypeById.get(p.work_type_id)?.name ?? null)
          : null,
        location_name: p.location_id
          ? (locationById.get(p.location_id)?.name ?? null)
          : null,
      }));

    const unmetDTOs: UnmetDTO[] = unmet.map((u) => ({
      ...u,
      staff_name: staffById.get(u.staff_id)?.full_name ?? "?",
    }));

    return { proposals: proposalDTOs, unmet: unmetDTOs };
  });
}

const applySchema = z.object({
  proposals: z
    .array(
      z.object({
        staff_id: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
        end_time: z.string().regex(/^\d{2}:\d{2}$/),
        work_type_id: z.string().uuid().nullable(),
        location_id: z.string().uuid(),
      })
    )
    .min(1),
});

/**
 * Apply accepted proposals as real shifts. Each becomes a shift + one segment in
 * its location's covering period (auto-created cycle-aligned if none exists, like
 * the rest of the builder). A proposal with no location is skipped (reported).
 */
export async function applyRuleProposals(
  input: unknown
): Promise<ActionResult<{ created: number; skipped: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const { proposals } = applySchema.parse(input);
    const supabase = await createClient();

    // Cache period id + status per (location, date-resolved period).
    const periodStatusById = new Map<string, string>();
    let created = 0;

    for (const p of proposals) {
      const periodId = await ensurePeriodForDate(
        supabase,
        ctx.tenantId,
        ctx.tenant.schedule_cycle,
        p.location_id,
        p.date,
        ctx.tenant.week_start_day
      );
      let status = periodStatusById.get(periodId);
      if (!status) {
        const { data: per } = await supabase
          .from("schedule_period")
          .select("status")
          .eq("id", periodId)
          .single();
        status = (per?.status as string) ?? "draft";
        periodStatusById.set(periodId, status);
      }

      const spanMin = timeToMinutes(p.end_time) - timeToMinutes(p.start_time);
      const breakMin =
        spanMin >= 360 ? (ctx.tenant.default_break_minutes ?? 30) : 0;

      const { data: row, error } = await supabase
        .from("shift")
        .insert({
          tenant_id: ctx.tenantId,
          location_id: p.location_id,
          staff_id: p.staff_id,
          date: p.date,
          schedule_period_id: periodId,
          status,
          break_minutes: breakMin,
          created_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) throw new ActionError(error.message);

      const { error: segErr } = await supabase.from("shift_segment").insert({
        shift_id: row.id,
        tenant_id: ctx.tenantId,
        start_time: p.start_time,
        end_time: p.end_time,
        work_type_id: p.work_type_id,
        counts_toward_ratio: null,
      });
      if (segErr) throw new ActionError(segErr.message);
      created += 1;
    }

    await logActivity(ctx, "rules_apply", "schedule_period", null, {
      created,
    });
    revalidateScheduleViews();
    return { created, skipped: 0 };
  });
}

/** Log a dismissed unmet-rule warning to the override log (auditor-visible),
 *  the same channel as ratio/constraint overrides. */
export async function dismissRuleWarning(
  ruleId: string,
  reason: string
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    if (!reason.trim()) throw new ActionError("A reason is required.");
    const supabase = await createClient();
    const { error } = await supabase.from("override_log").insert({
      tenant_id: ctx.tenantId,
      actor_user_id: ctx.actingUserId,
      target_type: "rule",
      target_id: ruleId,
      warning_type: "rule",
      reason: reason.trim(),
    });
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "dismiss_rule", "staff_scheduling_rule", ruleId, {
      reason: reason.trim(),
    });
    return undefined;
  });
}

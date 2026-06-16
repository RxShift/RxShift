"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendNotificationEmail } from "@/lib/email";
import { loadPeriodBundle, toEngineSegments } from "@/lib/schedule-data";
import { evaluateZone } from "@/lib/engine/ratio";
import {
  ActionError,
  logActivity,
  requireManager,
  requireMember,
  runAction,
  type ActionResult,
  type AuthedContext,
} from "./helpers";

// ─── Shared helpers ──────────────────────────────────────────────────────────

async function notify(
  ctx: AuthedContext,
  userIds: string[],
  type: string,
  payload: Record<string, unknown>
) {
  if (userIds.length === 0) return;
  const supabase = await createClient();
  await supabase.from("notification").insert(
    userIds.map((user_id) => ({
      tenant_id: ctx.tenantId,
      user_id,
      type,
      payload,
      channel: "in_app",
    }))
  );
}

// Email safety (kill switch + allowlist + trial/live lifecycle) is enforced
// INSIDE sendNotificationEmail — these helpers just resolve addresses.

/** Emails for every PTO approver / manager in the tenant. */
async function approverEmails(ctx: AuthedContext): Promise<string[]> {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("app_user")
    .select("*, staff(work_email, login_email)")
    .eq("tenant_id", ctx.tenantId);
  return (users ?? [])
    .filter(
      (u) =>
        u.is_pto_approver ||
        ["owner_admin", "scheduler", "supervisor"].includes(u.role)
    )
    .map(
      (u) =>
        (u.staff as { work_email?: string; login_email?: string } | null)
          ?.work_email ??
        (u.staff as { login_email?: string } | null)?.login_email
    )
    .filter((e): e is string => !!e);
}

async function staffEmail(
  ctx: AuthedContext,
  staffId: string
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("work_email, login_email")
    .eq("id", staffId)
    .maybeSingle();
  return data?.work_email ?? data?.login_email ?? null;
}

async function staffName(staffId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("full_name")
    .eq("id", staffId)
    .maybeSingle();
  return data?.full_name ?? "A team member";
}

/** Deficient-slot delta for a zone/date if one person's shift goes away. */
async function calloutGap(
  ctx: AuthedContext,
  shiftId: string
): Promise<Record<string, unknown> | null> {
  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("shift")
    .select("*")
    .eq("id", shiftId)
    .maybeSingle();
  if (!shift || !shift.location_id || !ctx.tenant.has_ratio) return null;

  const bundle = await loadPeriodBundle(shift.schedule_period_id);
  if (!bundle?.ratioRule) return null;

  const rule = {
    max_techs_per_pharmacist: bundle.ratioRule.max_techs_per_pharmacist,
  };
  const all = toEngineSegments(bundle).filter(
    (s) => s.location_id === shift.location_id && s.date === shift.date
  );
  const without = all.filter((s) => s.shift_id !== shiftId);

  const count = (segs: typeof all) => {
    const evals = evaluateZone(segs, rule, ctx.tenant.ratio_slot_minutes);
    let deficient = 0;
    for (const [, slots] of evals)
      deficient += slots.filter((s) => s.status === "deficient").length;
    return deficient;
  };

  const before = count(all);
  const after = count(without);
  return {
    date: shift.date,
    deficient_slots_before: before,
    deficient_slots_after: after,
    deficient_slots_added: Math.max(0, after - before),
  };
}

// ─── Time off ────────────────────────────────────────────────────────────────

const timeOffSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.string().min(1).max(40),
  staff_message: z.string().max(1000).nullish(),
});

export async function submitTimeOff(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    if (!ctx.appUser.staff_id)
      throw new ActionError(
        "Your sign-in isn't linked to a staff record yet. Ask your admin."
      );
    const data = timeOffSchema.parse(input);
    if (data.end_date < data.start_date)
      throw new ActionError("End date is before the start date.");

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("time_off_request")
      .insert({
        ...data,
        tenant_id: ctx.tenantId,
        staff_id: ctx.appUser.staff_id,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);

    const name = await staffName(ctx.appUser.staff_id);
    for (const email of await approverEmails(ctx)) {
      await sendNotificationEmail(ctx.tenant, email, `Time-off request from ${name}`, [
        `${name} requested time off: ${data.start_date} to ${data.end_date} (${data.type}).`,
        data.staff_message ? `Their note: "${data.staff_message}"` : "",
        "Review it in RxShift under Requests.",
      ].filter(Boolean));
    }

    await logActivity(ctx, "create", "time_off_request", row.id, data);
    revalidatePath("/app/requests");
    return undefined;
  });
}

export async function decideTimeOff(
  id: string,
  decision: "approved" | "denied"
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();

    const { data: request } = await supabase
      .from("time_off_request")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!request) throw new ActionError("Request not found.");
    if (request.status !== "pending")
      throw new ActionError("This request was already decided.");

    const { error } = await supabase
      .from("time_off_request")
      .update({
        status: decision,
        approver_id: ctx.userId,
        decided_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new ActionError(error.message);

    // Approving executes the request: clear any shifts the person had in the
    // approved window so they actually come off the schedule (the manager sees
    // the gap and backfills). PTO then overlays those days.
    if (decision === "approved") {
      await supabase
        .from("shift")
        .delete()
        .eq("tenant_id", ctx.tenantId)
        .eq("staff_id", request.staff_id)
        .gte("date", request.start_date)
        .lte("date", request.end_date);
    }

    const email = await staffEmail(ctx, request.staff_id);
    if (email) {
      await sendNotificationEmail(
        ctx.tenant,
        email,
        `Your time-off request was ${decision}`,
        [
          `Your request for ${request.start_date} to ${request.end_date} was ${decision}.`,
          decision === "approved"
            ? "It now overlays the schedule so you won't be scheduled those days."
            : "Talk to your manager if you'd like to discuss it.",
        ]
      );
    }

    // In-app notification for the requester (if they have a sign-in)
    const { data: requesterUser } = await supabase
      .from("app_user")
      .select("supabase_user_id")
      .eq("staff_id", request.staff_id)
      .maybeSingle();
    if (requesterUser) {
      await notify(ctx, [requesterUser.supabase_user_id], "time_off_decided", {
        id,
        decision,
        start_date: request.start_date,
        end_date: request.end_date,
      });
    }

    await logActivity(ctx, decision, "time_off_request", id);
    revalidatePath("/app/requests");
    revalidatePath("/app/schedule");
    return undefined;
  });
}

// ─── Callouts ────────────────────────────────────────────────────────────────

const calloutSchema = z.object({
  staff_id: z.string().uuid().nullish(), // managers may log for others
  shift_id: z.string().uuid().nullish(),
  reason: z.string().max(500).nullish(),
});

export async function logCallout(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    const data = calloutSchema.parse(input);

    const isManager = ["owner_admin", "scheduler", "supervisor"].includes(
      ctx.appUser.role
    );
    const staffId = isManager && data.staff_id ? data.staff_id : ctx.appUser.staff_id;
    if (!staffId)
      throw new ActionError("Your sign-in isn't linked to a staff record yet.");

    const gap = data.shift_id ? await calloutGap(ctx, data.shift_id) : null;

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("callout")
      .insert({
        tenant_id: ctx.tenantId,
        staff_id: staffId,
        shift_id: data.shift_id ?? null,
        reason: data.reason ?? null,
        resulting_gap: gap,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);

    const name = await staffName(staffId);
    const gapLine =
      gap && Number(gap.deficient_slots_added) > 0
        ? `This adds ${gap.deficient_slots_added} deficient ratio slot(s) on ${gap.date}.`
        : "No new ratio deficiency results from this callout.";
    for (const email of await approverEmails(ctx)) {
      await sendNotificationEmail(ctx.tenant, email, `Callout: ${name}`, [
        `${name} called out${data.reason ? `: "${data.reason}"` : "."}`,
        ctx.tenant.has_ratio ? gapLine : "",
        "The shift and any resulting gap are documented in RxShift.",
      ].filter(Boolean));
    }

    await logActivity(ctx, "create", "callout", row.id, { staff_id: staffId });
    revalidatePath("/app/requests");
    return undefined;
  });
}

// ─── Swaps ───────────────────────────────────────────────────────────────────

const swapSchema = z.object({
  shift_a_id: z.string().uuid(),
  counter_staff_id: z.string().uuid(),
  shift_b_id: z.string().uuid().nullish(),
});

export async function proposeSwap(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    if (!ctx.appUser.staff_id)
      throw new ActionError("Your sign-in isn't linked to a staff record yet.");
    const data = swapSchema.parse(input);

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("swap_request")
      .insert({
        tenant_id: ctx.tenantId,
        requesting_staff_id: ctx.appUser.staff_id,
        counter_staff_id: data.counter_staff_id,
        shift_a_id: data.shift_a_id,
        shift_b_id: data.shift_b_id ?? null,
        status: "pending_peer",
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);

    const requester = await staffName(ctx.appUser.staff_id);
    const email = await staffEmail(ctx, data.counter_staff_id);
    if (email) {
      await sendNotificationEmail(ctx.tenant, email, `${requester} proposed a shift swap`, [
        `${requester} proposed a shift swap with you.`,
        "Open RxShift → Requests to accept or decline. A manager approves the final swap.",
      ]);
    }

    await logActivity(ctx, "create", "swap_request", row.id);
    revalidatePath("/app/requests");
    return undefined;
  });
}

export async function respondToSwap(
  id: string,
  accept: boolean
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    const supabase = await createClient();
    const { data: swap } = await supabase
      .from("swap_request")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!swap || swap.status !== "pending_peer")
      throw new ActionError("This swap isn't awaiting your response.");
    if (swap.counter_staff_id !== ctx.appUser.staff_id)
      throw new ActionError("This swap isn't addressed to you.");

    const { error } = await supabase
      .from("swap_request")
      .update(
        accept
          ? { status: "pending_manager", peer_accepted_at: new Date().toISOString() }
          : { status: "denied" }
      )
      .eq("id", id);
    if (error) throw new ActionError(error.message);

    if (accept) {
      const requester = await staffName(swap.requesting_staff_id);
      const counter = await staffName(swap.counter_staff_id);
      for (const email of await approverEmails(ctx)) {
        await sendNotificationEmail(ctx.tenant, email, "Shift swap awaiting approval", [
          `${requester} and ${counter} agreed on a shift swap.`,
          "Review the ratio and hours effect in RxShift → Requests, then approve or deny.",
        ]);
      }
    }

    await logActivity(ctx, accept ? "peer_accept" : "peer_decline", "swap_request", id);
    revalidatePath("/app/requests");
    return undefined;
  });
}

export async function decideSwap(
  id: string,
  decision: "approved" | "denied"
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const { data: swap } = await supabase
      .from("swap_request")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!swap || swap.status !== "pending_manager")
      throw new ActionError("This swap isn't awaiting manager approval.");

    if (decision === "approved") {
      // Execute: reassign shift A to the counter staff; B (if any) to requester
      const { error: errA } = await supabase
        .from("shift")
        .update({ staff_id: swap.counter_staff_id })
        .eq("id", swap.shift_a_id);
      if (errA) throw new ActionError(errA.message);
      if (swap.shift_b_id) {
        const { error: errB } = await supabase
          .from("shift")
          .update({ staff_id: swap.requesting_staff_id })
          .eq("id", swap.shift_b_id);
        if (errB) throw new ActionError(errB.message);
      }
    }

    const { error } = await supabase
      .from("swap_request")
      .update({ status: decision, manager_id: ctx.userId })
      .eq("id", id);
    if (error) throw new ActionError(error.message);

    for (const staffId of [swap.requesting_staff_id, swap.counter_staff_id]) {
      const email = await staffEmail(ctx, staffId);
      if (email) {
        await sendNotificationEmail(ctx.tenant, email, `Shift swap ${decision}`, [
          `The proposed shift swap was ${decision} by a manager.`,
          decision === "approved"
            ? "The schedule has been updated — check My Schedule."
            : "The schedule is unchanged.",
        ]);
      }
    }

    await logActivity(ctx, decision, "swap_request", id);
    revalidatePath("/app/requests");
    revalidatePath("/app/schedule");
    return undefined;
  });
}

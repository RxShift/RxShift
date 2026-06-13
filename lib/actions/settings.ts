"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  ActionError,
  logActivity,
  requireAdmin,
  requireManager,
  runAction,
  type ActionResult,
} from "./helpers";

// ─── Organization ────────────────────────────────────────────────────────────

const tenantSchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().min(1),
  schedule_cycle: z.enum(["weekly", "biweekly", "monthly"]),
  ratio_slot_minutes: z.coerce.number().pipe(z.union([z.literal(15), z.literal(30), z.literal(60)])),
  has_ratio: z.coerce.boolean(),
  default_break_minutes: z.coerce.number().int().min(0).max(240).default(30),
});

export async function updateTenant(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = tenantSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("tenant")
      .update(data)
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "update", "tenant", ctx.tenantId, data);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/**
 * Trial → live: the deliberate, owner-only switch that turns on email to
 * the whole roster. Clears the allowlist (it would otherwise keep
 * restricting a live tenant) and enables outbound email.
 */
export async function goLiveTenant(): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    if (ctx.tenant.status === "live")
      throw new ActionError("This pharmacy is already live.");
    const supabase = await createClient();

    const { count: locationCount } = await supabase
      .from("location")
      .select("*", { count: "exact", head: true });

    const { error } = await supabase
      .from("tenant")
      .update({
        status: "live",
        outbound_email_enabled: true,
        email_allowlist: [],
        // Billing scaffold: going live opens a manual subscription record
        // (Stripe later replaces 'manual' with a real provider + webhooks)
        billing_status: "active",
        billing_provider: ctx.tenant.billing_provider ?? "manual",
        billed_locations:
          ctx.tenant.billed_locations ?? Math.max(1, locationCount ?? 1),
        billing_interval: ctx.tenant.billing_interval ?? "monthly",
        billing_started_at:
          ctx.tenant.billing_started_at ?? new Date().toISOString(),
      })
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "go_live", "tenant", ctx.tenantId, {
      previous_status: ctx.tenant.status,
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

// ─── Generic CRUD for simple settings entities ──────────────────────────────

type EntityName =
  | "location"
  | "department"
  | "ratio_zone"
  | "work_type"
  | "constraint_rule";

const SCHEMAS: Record<EntityName, z.ZodType> = {
  location: z.object({
    name: z.string().min(1).max(120),
    address: z.string().max(300).nullish(),
    operating_hours: z.record(z.string(), z.union([z.object({ open: z.string(), close: z.string() }), z.null()])).nullish(),
  }),
  department: z.object({
    name: z.string().min(1).max(120),
    location_id: z.string().uuid(),
  }),
  ratio_zone: z.object({
    name: z.string().min(1).max(120),
    location_id: z.string().uuid(),
    ratio_isolated: z.coerce.boolean(),
    ratio_rule_id: z.string().uuid().nullish(),
  }),
  work_type: z.object({
    name: z.string().min(1).max(120),
    counts_as: z.enum(["pharmacist", "technician", "none"]),
    counting_default: z.coerce.boolean(),
    is_specialized: z.coerce.boolean(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/)
      .nullish(),
  }),
  constraint_rule: z.object({
    scope_type: z.enum(["staff", "role"]),
    scope_id: z.string().min(1),
    rule_type: z.enum([
      "hour_cap",
      "overtime",
      "unavailable_window",
      "hard_stop",
      "recurring_unavailable",
      "always_off",
      "max_consecutive_days",
    ]),
    params: z.record(z.string(), z.unknown()),
    effective_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    active: z.coerce.boolean(),
  }),
};

export async function createEntity(
  entity: EntityName,
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = SCHEMAS[entity].parse(input) as Record<string, unknown>;
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from(entity)
      .insert({ ...data, tenant_id: ctx.tenantId })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "create", entity, row.id, data);
    revalidatePath("/app", "layout");
    return { id: row.id as string };
  });
}

export async function updateEntity(
  entity: EntityName,
  id: string,
  input: unknown
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = SCHEMAS[entity].parse(input) as Record<string, unknown>;
    const supabase = await createClient();
    const { error } = await supabase
      .from(entity)
      .update(data)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "update", entity, id, data);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function deleteEntity(
  entity: EntityName,
  id: string
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const { error } = await supabase
      .from(entity)
      .delete()
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "delete", entity, id);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

// ─── Tenant ratio rule ───────────────────────────────────────────────────────

const ratioRuleSchema = z.object({
  state: z.string().length(2),
  max_techs_per_pharmacist: z.coerce.number().int().min(1).max(10),
  // 'flat': P × cap. 'additive' (California BPC 4115): first + (P−1) × additional
  formula: z.enum(["flat", "additive"]).default("flat"),
  additive_first_techs: z.coerce.number().int().min(0).max(10).nullish(),
  additive_additional_techs: z.coerce.number().int().min(0).max(10).nullish(),
  notes: z.string().max(2000).nullish(),
});

export async function upsertRatioRule(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = ratioRuleSchema.parse(input);
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("ratio_rule")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    let ruleId: string;
    if (existing) {
      const { error } = await supabase
        .from("ratio_rule")
        .update(data)
        .eq("id", existing.id);
      if (error) throw new ActionError(error.message);
      ruleId = existing.id;
    } else {
      const { data: row, error } = await supabase
        .from("ratio_rule")
        .insert({ ...data, tenant_id: ctx.tenantId })
        .select("id")
        .single();
      if (error) throw new ActionError(error.message);
      ruleId = row.id;
    }

    // Point un-linked zones at the tenant rule
    await supabase
      .from("ratio_zone")
      .update({ ratio_rule_id: ruleId })
      .eq("tenant_id", ctx.tenantId)
      .is("ratio_rule_id", null);

    await logActivity(ctx, "upsert", "ratio_rule", ruleId, data);
    revalidatePath("/app", "layout");
    return undefined;
  });
}

// ─── Team & roles ────────────────────────────────────────────────────────────

const appUserSchema = z.object({
  role: z.enum(["owner_admin", "scheduler", "supervisor", "read_only", "staff"]),
  scheduler_scope: z.array(z.string().uuid()).nullish(),
  is_pto_approver: z.coerce.boolean(),
  pto_approver_rank: z.enum(["primary", "backup"]).nullish(),
});

export async function updateAppUser(
  id: string,
  input: unknown
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const data = appUserSchema.parse(input);
    if (id === ctx.appUser.id && data.role !== "owner_admin") {
      throw new ActionError("You can't remove your own admin role.");
    }
    const supabase = await createClient();
    const { error } = await supabase
      .from("app_user")
      .update(data)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "update", "app_user", id, data);
    revalidatePath("/app/staff");
    return undefined;
  });
}

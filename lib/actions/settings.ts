"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
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
  // Nevada R072-25 (proposed; June 2026 hearing; not yet adopted). When on,
  // retail NV locations use the 4-tech ceiling + 2-trainee sublimit + the
  // solo-pharmacist floor. Off by default — only NAC 639.250 is current law.
  nevada_r072_25: z.coerce.boolean().default(false),
  // When on, a reason is required to save any PTO (request or scheduler-entered).
  pto_reason_required: z.coerce.boolean().default(false),
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

/** Toggle whether every shift must be assigned a department. */
export async function setRequireDepartment(
  value: boolean
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const { error } = await supabase
      .from("tenant")
      .update({ require_department: value })
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "update", "tenant", ctx.tenantId, {
      require_department: value,
    });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

// ─── Branding ─────────────────────────────────────────────────────────────────

const brandingSchema = z.object({
  primary_color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullish(),
  logo_url: z.string().url().max(500).nullish(),
});

/** Owner-only light branding: one accent color + a logo URL. The accent
 *  overrides only --color-amber (buttons/highlights) so a tenant can't make
 *  the UI unreadable, and the RxShift mark always stays in the sidebar. */
export async function updateBranding(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const data = brandingSchema.parse(input);
    const branding: { primary_color?: string; logo_url?: string } = {};
    if (data.primary_color) branding.primary_color = data.primary_color;
    if (data.logo_url) branding.logo_url = data.logo_url;

    const supabase = await createClient();
    const { error } = await supabase
      .from("tenant")
      .update({ branding: Object.keys(branding).length ? branding : null })
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "update", "tenant", ctx.tenantId, { branding });
    revalidatePath("/app", "layout");
    return undefined;
  });
}

/** Upload a tenant logo file (owner-only) → private Storage → long-lived signed
 *  URL saved on branding.logo_url, merged so the accent color is preserved. */
export async function uploadLogo(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const file = formData.get("file");
    if (!(file instanceof Blob)) throw new ActionError("No image provided.");

    const service = createServiceClient();
    const path = `${ctx.tenantId}/logo-${Date.now()}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await service.storage
      .from("avatars")
      .upload(path, buf, {
        contentType: file.type || "image/png",
        upsert: true,
      });
    if (upErr) throw new ActionError(upErr.message);

    const { data: signed, error: sErr } = await service.storage
      .from("avatars")
      .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    if (sErr || !signed)
      throw new ActionError(sErr?.message ?? "Could not sign the logo URL.");

    const { data: t } = await service
      .from("tenant")
      .select("branding")
      .eq("id", ctx.tenantId)
      .maybeSingle();
    const branding = {
      ...((t?.branding as Record<string, unknown>) ?? {}),
      logo_url: signed.signedUrl,
    };
    const { error } = await service
      .from("tenant")
      .update({ branding })
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "update", "tenant", ctx.tenantId, { logo: true });
    revalidatePath("/app", "layout");
    return { url: signed.signedUrl };
  });
}

// ─── Live-board statuses ──────────────────────────────────────────────────────

const liveStatusConfigSchema = z.object({
  statuses: z
    .array(
      z.object({
        status: z.enum([
          "present_counting",
          "on_lunch",
          "off_floor",
          "in_meeting",
          "non_tech_function",
        ]),
        enabled: z.coerce.boolean(),
        label: z.string().max(40).nullish(),
        counts_toward_ratio: z.coerce.boolean(),
      })
    )
    .max(5),
});

/** Save the per-tenant status decorations (show/hide, label, counts). */
export async function updateLiveStatusConfig(
  input: unknown
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const { statuses } = liveStatusConfigSchema.parse(input);
    const supabase = await createClient();

    for (const s of statuses) {
      // "Working" is the default fallback status — keep it shown + counting.
      const locked = s.status === "present_counting";
      const { error } = await supabase.from("live_status_config").upsert(
        {
          tenant_id: ctx.tenantId,
          status: s.status,
          enabled: locked ? true : s.enabled,
          label: s.label?.trim() ? s.label.trim() : null,
          counts_toward_ratio: locked ? true : s.counts_toward_ratio,
        },
        { onConflict: "tenant_id,status" }
      );
      if (error) throw new ActionError(error.message);
    }

    await logActivity(ctx, "update", "live_status_config", ctx.tenantId, {
      count: statuses.length,
    });
    revalidatePath("/app/board");
    revalidatePath("/app/me");
    revalidatePath("/app/settings/statuses");
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
  | "work_type"
  | "constraint_rule";

const SCHEMAS: Record<EntityName, z.ZodType> = {
  location: z.object({
    name: z.string().min(1).max(120),
    address: z.string().max(300).nullish(),
    operating_hours: z.record(z.string(), z.union([z.object({ open: z.string(), close: z.string() }), z.null()])).nullish(),
    // Drives the R072-25 overlay: only retail locations get the 4-tech ceiling
    // + floor; telepharmacy/institutional keep the base cap.
    location_type: z.enum(["retail", "telepharmacy", "institutional"]).default("retail"),
    // A drive-through raises the solo-pharmacist floor to 2 support staff.
    has_drive_through: z.coerce.boolean().default(false),
    // Informational only — collected + displayed on the schedule, never enforced.
    expected_rx_mon: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_tue: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_wed: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_thu: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_fri: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_sat: z.coerce.number().int().min(0).max(100000).nullish(),
    expected_rx_sun: z.coerce.number().int().min(0).max(100000).nullish(),
  }),
  // Departments are tenant-level groupings (compounding, hospice, front counter).
  // They don't affect ratio and aren't tied to a location.
  department: z.object({
    name: z.string().min(1).max(120),
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

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { aiConfigured, aiJson } from "@/lib/ai";
import { WORK_TYPE_SEEDS } from "@/lib/seeds";
import { ActionError, runAction, type ActionResult } from "./helpers";

// ─── AI assist: propose a state ratio rule ──────────────────────────────────
// Seeded states come from the verified ratio_rule library; anything else is
// an AI proposal flagged for verification. The user confirms or edits either
// way — AI never silently decides a ratio (scoping §2.5).

export interface RatioProposal {
  max_techs_per_pharmacist: number;
  notes: string;
  source: "verified_seed" | "ai_proposal";
  citation: string | null;
}

export async function proposeRatioRule(
  state: string
): Promise<ActionResult<RatioProposal>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("Not signed in.");

    const service = createServiceClient();
    const { data: seed } = await service
      .from("ratio_rule")
      .select("*")
      .is("tenant_id", null)
      .eq("state", state)
      .maybeSingle();

    if (seed) {
      return {
        max_techs_per_pharmacist: seed.max_techs_per_pharmacist,
        notes: seed.notes ?? "",
        source: "verified_seed" as const,
        citation: seed.source_citation,
      };
    }

    if (aiConfigured()) {
      const proposal = await aiJson<{
        max_techs_per_pharmacist: number;
        notes: string;
      }>(
        "You are a pharmacy regulation assistant. Respond with JSON: " +
          '{"max_techs_per_pharmacist": <number>, "notes": "<2-3 sentences>"}. ' +
          "Be conservative. If the state has no fixed ratio, use 3 and say the state has no fixed statutory ratio and relies on professional judgment.",
        `What is the pharmacist-to-technician ratio limit for retail pharmacies in the US state with postal code ${state}?`
      );
      if (
        proposal &&
        proposal.max_techs_per_pharmacist >= 1 &&
        proposal.max_techs_per_pharmacist <= 10
      ) {
        return {
          max_techs_per_pharmacist: Math.round(proposal.max_techs_per_pharmacist),
          notes: `AI-proposed — verify against your board of pharmacy's current language before relying on it. ${proposal.notes}`,
          source: "ai_proposal" as const,
          citation: null,
        };
      }
    }

    return {
      max_techs_per_pharmacist: 3,
      notes:
        "Default starting point — verify your state's actual requirement with your board of pharmacy.",
      source: "ai_proposal" as const,
      citation: null,
    };
  });
}

// ─── AI quick-start: interpret a plain-English pharmacy description ─────────

const quickStartSchema = z.object({
  business_name: z.string().max(120).nullish(),
  timezone: z.string().nullish(),
  schedule_cycle: z.enum(["weekly", "biweekly", "monthly"]).nullish(),
  has_ratio: z.boolean().nullish(),
  state: z.string().length(2).nullish(),
  locations: z
    .array(
      z.object({
        name: z.string().max(120),
        address: z.string().max(300).nullish(),
        isolated_rooms: z.array(z.string().max(120)).nullish(),
      })
    )
    .max(25)
    .nullish(),
});

export type QuickStartPrefill = z.infer<typeof quickStartSchema>;

export async function aiQuickStart(
  description: string
): Promise<ActionResult<QuickStartPrefill>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("Not signed in.");
    if (!aiConfigured())
      throw new ActionError("The AI assistant isn't configured.");
    if (description.trim().length < 10)
      throw new ActionError("Tell me a bit more about the pharmacy first.");

    const result = await aiJson<QuickStartPrefill>(
      "You turn a pharmacy owner's plain-English description into scheduling setup config. " +
        "Respond with JSON using only these keys (omit anything not mentioned):\n" +
        '{"business_name": str, "timezone": IANA tz like "America/Los_Angeles" (infer from city/state if stated), ' +
        '"schedule_cycle": "weekly"|"biweekly"|"monthly", "has_ratio": bool (true if they mention a state ratio, tech limits, or a state known for ratios like NV), ' +
        '"state": 2-letter code, "locations": [{"name": str, "address": str|null, "isolated_rooms": ["room name"] for any sterile/IV/compounding rooms mentioned}]}\n' +
        "Be conservative — only include what the description actually supports. Never invent locations.",
      description.trim(),
      600
    );

    const parsed = quickStartSchema.safeParse(result);
    if (!parsed.success)
      throw new ActionError("Couldn't interpret that — try the steps instead.");
    return parsed.data;
  });
}

// ─── Complete onboarding: create the whole tenant in one pass ───────────────

const wizardSchema = z.object({
  business_name: z.string().min(1).max(120),
  timezone: z.string().min(1),
  schedule_cycle: z.enum(["weekly", "biweekly", "monthly"]),
  has_ratio: z.boolean(),
  ratio_slot_minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
  state: z.string().length(2).nullish(),
  max_techs_per_pharmacist: z.number().int().min(1).max(10).nullish(),
  ratio_notes: z.string().max(2000).nullish(),
  locations: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        address: z.string().max(300).nullish(),
        isolated_rooms: z.array(z.string().min(1).max(120)).default([]),
      })
    )
    .min(1)
    .max(25),
  departments: z.array(z.object({ location_index: z.number().int().min(0), name: z.string().min(1).max(120) })).default([]),
  work_types: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        counts_as: z.enum(["pharmacist", "technician", "none"]),
        counting_default: z.boolean(),
        is_specialized: z.boolean(),
      })
    )
    .default([]),
  staff: z
    .array(
      z.object({
        full_name: z.string().min(1).max(160),
        login_email: z.string().email().nullish(),
        work_email: z.string().email().nullish(),
        job_title: z.string().max(120).nullish(),
        ratio_type: z.enum(["pharmacist", "technician", "non_counting"]),
        employment_type: z.enum(["full_time", "part_time", "per_diem", "contractor_1099"]),
      })
    )
    .default([]),
  my_name: z.string().min(1).max(160),
  branding_color: z.string().max(20).nullish(),
  branding_logo_url: z.string().url().nullish().or(z.literal("").transform(() => null)),
});

export async function completeOnboarding(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("Not signed in.");

    const service = createServiceClient();

    // Platform admins can create unlimited tenants; everyone else gets
    // one workspace per sign-in (v1)
    const { data: platformAdmin } = await service
      .from("platform_admin")
      .select("supabase_user_id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();

    const { data: existing } = await service
      .from("app_user")
      .select("id")
      .eq("supabase_user_id", user.id)
      .maybeSingle();
    if (existing && !platformAdmin)
      throw new ActionError("This sign-in already belongs to a workspace.");

    const isExtraAdminTenant = !!(existing && platformAdmin);
    const data = wizardSchema.parse(input);

    // 1. Tenant
    const { data: tenant, error: tenantError } = await service
      .from("tenant")
      .insert({
        name: data.business_name,
        timezone: data.timezone,
        schedule_cycle: data.schedule_cycle,
        ratio_slot_minutes: data.ratio_slot_minutes,
        has_ratio: data.has_ratio,
        branding:
          data.branding_color || data.branding_logo_url
            ? {
                primary_color: data.branding_color || undefined,
                logo_url: data.branding_logo_url || undefined,
              }
            : null,
        onboarding_complete: false,
        // Admin-created test/demo tenants never email anyone until the
        // owner flips the switch deliberately
        outbound_email_enabled: !isExtraAdminTenant,
        status: "setup",
      })
      .select("id")
      .single();
    if (tenantError) throw new ActionError(tenantError.message);
    const tenantId = tenant.id as string;

    // 2. Ratio rule (tenant copy)
    let ratioRuleId: string | null = null;
    if (data.has_ratio && data.state && data.max_techs_per_pharmacist) {
      const { data: rule } = await service
        .from("ratio_rule")
        .insert({
          tenant_id: tenantId,
          state: data.state,
          max_techs_per_pharmacist: data.max_techs_per_pharmacist,
          notes: data.ratio_notes ?? null,
        })
        .select("id")
        .single();
      ratioRuleId = rule?.id ?? null;
    }

    // 3. Locations + zones + departments
    const locationIds: string[] = [];
    for (const loc of data.locations) {
      const { data: row, error } = await service
        .from("location")
        .insert({ tenant_id: tenantId, name: loc.name, address: loc.address ?? null })
        .select("id")
        .single();
      if (error) throw new ActionError(error.message);
      locationIds.push(row.id);

      if (data.has_ratio) {
        await service.from("ratio_zone").insert([
          {
            tenant_id: tenantId,
            location_id: row.id,
            name: data.locations.length > 1 ? `${loc.name} — Main Floor` : "Main Floor",
            ratio_isolated: false,
            ratio_rule_id: ratioRuleId,
          },
          ...loc.isolated_rooms.map((room) => ({
            tenant_id: tenantId,
            location_id: row.id,
            name: room,
            ratio_isolated: true,
            ratio_rule_id: ratioRuleId,
          })),
        ]);
      }
    }

    for (const dept of data.departments) {
      const locId = locationIds[dept.location_index];
      if (!locId) continue;
      await service
        .from("department")
        .insert({ tenant_id: tenantId, location_id: locId, name: dept.name });
    }

    // 4. Work types (chosen seeds or defaults)
    const workTypes = data.work_types.length > 0 ? data.work_types : WORK_TYPE_SEEDS;
    await service
      .from("work_type")
      .insert(workTypes.map((w) => ({ ...w, tenant_id: tenantId })));

    // 5. Staff — for a user's own workspace, ensure they exist as staff.
    // Platform admins creating extra tenants are NOT added as staff (they
    // administer through the platform role, and their real email must not
    // end up on a test tenant's roster).
    const email = user.email?.toLowerCase() ?? null;
    const staffRows = [...data.staff];
    if (!isExtraAdminTenant) {
      const meInList = staffRows.find(
        (s) => s.login_email?.toLowerCase() === email
      );
      if (!meInList) {
        staffRows.unshift({
          full_name: data.my_name,
          login_email: email,
          work_email: email,
          job_title: null,
          ratio_type: "pharmacist",
          employment_type: "full_time",
        });
      }
    }
    let myStaffId: string | null = null;
    if (staffRows.length > 0) {
      const { data: insertedStaff, error: staffError } = await service
        .from("staff")
        .insert(
          staffRows.map((s) => ({
            ...s,
            tenant_id: tenantId,
            home_location_id: locationIds[0] ?? null,
          }))
        )
        .select("id, login_email");
      if (staffError) throw new ActionError(staffError.message);
      myStaffId =
        (insertedStaff ?? []).find(
          (s) => s.login_email?.toLowerCase() === email
        )?.id ?? null;
    }

    // 6. Membership: own workspace → Owner/Admin app_user; extra admin
    // tenant → just point the platform admin's active tenant at it
    if (isExtraAdminTenant) {
      await service
        .from("platform_admin")
        .update({ active_tenant_id: tenantId, emulate_app_user_id: null })
        .eq("supabase_user_id", user.id);
    } else {
      const { error: userError } = await service.from("app_user").insert({
        supabase_user_id: user.id,
        staff_id: myStaffId,
        tenant_id: tenantId,
        role: "owner_admin",
        is_pto_approver: true,
        pto_approver_rank: "primary",
      });
      if (userError) throw new ActionError(userError.message);
    }

    // 7. Done. The tenant lands in 'trial': fully usable, but no email goes
    // out until the owner deliberately goes live (Settings → Go Live).
    await service
      .from("tenant")
      .update({ onboarding_complete: true, status: "trial" })
      .eq("id", tenantId);

    await service.from("activity_log").insert({
      tenant_id: tenantId,
      actor_user_id: user.id,
      action: "onboarding_complete",
      entity_type: "tenant",
      entity_id: tenantId,
      detail: {
        locations: data.locations.length,
        staff: staffRows.length,
        has_ratio: data.has_ratio,
      },
    });

    return undefined;
  });
}

export async function finishAndGo() {
  redirect("/app/dashboard");
}

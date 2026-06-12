"use server";

// Platform-admin actions: switch the active tenant, emulate a user, and
// return home. State lives in the platform_admin row, so RLS scoping
// follows automatically everywhere.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { MESA_VISTA_NAME, resetMesaVista } from "@/lib/demo/mesa-vista";
import { ActionError, runAction, type ActionResult } from "./helpers";

async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) {
    throw new ActionError("Platform admin access required.");
  }
  return session;
}

export async function switchActiveTenant(
  tenantId: string | null
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePlatformAdmin();
    const service = createServiceClient();

    if (tenantId) {
      const { data: tenant } = await service
        .from("tenant")
        .select("id")
        .eq("id", tenantId)
        .maybeSingle();
      if (!tenant) throw new ActionError("Tenant not found.");
    }

    const { error } = await service
      .from("platform_admin")
      .update({ active_tenant_id: tenantId, emulate_app_user_id: null })
      .eq("supabase_user_id", session.userId);
    if (error) throw new ActionError(error.message);

    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function updateTenantEmailMode(
  tenantId: string,
  input: {
    status: "setup" | "trial" | "live";
    outbound_email_enabled: boolean;
    allowlist: string[];
    is_demo: boolean;
    demo_redirect_email: string;
  }
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const service = createServiceClient();

    if (!["setup", "trial", "live"].includes(input.status))
      throw new ActionError("Invalid tenant status.");
    // Demo tenants hold fictional rosters — they never go live
    if (input.is_demo && input.status === "live")
      throw new ActionError("Demo tenants can't go live. Uncheck demo first.");

    // Normalize the allowlist: trim, lowercase, drop blanks, dedupe —
    // the mailer compares normalized, so store normalized too.
    const allowlist = [
      ...new Set(
        input.allowlist.map((e) => e.trim().toLowerCase()).filter(Boolean)
      ),
    ];

    const { error } = await service
      .from("tenant")
      .update({
        status: input.status,
        outbound_email_enabled: input.outbound_email_enabled,
        email_allowlist: allowlist,
        is_demo: input.is_demo,
        demo_redirect_email:
          input.demo_redirect_email.trim().toLowerCase() || null,
      })
      .eq("id", tenantId);
    if (error) throw new ActionError(error.message);

    revalidatePath("/app/admin");
    return undefined;
  });
}

export async function updateTenantBilling(
  tenantId: string,
  input: {
    billing_status: "none" | "trial" | "active" | "past_due" | "canceled";
    billed_locations: number | null;
    billing_interval: "monthly" | "annual" | null;
  }
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const service = createServiceClient();
    const { error } = await service
      .from("tenant")
      .update({
        billing_status: input.billing_status,
        billed_locations: input.billed_locations,
        billing_interval: input.billing_interval,
        billing_provider: input.billing_status === "none" ? null : "manual",
      })
      .eq("id", tenantId);
    if (error) throw new ActionError(error.message);
    revalidatePath("/app/admin");
    return undefined;
  });
}

/**
 * Restore a demo tenant to its baseline: wipes all data, re-seeds, and
 * re-anchors every date to the current week — so the demo always looks
 * current. Tenant config and the demo login are preserved.
 */
export async function resetDemoTenant(tenantId: string): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const service = createServiceClient();

    const { data: tenant } = await service
      .from("tenant")
      .select("id, name, is_demo")
      .eq("id", tenantId)
      .maybeSingle();
    if (!tenant?.is_demo) throw new ActionError("Not a demo tenant.");
    if (tenant.name !== MESA_VISTA_NAME)
      throw new ActionError("No reset routine exists for this demo tenant.");

    await resetMesaVista(service);

    revalidatePath("/app", "layout");
    return undefined;
  });
}

export async function emulateAppUser(
  appUserId: string | null
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePlatformAdmin();
    const service = createServiceClient();

    if (appUserId) {
      const { data: target } = await service
        .from("app_user")
        .select("id, tenant_id")
        .eq("id", appUserId)
        .maybeSingle();
      if (!target) throw new ActionError("User not found.");
      // Emulating also makes their tenant the active one
      const { error } = await service
        .from("platform_admin")
        .update({
          emulate_app_user_id: appUserId,
          active_tenant_id: target.tenant_id,
        })
        .eq("supabase_user_id", session.userId);
      if (error) throw new ActionError(error.message);
    } else {
      const { error } = await service
        .from("platform_admin")
        .update({ emulate_app_user_id: null })
        .eq("supabase_user_id", session.userId);
      if (error) throw new ActionError(error.message);
    }

    revalidatePath("/app", "layout");
    return undefined;
  });
}

"use server";

// Platform-admin actions: switch the active tenant, emulate a user, and
// return home. State lives in the platform_admin row, so RLS scoping
// follows automatically everywhere.

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
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

"use server";

// Workspace deletion — the nuclear option, for test workspaces and real
// offboarding. Owner/Admin only, name-confirmation required, cascades
// through every tenant table via the schema's ON DELETE CASCADE.

import { createServiceClient } from "@/lib/supabase/admin";
import {
  ActionError,
  requireAdmin,
  runAction,
  type ActionResult,
} from "./helpers";

export async function deleteWorkspace(
  confirmName: string
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();

    if (confirmName.trim() !== ctx.tenant.name) {
      throw new ActionError(
        `Type the workspace name exactly ("${ctx.tenant.name}") to confirm deletion.`
      );
    }

    const service = createServiceClient();
    const { error } = await service
      .from("tenant")
      .delete()
      .eq("id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    // Everything tenant-scoped (locations, staff, shifts, records, the
    // app_user rows) cascades away. The Supabase auth user remains and
    // lands back at onboarding on next load.
    return undefined;
  });
}

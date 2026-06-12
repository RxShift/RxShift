"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  ActionError,
  logActivity,
  requireMember,
  runAction,
  type ActionResult,
} from "./helpers";

const statusSchema = z.enum([
  "present_counting",
  "on_lunch",
  "off_floor",
  "in_meeting",
  "non_tech_function",
]);

export async function setLiveStatus(
  staffId: string | null, // null = self
  status: unknown
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireMember();
    const parsed = statusSchema.parse(status);

    const isManager = ["owner_admin", "scheduler", "supervisor"].includes(
      ctx.appUser.role
    );
    const targetId =
      staffId && isManager ? staffId : ctx.appUser.staff_id;
    if (!targetId)
      throw new ActionError("Your sign-in isn't linked to a staff record.");
    if (staffId && staffId !== ctx.appUser.staff_id && !isManager)
      throw new ActionError("Only managers can set someone else's status.");

    const supabase = await createClient();
    const now = new Date().toISOString();

    // Close any open status, then open the new one
    await supabase
      .from("live_status")
      .update({ effective_to: now })
      .eq("staff_id", targetId)
      .is("effective_to", null);

    const { error } = await supabase.from("live_status").insert({
      tenant_id: ctx.tenantId,
      staff_id: targetId,
      status: parsed,
      effective_from: now,
    });
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "live_status", "staff", targetId, { status: parsed });
    revalidatePath("/app/board");
    revalidatePath("/app/me");
    return undefined;
  });
}

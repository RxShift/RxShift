"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  ActionError,
  logActivity,
  requireManager,
  runAction,
  type ActionResult,
} from "./helpers";

const noteSchema = z.object({
  activity_log_id: z.string().uuid(),
  note: z.string().trim().min(1).max(1000),
});

/**
 * Append a note to an audit-log entry. The original entry is NEVER modified —
 * this only adds an annotation (e.g. "RPh forgot to clock back from lunch;
 * corrected on the floor"). Append-only by design (table has no update/delete
 * policy), and the annotation itself is recorded in the audit log.
 */
export async function appendActivityNote(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = noteSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.from("activity_log_note").insert({
      tenant_id: ctx.tenantId,
      activity_log_id: data.activity_log_id,
      author_user_id: ctx.actingUserId,
      note: data.note,
    });
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "annotate", "activity_log", data.activity_log_id, {
      note: data.note,
    });
    revalidatePath("/app/log/audit");
    return undefined;
  });
}

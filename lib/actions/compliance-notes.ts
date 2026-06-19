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
  compliance_record_id: z.string().uuid(),
  note: z.string().trim().min(1).max(1000),
});

/**
 * Append a note to a Compliance Record hour. The determination (compliant /
 * deficient) is NEVER changed — this only adds after-the-fact context (e.g.
 * "Dr. Patel left at 2pm — family emergency; float held at Spring Valley until
 * 4pm"). Append-only by design (the table has no update/delete policy), and the
 * annotation itself is recorded in the activity log.
 */
export async function appendComplianceNote(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = noteSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.from("compliance_record_note").insert({
      tenant_id: ctx.tenantId,
      compliance_record_id: data.compliance_record_id,
      author_user_id: ctx.userId,
      note: data.note,
    });
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "annotate", "compliance_record", data.compliance_record_id, {
      note: data.note,
    });
    revalidatePath("/app/log");
    return undefined;
  });
}

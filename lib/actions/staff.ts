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

const staffSchema = z.object({
  full_name: z.string().min(1).max(160),
  login_email: z.string().email().nullish().or(z.literal("").transform(() => null)),
  work_email: z.string().email().nullish().or(z.literal("").transform(() => null)),
  job_title: z.string().max(120).nullish(),
  ratio_type: z.enum(["pharmacist", "technician", "non_counting"]),
  employment_type: z.enum(["full_time", "part_time", "per_diem", "contractor_1099"]),
  home_location_id: z.string().uuid().nullish(),
  active: z.coerce.boolean().default(true),
});

export async function createStaff(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = staffSchema.parse(input);
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("staff")
      .insert({ ...data, tenant_id: ctx.tenantId })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "create", "staff", row.id, { name: data.full_name });
    revalidatePath("/app/staff");
    return { id: row.id as string };
  });
}

export async function updateStaff(id: string, input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = staffSchema.parse(input);
    const supabase = await createClient();
    const { error } = await supabase
      .from("staff")
      .update(data)
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "update", "staff", id, { name: data.full_name });
    revalidatePath("/app/staff");
    return undefined;
  });
}

const importRowSchema = staffSchema.pick({
  full_name: true,
  login_email: true,
  work_email: true,
  job_title: true,
  ratio_type: true,
  employment_type: true,
});

export async function importStaff(
  rows: unknown[],
  homeLocationId: string | null
): Promise<ActionResult<{ imported: number; skipped: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new ActionError("No rows to import.");
    }
    if (rows.length > 500) {
      throw new ActionError("Import is limited to 500 rows at a time.");
    }

    const valid: z.infer<typeof importRowSchema>[] = [];
    let skipped = 0;
    for (const row of rows) {
      const parsed = importRowSchema.safeParse(row);
      if (parsed.success && parsed.data.full_name.trim()) {
        valid.push(parsed.data);
      } else {
        skipped += 1;
      }
    }
    if (valid.length === 0) {
      throw new ActionError(
        "No valid rows found. Check that names are present and ratio types are pharmacist, technician, or non_counting."
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.from("staff").insert(
      valid.map((v) => ({
        ...v,
        tenant_id: ctx.tenantId,
        home_location_id: homeLocationId,
      }))
    );
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "import", "staff", null, {
      imported: valid.length,
      skipped,
    });
    revalidatePath("/app/staff");
    return { imported: valid.length, skipped };
  });
}

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
  requireMember,
  runAction,
  type ActionResult,
} from "./helpers";

const staffSchema = z.object({
  full_name: z.string().min(1).max(160),
  login_email: z.string().email().nullish().or(z.literal("").transform(() => null)),
  work_email: z.string().email().nullish().or(z.literal("").transform(() => null)),
  job_title: z.string().max(120).nullish(),
  ratio_type: z.enum(["pharmacist", "technician", "non_counting"]),
  // The role for ratio math. ratio_type decides whether they COUNT;
  // staff_type adds the technician-in-training distinction R072-25 needs.
  staff_type: z.enum(["pharmacist", "tech", "tech_in_training"]).default("tech"),
  employment_type: z.enum(["full_time", "part_time", "per_diem", "contractor_1099"]),
  home_location_id: z.string().uuid().nullish(),
  certified: z.coerce.boolean().default(false),
  // Free-text scheduling notes shown on the staff record.
  scheduling_notes: z
    .string()
    .max(4000)
    .nullish()
    .or(z.literal("").transform(() => null)),
  // Present on the floor but never counted toward the ratio (keeps RPh/tech role).
  excluded_from_ratio: z.coerce.boolean().default(false),
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

/**
 * Upload a staff avatar (already cropped to a square webp client-side). A manager
 * can set anyone's photo; a staff member can set their own. Runs server-side with
 * the service role (so it works regardless of browser RLS / "viewing as"), and
 * enforces self-or-manager + tenant ownership in code.
 */
export async function uploadAvatar(
  staffId: string,
  formData: FormData
): Promise<ActionResult<{ path: string }>> {
  return runAction(async () => {
    const ctx = await requireMember();
    const isManager = ["owner_admin", "scheduler", "supervisor"].includes(
      ctx.appUser.role
    );
    if (!isManager && ctx.appUser.staff_id !== staffId)
      throw new ActionError("You can only change your own photo.");

    const file = formData.get("file");
    if (!(file instanceof Blob)) throw new ActionError("No image provided.");

    const supabase = await createClient();
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (!staff) throw new ActionError("Staff member not found.");

    const service = createServiceClient();
    const path = `${ctx.tenantId}/${staffId}-${Date.now()}.webp`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await service.storage
      .from("avatars")
      .upload(path, buf, { contentType: "image/webp", upsert: true });
    if (upErr) throw new ActionError(upErr.message);

    const { error } = await service
      .from("staff")
      .update({ avatar_path: path })
      .eq("id", staffId)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    await logActivity(ctx, "update", "staff", staffId, { avatar: true });
    revalidatePath("/app/staff");
    revalidatePath("/app/schedule");
    revalidatePath("/app/me");
    return { path };
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

    // Re-activating someone lifts any sign-in ban from a prior offboarding
    if (data.active) await setSignInBanned(ctx.tenantId, id, false);

    await logActivity(ctx, "update", "staff", id, { name: data.full_name });
    revalidatePath("/app/staff");
    return undefined;
  });
}

/** Ban/unban the auth user linked to a staff record (no-op if none). */
async function setSignInBanned(
  tenantId: string,
  staffId: string,
  banned: boolean
): Promise<boolean> {
  const service = createServiceClient();
  const { data: account } = await service
    .from("app_user")
    .select("supabase_user_id")
    .eq("staff_id", staffId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!account) return false;
  const { error } = await service.auth.admin.updateUserById(
    account.supabase_user_id,
    { ban_duration: banned ? "876000h" : "none" } // ~100 years / lift
  );
  if (error) throw new ActionError(`Sign-in ${banned ? "block" : "restore"} failed: ${error.message}`);
  return true;
}

/**
 * Offboarding: the person leaves the pharmacy. Deactivates them (no more
 * scheduling, live board, or roster auto-attach) AND blocks their sign-in,
 * while every past schedule, log, and compliance record keeps their name.
 * Reversible: re-activating via the staff editor lifts the sign-in block.
 */
export async function offboardStaff(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireAdmin();
    const supabase = await createClient();

    const { data: person, error: findErr } = await supabase
      .from("staff")
      .select("id, full_name")
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();
    if (findErr) throw new ActionError(findErr.message);
    if (!person) throw new ActionError("Staff member not found.");
    if (person.id === ctx.appUser.staff_id)
      throw new ActionError("You can't offboard yourself.");

    const { error } = await supabase
      .from("staff")
      .update({ active: false })
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);

    const signInBlocked = await setSignInBanned(ctx.tenantId, id, true);

    await logActivity(ctx, "offboard", "staff", id, {
      name: person.full_name,
      sign_in_blocked: signInBlocked,
    });
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

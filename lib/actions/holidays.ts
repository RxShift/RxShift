"use server";

// Tenant holiday management. Holidays are purely visual on the schedule (a column
// tint + label); they never block staffing. Generated from the deterministic US
// federal generator (lib/holidays.ts), then freely added / edited / removed.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { usFederalHolidays } from "@/lib/holidays";
import {
  ActionError,
  logActivity,
  requireManager,
  runAction,
  type ActionResult,
} from "./helpers";

function revalidate() {
  revalidatePath("/app/settings/holidays");
  revalidatePath("/app/schedule");
}

export async function generateHolidaysForYear(
  year: number
): Promise<ActionResult<{ added: number }>> {
  return runAction(async () => {
    const ctx = await requireManager();
    if (!Number.isInteger(year) || year < 2000 || year > 2100)
      throw new ActionError("Pick a valid year.");
    const supabase = await createClient();
    const rows = usFederalHolidays(year).map((h) => ({
      tenant_id: ctx.tenantId,
      date: h.date,
      name: h.name,
    }));
    // ignoreDuplicates so re-generating a year is idempotent and never clobbers a
    // manually edited name or moved date.
    const { data, error } = await supabase
      .from("holiday")
      .upsert(rows, { onConflict: "tenant_id,date", ignoreDuplicates: true })
      .select("id");
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "generate", "holiday", null, {
      year,
      count: rows.length,
    });
    revalidate();
    return { added: data?.length ?? 0 };
  });
}

const upsertSchema = z.object({
  id: z.string().uuid().nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1).max(120),
});

export async function upsertHoliday(input: unknown): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const data = upsertSchema.parse(input);
    const supabase = await createClient();
    if (data.id) {
      const { error } = await supabase
        .from("holiday")
        .update({ date: data.date, name: data.name })
        .eq("id", data.id)
        .eq("tenant_id", ctx.tenantId);
      if (error) throw new ActionError(error.message);
    } else {
      const { error } = await supabase.from("holiday").upsert(
        { tenant_id: ctx.tenantId, date: data.date, name: data.name },
        { onConflict: "tenant_id,date" }
      );
      if (error) throw new ActionError(error.message);
    }
    await logActivity(ctx, data.id ? "update" : "create", "holiday", data.id ?? null, {
      date: data.date,
      name: data.name,
    });
    revalidate();
    return undefined;
  });
}

export async function deleteHoliday(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();
    const { error } = await supabase
      .from("holiday")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ctx.tenantId);
    if (error) throw new ActionError(error.message);
    await logActivity(ctx, "delete", "holiday", id);
    revalidate();
    return undefined;
  });
}

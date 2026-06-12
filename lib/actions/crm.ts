"use server";

// Internal CRM actions — platform admins only. The leads tables have RLS
// enabled with no policies, so ALL access goes through the service client
// behind the requirePlatformAdmin gate. Customers can never reach these.

import { revalidatePath } from "next/cache";
import { z } from "zod";
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

/** Display name for note authorship — extend as admins are added. */
function adminDisplayName(email: string): string {
  const map: Record<string, string> = {
    "jamison@jamisonwest.com": "Jamison",
    "dr.monahanwest@outlook.com": "Susie",
  };
  const norm = email.toLowerCase();
  if (map[norm]) return map[norm];
  if (norm.includes("susie") || norm.includes("monahan")) return "Susie";
  const local = norm.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

const leadSchema = z.object({
  pharmacy_name: z.string().min(1).max(200),
  location_count: z.coerce
    .number()
    .int()
    .min(1)
    .max(999)
    .nullish()
    .or(z.literal("").transform(() => null)),
  contact_name: z.string().max(160).nullish(),
  contact_email: z
    .string()
    .email()
    .nullish()
    .or(z.literal("").transform(() => null)),
  contact_phone: z.string().max(40).nullish(),
  source: z.enum(["inbound", "referral", "LinkedIn", "Susie", "cold"]),
  stage: z.enum(["Lead", "Demo", "Trial", "Active", "Churned"]),
  state: z.string().max(40).nullish(),
  message: z.string().max(2000).nullish(),
});

export async function createLead(
  input: unknown
): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePlatformAdmin();
    const data = leadSchema.parse(input);
    const service = createServiceClient();

    const { data: lead, error } = await service
      .from("leads")
      .insert({
        ...data,
        contact_email: data.contact_email?.toLowerCase() ?? null,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);

    await service.from("lead_notes").insert({
      lead_id: lead.id,
      author: "System",
      body: `Lead added manually by ${adminDisplayName(session.email)}.`,
    });

    revalidatePath("/app/admin/leads");
    return { id: lead.id as string };
  });
}

export async function updateLead(
  id: string,
  input: unknown
): Promise<ActionResult> {
  return runAction(async () => {
    await requirePlatformAdmin();
    const data = leadSchema.parse(input);
    const service = createServiceClient();

    const { error } = await service
      .from("leads")
      .update({
        ...data,
        contact_email: data.contact_email?.toLowerCase() ?? null,
      })
      .eq("id", id);
    if (error) throw new ActionError(error.message);

    revalidatePath("/app/admin/leads");
    return undefined;
  });
}

export async function addLeadNote(
  leadId: string,
  body: string
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requirePlatformAdmin();
    const trimmed = body.trim();
    if (!trimmed) throw new ActionError("Note can't be empty.");
    if (trimmed.length > 4000) throw new ActionError("Note is too long.");
    const service = createServiceClient();

    const { error } = await service.from("lead_notes").insert({
      lead_id: leadId,
      author: adminDisplayName(session.email),
      body: trimmed,
    });
    if (error) throw new ActionError(error.message);

    // Notes count as activity — bump the lead's freshness
    await service
      .from("leads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", leadId);

    revalidatePath("/app/admin/leads");
    return undefined;
  });
}

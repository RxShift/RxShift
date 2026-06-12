import "server-only";
import { createServiceClient } from "@/lib/supabase/admin";

/**
 * Roster auto-attach: a signed-in user with no app_user whose email
 * matches exactly ONE active, unclaimed staff record (in a fully
 * onboarded tenant) belongs to that pharmacy — create their app_user
 * (role 'staff') and return true so the caller can skip the new-tenant
 * wizard. Managers upgrade their role afterward in Settings → Team.
 *
 * Safety: the magic link already VERIFIED ownership of the email, so an
 * exact match against the roster's login_email is sufficient proof of
 * identity. Zero or multiple matches → do nothing (wizard as usual).
 */
export async function tryAttachByRosterEmail(
  supabaseUserId: string,
  email: string
): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;
  const service = createServiceClient();

  // ilike with escaped wildcards = case-insensitive equality
  const pattern = norm.replace(/([%_\\])/g, "\\$1");
  const { data: matches } = await service
    .from("staff")
    .select("id, tenant_id, tenant!inner(onboarding_complete)")
    .eq("active", true)
    .ilike("login_email", pattern);

  const eligible = (matches ?? []).filter(
    (m) =>
      (m.tenant as { onboarding_complete?: boolean } | null)
        ?.onboarding_complete
  );
  if (eligible.length !== 1) return false;
  const staff = eligible[0];

  // Staff record already claimed by another sign-in → don't attach
  const { data: claimed } = await service
    .from("app_user")
    .select("id")
    .eq("staff_id", staff.id)
    .maybeSingle();
  if (claimed) return false;

  const { data: appUser, error } = await service
    .from("app_user")
    .insert({
      supabase_user_id: supabaseUserId,
      staff_id: staff.id,
      tenant_id: staff.tenant_id,
      role: "staff",
      is_pto_approver: false,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[roster-attach] failed:", error.message);
    return false;
  }

  await service.from("activity_log").insert({
    tenant_id: staff.tenant_id,
    actor_user_id: supabaseUserId,
    action: "auto_attach_user",
    entity_type: "app_user",
    entity_id: appUser.id,
    detail: { staff_id: staff.id, email: norm },
  });

  return true;
}

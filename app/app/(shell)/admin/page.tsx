import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { describeTenantBilling } from "@/lib/billing";
import PageHeader from "@/components/ui/page-header";
import AdminConsole from "@/components/app/admin/admin-console";
import type { AppUser, Staff, Tenant } from "@/lib/types";

// Platform admin console — invisible and inaccessible to tenant users.
export default async function AdminPage() {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");

  const service = createServiceClient();
  const [{ data: tenants }, { data: appUsers }, { data: staff }] =
    await Promise.all([
      service.from("tenant").select("*").order("created_at"),
      service.from("app_user").select("*"),
      service.from("staff").select("id, tenant_id, full_name, login_email"),
    ]);

  const allTenants = (tenants ?? []) as Tenant[];
  const allUsers = (appUsers ?? []) as AppUser[];
  const allStaff = (staff ?? []) as Pick<
    Staff,
    "id" | "tenant_id" | "full_name" | "login_email"
  >[];

  // Build a fallback email map for app_users with no linked staff record
  // (e.g. demo owners whose staff_id is intentionally null).
  const noStaffUsers = allUsers.filter((u) => !u.staff_id);
  let authEmailMap: Record<string, string> = {};
  if (noStaffUsers.length > 0) {
    const { data: authList } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authList) {
      for (const au of authList.users) {
        authEmailMap[au.id] = au.email ?? "";
      }
    }
  }

  const tenantSummaries = allTenants.map((t) => ({
    id: t.id,
    name: t.name,
    has_ratio: t.has_ratio,
    schedule_cycle: t.schedule_cycle,
    outbound_email_enabled: t.outbound_email_enabled,
    status: t.status,
    email_allowlist: t.email_allowlist ?? [],
    is_demo: t.is_demo,
    demo_redirect_email: t.demo_redirect_email ?? "",
    demo_clock: t.demo_clock ?? null,
    billing_label: describeTenantBilling(t).label,
    billing_status: t.billing_status,
    billed_locations: t.billed_locations,
    billing_interval: t.billing_interval,
    created_at: t.created_at,
    staff_count: allStaff.filter((s) => s.tenant_id === t.id).length,
    user_count: allUsers.filter((u) => u.tenant_id === t.id).length,
  }));

  const userSummaries = allUsers.map((u) => {
    const linkedStaff = allStaff.find((s) => s.id === u.staff_id);
    const authEmail = authEmailMap[u.supabase_user_id];
    return {
      id: u.id,
      tenant_id: u.tenant_id,
      role: u.role,
      // Prefer the staff name, then the app_user display_name (set for owners
      // with no staff record, e.g. the Mesa Vista demo owner), then the auth
      // email — so the emulate dropdown reads "Frank DiMaggio", not his email.
      label:
        linkedStaff?.full_name ?? u.display_name ?? authEmail ?? "(no staff record)",
      email: linkedStaff?.login_email ?? authEmail ?? null,
    };
  });

  return (
    <>
      <PageHeader title="Platform Admin" />
      <div className="flex-1 p-8">
        <AdminConsole
          tenants={tenantSummaries}
          users={userSummaries}
          activeTenantId={session.platform.activeTenantId}
          ownTenantId={
            session.platform.activeTenantId === null
              ? (session.appUser?.tenant_id ?? null)
              : null
          }
        />
      </div>
    </>
  );
}

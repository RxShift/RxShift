import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
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

  const tenantSummaries = allTenants.map((t) => ({
    id: t.id,
    name: t.name,
    has_ratio: t.has_ratio,
    schedule_cycle: t.schedule_cycle,
    outbound_email_enabled: t.outbound_email_enabled,
    created_at: t.created_at,
    staff_count: allStaff.filter((s) => s.tenant_id === t.id).length,
    user_count: allUsers.filter((u) => u.tenant_id === t.id).length,
  }));

  const userSummaries = allUsers.map((u) => ({
    id: u.id,
    tenant_id: u.tenant_id,
    role: u.role,
    label:
      allStaff.find((s) => s.id === u.staff_id)?.full_name ??
      "(no staff record)",
    email: allStaff.find((s) => s.id === u.staff_id)?.login_email ?? null,
  }));

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

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/page-header";
import LeadsTable from "@/components/app/admin/leads-table";
import type { Lead } from "@/lib/types";

// Internal CRM — platform admins only. Leads tables are service-role
// only (RLS with no policies), so all reads happen here on the server.
export default async function LeadsPage() {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");

  const service = createServiceClient();
  const { data: leads } = await service
    .from("leads")
    .select("*")
    .order("updated_at", { ascending: false });

  return (
    <>
      <PageHeader title="Leads" />
      <div className="flex-1 p-8">
        <LeadsTable leads={(leads ?? []) as Lead[]} />
      </div>
    </>
  );
}

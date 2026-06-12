import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import StaffManager from "@/components/app/staff-manager";
import type { AppUser, Location, Staff } from "@/lib/types";

export default async function StaffPage() {
  const session = await getSession();
  const supabase = await createClient();
  const [{ data: staff }, { data: locations }, { data: appUsers }] =
    await Promise.all([
      supabase.from("staff").select("*").order("full_name"),
      supabase.from("location").select("*").order("name"),
      // Explicit tenant filter: RLS deliberately lets a user see their OWN
      // app_user row across tenants (session loading needs it), so an
      // unfiltered query would leak a platform admin's foreign-tenant row.
      supabase
        .from("app_user")
        .select("*")
        .eq("tenant_id", session!.tenant!.id),
    ]);

  return (
    <>
      <PageHeader title="Staff" />
      <div className="flex-1 p-8">
        <StaffManager
          staff={(staff ?? []) as Staff[]}
          locations={(locations ?? []) as Location[]}
          appUsers={(appUsers ?? []) as AppUser[]}
          canEditRoles={["owner_admin"].includes(session!.appUser!.role)}
        />
      </div>
    </>
  );
}

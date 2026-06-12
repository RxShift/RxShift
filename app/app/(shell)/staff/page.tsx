import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/page-header";
import StaffManager from "@/components/app/staff-manager";
import type { Location, Staff } from "@/lib/types";

export default async function StaffPage() {
  const supabase = await createClient();
  const [{ data: staff }, { data: locations }] = await Promise.all([
    supabase.from("staff").select("*").order("full_name"),
    supabase.from("location").select("*").order("name"),
  ]);

  return (
    <>
      <PageHeader title="Staff" />
      <div className="flex-1 p-8">
        <StaffManager
          staff={(staff ?? []) as Staff[]}
          locations={(locations ?? []) as Location[]}
        />
      </div>
    </>
  );
}

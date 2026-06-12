import { createClient } from "@/lib/supabase/server";
import StaffImport from "@/components/app/settings/staff-import";
import type { Location } from "@/lib/types";

export default async function ImportSettingsPage() {
  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("location")
    .select("*")
    .order("name");

  return <StaffImport locations={(locations ?? []) as Location[]} />;
}

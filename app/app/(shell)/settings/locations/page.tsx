import { createClient } from "@/lib/supabase/server";
import LocationsManager from "@/components/app/settings/locations-manager";
import type { Department, Location } from "@/lib/types";

export default async function LocationsSettingsPage() {
  const supabase = await createClient();
  const [{ data: locations }, { data: departments }] = await Promise.all([
    supabase.from("location").select("*").order("name"),
    supabase.from("department").select("*").order("name"),
  ]);

  return (
    <LocationsManager
      locations={(locations ?? []) as Location[]}
      departments={(departments ?? []) as Department[]}
    />
  );
}

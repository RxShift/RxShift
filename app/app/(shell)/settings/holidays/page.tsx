import { createClient } from "@/lib/supabase/server";
import HolidaysManager from "@/components/app/settings/holidays-manager";
import type { Holiday } from "@/lib/types";

export default async function HolidaysSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("holiday").select("*").order("date");

  return (
    <div className="max-w-[840px] space-y-6">
      <HolidaysManager initial={(data ?? []) as Holiday[]} />
    </div>
  );
}

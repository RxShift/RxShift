import { createClient } from "@/lib/supabase/server";
import WorkTypesManager from "@/components/app/settings/work-types-manager";
import type { WorkType } from "@/lib/types";

export default async function WorkTypesSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("work_type").select("*").order("name");

  return (
    <div className="max-w-[840px]">
      <p className="mb-6 max-w-[620px] font-body text-sm leading-relaxed text-steel">
        Work types are the activities people do during a shift — and they, not
        job titles, decide whether someone counts toward the ratio in that
        block. A technician on Dispensing counts; the same technician on
        Inventory does not, and the compliance record documents the exception.
      </p>
      <WorkTypesManager workTypes={(data ?? []) as WorkType[]} />
    </div>
  );
}

import { createClient } from "@/lib/supabase/server";
import WorkTypesManager from "@/components/app/settings/work-types-manager";
import type { WorkType } from "@/lib/types";

export default async function WorkTypesSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("work_type").select("*").order("name");

  return (
    <div className="max-w-[840px]">
      <p className="mb-4 max-w-[640px] font-body text-sm leading-relaxed text-steel">
        Work types are the activities people do during a shift — and they, not
        job titles, decide whether someone counts toward the ratio in that
        block. A technician on Dispensing counts; the same technician on
        Inventory does not, and the Compliance Record documents the exception.
      </p>
      <div className="mb-6 max-w-[640px] rounded-lg border border-line bg-cloud/40 p-4">
        <p className="font-brand text-[11px] font-bold uppercase tracking-[1px] text-steel">
          How counting is decided
        </p>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-navy">
          A person counts only when their <strong>work type (or role default)</strong>
          {" "}says count <strong>and</strong> their live status counts. A
          non-counting work type always wins: if a tech is on Inventory, they
          don&rsquo;t count no matter what their status says. Managers set this in
          advance by splitting a shift into segments; staff can switch their own
          work type in real time from My Schedule.
        </p>
        <p className="mt-2 font-body text-[13px] leading-relaxed text-steel">
          <strong>Work types vs. departments:</strong> work types are
          shift-level (what you&rsquo;re doing, with a color, and whether it
          counts). Departments are an optional area tag on a shift (e.g.
          Retail, Compounding) used to organize and filter — they don&rsquo;t
          affect the ratio.
        </p>
      </div>
      <WorkTypesManager workTypes={(data ?? []) as WorkType[]} />
    </div>
  );
}

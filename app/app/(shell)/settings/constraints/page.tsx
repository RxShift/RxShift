import { createClient } from "@/lib/supabase/server";
import ConstraintManager from "@/components/app/settings/constraint-manager";
import type { ConstraintRule, Staff } from "@/lib/types";

export default async function ConstraintsSettingsPage() {
  const supabase = await createClient();
  const [{ data: rules }, { data: staff }] = await Promise.all([
    supabase.from("constraint_rule").select("*").order("created_at", { ascending: false }),
    supabase.from("staff").select("*").eq("active", true).order("full_name"),
  ]);

  return (
    <div className="max-w-[920px]">
      <p className="mb-6 max-w-[620px] font-body text-sm leading-relaxed text-steel">
        Per-person and per-role rules that flag at scheduling time — hour caps,
        overtime thresholds, availability windows. All advisory: RxShift flags,
        a human decides. Changing a rule re-checks published schedules.
      </p>
      <ConstraintManager
        rules={(rules ?? []) as ConstraintRule[]}
        staff={(staff ?? []) as Staff[]}
      />
    </div>
  );
}

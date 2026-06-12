import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import ZonesManager from "@/components/app/settings/zones-manager";
import RatioRuleForm from "@/components/app/settings/ratio-rule-form";
import type { Location, RatioRule, RatioZone } from "@/lib/types";

export default async function RatioSettingsPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const [{ data: zones }, { data: locations }, { data: rules }] =
    await Promise.all([
      supabase.from("ratio_zone").select("*").order("name"),
      supabase.from("location").select("*").order("name"),
      supabase.from("ratio_rule").select("*"),
    ]);

  const allRules = (rules ?? []) as RatioRule[];
  const tenantRule = allRules.find((r) => r.tenant_id === tenant.id) ?? null;
  const nvSeed =
    allRules.find((r) => r.tenant_id === null && r.state === "NV") ?? null;

  return (
    <div className="max-w-[840px] space-y-10">
      {!tenant.has_ratio && (
        <div className="rounded-lg border-l-[3px] border-l-[#D4860A] bg-[#FEF7ED] p-4 font-body text-sm text-[#8a5a06]">
          Your organization is set to &ldquo;no ratio requirement.&rdquo; The
          settings below only take effect after you enable the ratio in
          Settings → Organization.
        </div>
      )}

      <RatioRuleForm tenantRule={tenantRule} nvSeed={nvSeed} />

      <ZonesManager
        zones={(zones ?? []) as RatioZone[]}
        locations={(locations ?? []) as Location[]}
      />
    </div>
  );
}

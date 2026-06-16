import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import RatioRuleForm from "@/components/app/settings/ratio-rule-form";
import type { RatioRule } from "@/lib/types";

export default async function RatioSettingsPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const { data: rules } = await supabase.from("ratio_rule").select("*");
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

      <div className="rounded-lg border border-line bg-cloud/40 p-4 font-body text-sm text-steel">
        <p className="font-brand text-[13px] font-bold text-navy">
          One ratio per location
        </p>
        <p className="mt-1 leading-[1.6]">
          The ratio is calculated per location — everyone counting toward the
          ratio at a location counts together, whatever room or department
          they&rsquo;re in. If a site genuinely needs two separate ratio pools
          (e.g. a fully isolated sterile suite licensed on its own), add it as a
          separate <a href="/app/settings/locations" className="underline">location</a>.
        </p>
      </div>
    </div>
  );
}

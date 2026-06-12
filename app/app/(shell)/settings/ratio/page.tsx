import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import EntityManager from "@/components/app/entity-manager";
import RatioRuleForm from "@/components/app/settings/ratio-rule-form";
import Badge from "@/components/ui/badge";
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

  const locs = (locations ?? []) as Location[];
  const allRules = (rules ?? []) as RatioRule[];
  const tenantRule = allRules.find((r) => r.tenant_id === tenant.id) ?? null;
  const nvSeed = allRules.find((r) => r.tenant_id === null && r.state === "NV") ?? null;

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

      <EntityManager
        entity="ratio_zone"
        title="Ratio Zone"
        rows={(zones ?? []) as RatioZone[]}
        emptyMessage="A ratio zone is an independent compliance boundary. Most pharmacies have exactly one per location. Add a second zone only for an isolated room — a sterile or IV room with its own staffing."
        columns={[
          { label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          {
            label: "Location",
            render: (r) => locs.find((l) => l.id === r.location_id)?.name ?? "—",
          },
          {
            label: "Isolation",
            render: (r) =>
              r.ratio_isolated ? (
                <Badge tone="alert">Isolated</Badge>
              ) : (
                <Badge tone="neutral">Main floor</Badge>
              ),
          },
        ]}
        fields={[
          { name: "name", label: "Zone name", type: "text", required: true },
          {
            name: "location_id",
            label: "Location",
            type: "select",
            required: true,
            options: locs.map((l) => ({ value: l.id, label: l.name })),
          },
          {
            name: "ratio_isolated",
            label: "Isolated room (counts independently from the main floor)",
            type: "checkbox",
            help: "Two zones can be split by a wall in one building. Staff in an isolated room never count toward the main floor's ratio.",
          },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          location_id: r.location_id,
          ratio_isolated: r.ratio_isolated,
        })}
      />
    </div>
  );
}

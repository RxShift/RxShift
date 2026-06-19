import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/ui/badge";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { OverrideLog } from "@/lib/types";

const TARGET_LABEL: Record<string, string> = {
  shift: "Schedule publish",
  slot: "Schedule publish",
  time_off: "Time-off approval",
  swap: "Swap approval",
  callout: "Callout",
};

export default async function OverrideLogPage() {
  const supabase = await createClient();
  const [{ data }, { data: users }, { data: staff }] = await Promise.all([
    supabase
      .from("override_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("app_user").select("supabase_user_id, staff_id, role, display_name"),
    supabase.from("staff").select("id, full_name"),
  ]);
  const overrides = (data ?? []) as OverrideLog[];

  const staffName = new Map(
    ((staff ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ])
  );
  const actorName = new Map<string, string>();
  for (const u of (users ?? []) as {
    supabase_user_id: string;
    staff_id: string | null;
    role: string;
    display_name: string | null;
  }[]) {
    actorName.set(
      u.supabase_user_id,
      (u.staff_id && staffName.get(u.staff_id)) || u.display_name || u.role || "User"
    );
  }

  return (
    <>
      <PageHeader title="Override Log" />
      <div className="flex-1 p-8">
        <div className="max-w-[1000px]">
          <p className="mb-6 max-w-[640px] font-body text-sm leading-relaxed text-steel">
            Every time a manager proceeds past a compliance warning — publishing a
            flagged schedule, or approving a time-off/swap that creates a ratio
            deficiency — the required reason lands here: who, when, what kind of
            warning, and why it was acceptable. Append-only, and cross-referenced
            on the Coverage Forecast.
          </p>
          {overrides.length === 0 ? (
            <EmptyState message="No overrides logged. When someone proceeds past a ratio or constraint flag, the acknowledgment appears here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>What</Th>
                  <Th>Warning</Th>
                  <Th>Reason given</Th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => (
                  <Tr key={o.id}>
                    <Td className="whitespace-nowrap">
                      {new Date(o.created_at).toLocaleString()}
                    </Td>
                    <Td>{actorName.get(o.actor_user_id) ?? "User"}</Td>
                    <Td>{TARGET_LABEL[o.target_type] ?? o.target_type}</Td>
                    <Td>
                      <Badge
                        tone={o.warning_type === "ratio" ? "deficiency" : "alert"}
                      >
                        {o.warning_type}
                      </Badge>
                    </Td>
                    <Td>{o.reason}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </div>
      </div>
    </>
  );
}

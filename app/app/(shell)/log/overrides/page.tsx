import { createClient } from "@/lib/supabase/server";
import Badge from "@/components/ui/badge";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import type { OverrideLog } from "@/lib/types";

export default async function OverrideLogPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("override_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const overrides = (data ?? []) as OverrideLog[];

  return (
    <>
      <PageHeader title="Override Log" />
      <div className="flex-1 p-8">
        <div className="max-w-[920px]">
          <p className="mb-6 max-w-[620px] font-body text-sm leading-relaxed text-steel">
            Every time a manager publishes past a warning, the required reason
            lands here — who, when, what kind of warning, and why it was
            acceptable. Append-only.
          </p>
          {overrides.length === 0 ? (
            <EmptyState message="No overrides logged. When a schedule publishes past a ratio or constraint flag, the acknowledgment appears here." />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
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

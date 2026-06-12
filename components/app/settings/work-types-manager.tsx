"use client";

import EntityManager from "@/components/app/entity-manager";
import Badge from "@/components/ui/badge";
import type { WorkType } from "@/lib/types";

export default function WorkTypesManager({ workTypes }: { workTypes: WorkType[] }) {
  return (
    <EntityManager
      entity="work_type"
      title="Work Type"
      rows={workTypes}
      emptyMessage="No work types yet. The onboarding wizard seeds the common ones; you can also add them here."
      columns={[
        {
          label: "Name",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          label: "Counts as",
          render: (r) => (r.counts_as === "none" ? "—" : r.counts_as),
        },
        {
          label: "Counting default",
          render: (r) =>
            r.counting_default ? (
              <Badge tone="compliant">Counts</Badge>
            ) : (
              <Badge tone="neutral">Does not count</Badge>
            ),
        },
        {
          label: "Specialized",
          render: (r) => (r.is_specialized ? "Yes" : "—"),
        },
      ]}
      fields={[
        { name: "name", label: "Work type name", type: "text", required: true },
        {
          name: "counts_as",
          label: "Counts as",
          type: "select",
          required: true,
          options: [
            { value: "pharmacist", label: "Pharmacist" },
            { value: "technician", label: "Technician" },
            { value: "none", label: "Never counts" },
          ],
        },
        {
          name: "counting_default",
          label: "Counts toward ratio by default",
          type: "checkbox",
          help: "Schedulers can override per shift segment; this is the default the engine applies.",
        },
        {
          name: "is_specialized",
          label: "Specialized (IV room, hospice, home infusion)",
          type: "checkbox",
        },
      ]}
      toFormValues={(r) => ({
        name: r.name,
        counts_as: r.counts_as,
        counting_default: r.counting_default,
        is_specialized: r.is_specialized,
      })}
    />
  );
}

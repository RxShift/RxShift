"use client";

import EntityManager from "@/components/app/entity-manager";
import Badge from "@/components/ui/badge";
import type { Location, RatioZone } from "@/lib/types";

export default function ZonesManager({
  zones,
  locations,
}: {
  zones: RatioZone[];
  locations: Location[];
}) {
  return (
    <EntityManager
      entity="ratio_zone"
      title="Ratio Zone"
      rows={zones}
      emptyMessage="A ratio zone is an independent compliance boundary. Most pharmacies have exactly one per location. Add a second zone only for an isolated room — a sterile or IV room with its own staffing."
      columns={[
        {
          label: "Name",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          label: "Location",
          render: (r) =>
            locations.find((l) => l.id === r.location_id)?.name ?? "—",
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
          options: locations.map((l) => ({ value: l.id, label: l.name })),
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
  );
}

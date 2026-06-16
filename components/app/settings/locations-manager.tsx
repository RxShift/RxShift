"use client";

// Client wrapper that owns the column/field definitions — server pages
// pass plain data only (functions can't cross the server/client boundary).

import EntityManager from "@/components/app/entity-manager";
import type { Department, Location } from "@/lib/types";

export default function LocationsManager({
  locations,
  departments,
}: {
  locations: Location[];
  departments: Department[];
}) {
  return (
    <div className="max-w-[840px] space-y-10">
      <EntityManager
        entity="location"
        title="Location"
        rows={locations}
        emptyMessage="No locations yet. Add your first pharmacy location — each location is its own ratio unit (everyone at a location counts toward one ratio)."
        columns={[
          {
            label: "Name",
            render: (r) => <span className="font-medium">{r.name}</span>,
          },
          { label: "Address", render: (r) => r.address ?? "—" },
        ]}
        fields={[
          { name: "name", label: "Location name", type: "text", required: true },
          { name: "address", label: "Address", type: "text" },
        ]}
        toFormValues={(r) => ({ name: r.name, address: r.address ?? "" })}
      />

      <EntityManager
        entity="department"
        title="Department"
        rows={departments}
        emptyMessage="Departments are optional groupings (compounding, hospice, front counter) used to organize and filter schedules. They don't affect the ratio, and the same department can be used at any location."
        columns={[
          {
            label: "Name",
            render: (r) => <span className="font-medium">{r.name}</span>,
          },
        ]}
        fields={[
          { name: "name", label: "Department name", type: "text", required: true },
        ]}
        toFormValues={(r) => ({ name: r.name })}
      />
    </div>
  );
}

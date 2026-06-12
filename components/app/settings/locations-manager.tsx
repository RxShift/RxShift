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
  const locName = (id: string) =>
    locations.find((l) => l.id === id)?.name ?? "—";
  const locOptions = locations.map((l) => ({ value: l.id, label: l.name }));

  return (
    <div className="max-w-[840px] space-y-10">
      <EntityManager
        entity="location"
        title="Location"
        rows={locations}
        emptyMessage="No locations yet. Add your first pharmacy location — operating hours, departments, and ratio zones all hang off it."
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
        emptyMessage="Departments are optional groupings inside a location (front counter, fulfillment). Schedulers can be scoped to departments."
        columns={[
          {
            label: "Name",
            render: (r) => <span className="font-medium">{r.name}</span>,
          },
          { label: "Location", render: (r) => locName(r.location_id) },
        ]}
        fields={[
          { name: "name", label: "Department name", type: "text", required: true },
          {
            name: "location_id",
            label: "Location",
            type: "select",
            required: true,
            options: locOptions,
          },
        ]}
        toFormValues={(r) => ({ name: r.name, location_id: r.location_id })}
      />
    </div>
  );
}

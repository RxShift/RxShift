"use client";

// Client wrapper that owns the column/field definitions — server pages
// pass plain data only (functions can't cross the server/client boundary).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EntityManager from "@/components/app/entity-manager";
import { setRequireDepartment } from "@/lib/actions/settings";
import type { Department, Location } from "@/lib/types";

export default function LocationsManager({
  locations,
  departments,
  requireDepartment,
}: {
  locations: Location[];
  departments: Department[];
  requireDepartment: boolean;
}) {
  const router = useRouter();
  const [required, setRequired] = useState(requireDepartment);
  const [pending, startTransition] = useTransition();

  function toggleRequired(next: boolean) {
    setRequired(next); // optimistic
    startTransition(async () => {
      const result = await setRequireDepartment(next);
      if (!result.ok) {
        setRequired(!next); // revert on failure
        alert(result.error);
      }
      router.refresh();
    });
  }

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

      <div className="rounded-lg border border-line bg-surface p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={required}
            disabled={pending}
            onChange={(e) => toggleRequired(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#1C2F5E]"
          />
          <span>
            <span className="font-brand text-sm font-bold text-navy">
              Require a department on every shift
            </span>
            <span className="mt-0.5 block font-body text-[13px] text-steel">
              When on, scheduling any shift requires choosing a department.
              Leave off to keep departments optional.
            </span>
          </span>
        </label>
      </div>

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

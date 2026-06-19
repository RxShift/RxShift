"use client";

// Client wrapper that owns the column/field definitions — server pages
// pass plain data only (functions can't cross the server/client boundary).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import EntityManager from "@/components/app/entity-manager";
import { setRequireDepartment } from "@/lib/actions/settings";
import type { Department, Location } from "@/lib/types";

const LOCATION_TYPE_LABEL: Record<string, string> = {
  retail: "Retail",
  telepharmacy: "Telepharmacy",
  institutional: "Institutional",
};

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
          {
            label: "Type",
            render: (r) => LOCATION_TYPE_LABEL[r.location_type] ?? "Retail",
          },
          {
            label: "Drive-through",
            render: (r) => (r.has_drive_through ? "Yes" : "—"),
          },
          { label: "Address", render: (r) => r.address ?? "—" },
        ]}
        fields={[
          { name: "name", label: "Location name", type: "text", required: true },
          { name: "address", label: "Address", type: "text" },
          {
            name: "location_type",
            label: "Location type",
            type: "select",
            required: true,
            options: [
              { value: "retail", label: "Retail (community pharmacy)" },
              { value: "telepharmacy", label: "Telepharmacy / remote / satellite" },
              { value: "institutional", label: "Institutional" },
            ],
            help: "Nevada R072-25's 4-tech ceiling and solo-pharmacist floor apply to retail locations only.",
          },
          {
            name: "has_drive_through",
            label: "This location has a drive-through window",
            type: "checkbox",
            help: "Under R072-25, a solo pharmacist at a drive-through site needs two support staff on duty (instead of one).",
          },
          { name: "expected_rx_mon", label: "Expected Rx — Monday", type: "text" },
          { name: "expected_rx_tue", label: "Expected Rx — Tuesday", type: "text" },
          { name: "expected_rx_wed", label: "Expected Rx — Wednesday", type: "text" },
          { name: "expected_rx_thu", label: "Expected Rx — Thursday", type: "text" },
          { name: "expected_rx_fri", label: "Expected Rx — Friday", type: "text" },
          { name: "expected_rx_sat", label: "Expected Rx — Saturday", type: "text" },
          {
            name: "expected_rx_sun",
            label: "Expected Rx — Sunday",
            type: "text",
            help: "Typical daily prescription volume. Shown on the schedule for planning — RxShift never enforces a volume minimum.",
          },
        ]}
        toFormValues={(r) => ({
          name: r.name,
          address: r.address ?? "",
          location_type: r.location_type ?? "retail",
          has_drive_through: r.has_drive_through ?? false,
          expected_rx_mon: r.expected_rx_mon != null ? String(r.expected_rx_mon) : "",
          expected_rx_tue: r.expected_rx_tue != null ? String(r.expected_rx_tue) : "",
          expected_rx_wed: r.expected_rx_wed != null ? String(r.expected_rx_wed) : "",
          expected_rx_thu: r.expected_rx_thu != null ? String(r.expected_rx_thu) : "",
          expected_rx_fri: r.expected_rx_fri != null ? String(r.expected_rx_fri) : "",
          expected_rx_sat: r.expected_rx_sat != null ? String(r.expected_rx_sat) : "",
          expected_rx_sun: r.expected_rx_sun != null ? String(r.expected_rx_sun) : "",
        })}
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

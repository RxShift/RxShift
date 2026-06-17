"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/page-header";
import { setLiveStatus } from "@/lib/actions/live";
import LocationCard from "@/components/app/board/location-card";
import type { LocationCard as LocationCardData, StatusListItem } from "@/lib/board-data";

function LocationGroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 font-brand text-[10px] font-bold uppercase tracking-[1.2px] text-steel">
      {children}
    </p>
  );
}

// One person row in the Status board (name + status dropdown, or "Off shift").
function StatusRow({
  s,
  busy,
  isManager,
  statusOptions,
  labels,
  onChange,
}: {
  s: StatusListItem;
  busy: boolean;
  isManager: boolean;
  statusOptions: { value: string; label: string }[];
  labels: Record<string, string>;
  onChange: (staffId: string, status: string) => void;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-lg border border-line p-2.5 ${
        s.offShift ? "opacity-60" : ""
      }`}
    >
      <span className="truncate font-body text-[13px] font-medium text-navy">
        {s.name}
      </span>
      {s.offShift ? (
        <span className="shrink-0 font-brand text-xs font-bold text-steel/70">
          Off shift
        </span>
      ) : (
        <Select
          value={s.live}
          disabled={busy || !isManager}
          onChange={(e) => onChange(s.id, e.target.value)}
          className="!w-40 !py-1.5 text-xs"
        >
          {(statusOptions.some((o) => o.value === s.live)
            ? statusOptions
            : [{ value: s.live, label: labels[s.live] ?? s.live }, ...statusOptions]
          ).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </div>
  );
}

export default function LiveBoard({
  locations,
  staff,
  isManager,
  statusOptions,
  labels,
}: {
  locations: LocationCardData[];
  staff: StatusListItem[];
  isManager: boolean;
  statusOptions: { value: string; label: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Refresh the board every 60 seconds so the ratio stays current
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(interval);
  }, [router]);

  async function changeStatus(staffId: string, status: string) {
    setBusy(true);
    const result = await setLiveStatus(staffId, status);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  if (locations.length === 0) {
    return (
      <EmptyState message="No shifts scheduled for today. The live board reads from today's published schedule." />
    );
  }

  const row = (s: StatusListItem) => (
    <StatusRow
      key={s.id}
      s={s}
      busy={busy}
      isManager={isManager}
      statusOptions={statusOptions}
      labels={labels}
      onChange={changeStatus}
    />
  );
  const gridClass = "grid gap-2 sm:grid-cols-2 lg:grid-cols-3";
  // At a multi-location pharmacy a single flat list hides who's working where,
  // so group the Status board by location (card order) with an Off-shift group
  // at the end. A single-location pharmacy keeps the simple flat list.
  const multiLocation = locations.length > 1;
  const offShift = staff.filter((s) => s.offShift);

  return (
    <div className="max-w-[1040px] space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard key={loc.locationId} loc={loc} />
        ))}
      </div>

      <Card>
        <h2 className="mb-1 font-brand text-base font-bold text-navy">
          Status board
        </h2>
        <p className="mb-4 font-body text-xs text-steel">
          Changing a status recalculates the ratio instantly.{" "}
          {isManager
            ? "Managers can set anyone's status."
            : "You can set your own status."}
        </p>

        {multiLocation ? (
          <div className="space-y-5">
            {locations.map((loc) => {
              const people = staff.filter(
                (s) => !s.offShift && s.locationId === loc.locationId
              );
              if (people.length === 0) return null;
              return (
                <div key={loc.locationId}>
                  <LocationGroupHead>{loc.locationName}</LocationGroupHead>
                  <div className={gridClass}>{people.map(row)}</div>
                </div>
              );
            })}
            {offShift.length > 0 && (
              <div>
                <LocationGroupHead>Off shift</LocationGroupHead>
                <div className={gridClass}>{offShift.map(row)}</div>
              </div>
            )}
          </div>
        ) : (
          <div className={gridClass}>{staff.map(row)}</div>
        )}
      </Card>
    </div>
  );
}

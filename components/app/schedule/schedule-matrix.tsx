"use client";

// The unified, person-centric schedule matrix: ONE grid across every location.
// Rows = staff; each shift is tagged with its location, so you can see (and the
// engine can flag) a person scheduled across locations or double-booked. This is
// the default scheduling surface — you schedule a person and pick where each
// shift is. Ratio is still per location; publishing still happens per location
// (open a single location to publish it).

import { useEffect, useMemo, useRef, useState } from "react";
import { eachDate } from "@/lib/dates";
import ShiftModal from "./shift-modal";
import { WorkTypeLegend } from "./shift-block";
import ScheduleGrid from "./schedule-grid";
import type { ValidationOut } from "@/lib/schedule-data";
import type {
  Department,
  Location,
  SchedulePeriod,
  Shift,
  ShiftSegment,
  Staff,
  Tenant,
  TimeOffRequest,
  WorkType,
} from "@/lib/types";

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

export default function ScheduleMatrix({
  tenant,
  today,
  viewStart,
  viewEnd,
  periods,
  shifts,
  staff,
  workTypes,
  locations,
  departments,
  approvedTimeOff,
  validation,
  /** When set, show only this location (rows with a shift there); null = all. */
  locationFilter,
}: {
  tenant: Tenant;
  today: string;
  viewStart: string;
  viewEnd: string;
  periods: SchedulePeriod[];
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  locations: Location[];
  departments: Department[];
  approvedTimeOff: TimeOffRequest[];
  validation: ValidationOut;
  locationFilter: string | null;
}) {
  const [editing, setEditing] = useState<{
    staff: Staff;
    date: string;
    shift: ShiftWithSegments | null;
  } | null>(null);

  // Fixed-frame: only the grid scrolls.
  const frameRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      el.style.height = `${Math.max(360, window.innerHeight - top - 24)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const dates = useMemo(() => eachDate(viewStart, viewEnd), [viewStart, viewEnd]);

  const visibleShifts = useMemo(
    () =>
      locationFilter
        ? shifts.filter((s) => s.location_id === locationFilter)
        : shifts,
    [shifts, locationFilter]
  );

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, ShiftWithSegments[]>();
    for (const s of visibleShifts) {
      const key = `${s.staff_id}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [visibleShifts]);

  const timeOffByCell = useMemo(() => {
    const set = new Set<string>();
    for (const t of approvedTimeOff)
      for (const d of eachDate(t.start_date, t.end_date))
        set.add(`${t.staff_id}|${d}`);
    return set;
  }, [approvedTimeOff]);

  const deficientShiftIds = useMemo(() => {
    const out = new Set<string>();
    for (const s of visibleShifts)
      if (validation.deficientCells[s.location_id]?.includes(s.date))
        out.add(s.id);
    return out;
  }, [visibleShifts, validation.deficientCells]);

  const constraintShiftIds = useMemo(
    () =>
      new Set(
        validation.constraintFlags
          .map((f) => f.shift_id)
          .filter((x): x is string => x !== null)
      ),
    [validation.constraintFlags]
  );

  const workTypeById = useMemo(
    () => new Map(workTypes.map((w) => [w.id, w])),
    [workTypes]
  );

  const locationNameById = useMemo(
    () => new Map(locations.map((l) => [l.id, shortLocationName(l.name)])),
    [locations]
  );

  const usedWorkTypeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of visibleShifts)
      for (const seg of s.segments) ids.add(seg.work_type_id ?? "__none__");
    return ids;
  }, [visibleShifts]);

  // Rows: in the all-locations view, show everyone (you schedule against the
  // whole roster). Filtered to one location in VIEW context, show only people
  // actually working there; in edit you still want everyone, so we keep all
  // active staff and let empty rows be schedulable.
  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);

  // For editing, the shift carries its own location + period.
  const periodById = useMemo(
    () => new Map(periods.map((p) => [p.id, p])),
    [periods]
  );

  const editingPeriod = editing?.shift
    ? (periodById.get(editing.shift.schedule_period_id) ?? null)
    : null;
  const editingLocationId = editing?.shift?.location_id ?? locationFilter ?? "";

  return (
    <div ref={frameRef} className="flex h-[calc(100dvh-180px)] flex-col">
      <div className="min-h-0 flex-1">
        <ScheduleGrid
          dates={dates}
          today={today}
          staff={activeStaff}
          shiftsByCell={shiftsByCell}
          timeOffByCell={timeOffByCell}
          deficientShiftIds={deficientShiftIds}
          constraintShiftIds={constraintShiftIds}
          workTypeById={workTypeById}
          locationNameById={locationNameById}
          onCellClick={(person, date, shift) =>
            setEditing({ staff: person, date, shift })
          }
        />
      </div>

      <div className="flex-none pt-3">
        <WorkTypeLegend workTypes={workTypes} usedIds={usedWorkTypeIds} />
      </div>

      {editing && (
        <ShiftModal
          open={true}
          onClose={() => setEditing(null)}
          staff={editing.staff}
          date={editing.date}
          shift={editing.shift}
          period={editingPeriod}
          locationId={editingLocationId}
          departments={departments}
          requireDepartment={tenant.require_department}
          workTypes={workTypes}
          defaultBreakMinutes={tenant.default_break_minutes ?? 30}
          // All-locations create: pick a location, resolve its covering period.
          locationOptions={editing.shift ? undefined : locations}
          periods={periods}
        />
      )}
    </div>
  );
}

/** "SMRX — Southwest Medical Pharmacy" → "SMRX" for a compact cell tag. */
function shortLocationName(name: string): string {
  const dash = name.split(/[—–-]/)[0]?.trim();
  return dash && dash.length <= 12 ? dash : name.slice(0, 12);
}

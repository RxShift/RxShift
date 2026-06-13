"use client";

// Read-mostly multi-period view (week / 2-week / month). Building stays per
// period (the publish unit); this just shows a chosen date window, which may
// span several built periods. Columns are tinted by publish state so the
// employee-visible cutoff is obvious: published vs unpublished draft vs no
// period yet. Clicking a cell still edits — it resolves to the period that
// actually covers that date.

import { useMemo, useState } from "react";
import { eachDate } from "@/lib/dates";
import ShiftModal from "./shift-modal";
import { WorkTypeLegend } from "./shift-block";
import ScheduleGrid, { type DateStatus } from "./schedule-grid";
import type { ValidationOut } from "@/lib/schedule-data";
import type {
  RatioZone,
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

export default function ScheduleRangeView({
  tenant,
  locationId,
  today,
  viewStart,
  viewEnd,
  periods,
  shifts,
  staff,
  workTypes,
  zones,
  approvedTimeOff,
  validation,
}: {
  tenant: Tenant;
  locationId: string;
  today: string;
  viewStart: string;
  viewEnd: string;
  periods: SchedulePeriod[];
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  zones: RatioZone[];
  approvedTimeOff: TimeOffRequest[];
  validation: ValidationOut;
}) {
  const [editing, setEditing] = useState<{
    staff: Staff;
    date: string;
    shift: ShiftWithSegments | null;
    period: SchedulePeriod;
  } | null>(null);

  const dates = useMemo(() => eachDate(viewStart, viewEnd), [viewStart, viewEnd]);

  const activeStaff = useMemo(() => staff.filter((s) => s.active), [staff]);

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, ShiftWithSegments[]>();
    for (const s of shifts) {
      const key = `${s.staff_id}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [shifts]);

  const timeOffByCell = useMemo(() => {
    const set = new Set<string>();
    for (const t of approvedTimeOff) {
      for (const d of eachDate(t.start_date, t.end_date)) {
        set.add(`${t.staff_id}|${d}`);
      }
    }
    return set;
  }, [approvedTimeOff]);

  const deficientShiftIds = useMemo(() => {
    const out = new Set<string>();
    for (const s of shifts) {
      if (!s.ratio_zone_id) continue;
      if (validation.deficientCells[s.ratio_zone_id]?.includes(s.date))
        out.add(s.id);
    }
    return out;
  }, [shifts, validation.deficientCells]);

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

  const usedWorkTypeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of shifts)
      for (const seg of s.segments) ids.add(seg.work_type_id ?? "__none__");
    return ids;
  }, [shifts]);

  // The period covering a given date (used for the column tint AND to bind the
  // shift editor to the correct underlying period).
  const periodForDate = useMemo(() => {
    return (date: string) =>
      periods.find((p) => p.start_date <= date && p.end_date >= date) ?? null;
  }, [periods]);

  const dateStatus = useMemo(() => {
    const map = new Map<string, DateStatus>();
    for (const d of dates) {
      const p = periodForDate(d);
      map.set(d, p ? (p.status as DateStatus) : "none");
    }
    return map;
  }, [dates, periodForDate]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-[11px] text-steel">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border-b-2 border-b-compliant bg-cloud" />
          Published — staff can see it
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm border-b-2 border-b-alert bg-alert-bg" />
          Draft — not visible to staff yet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-5 rounded-sm bg-cloud/40" />
          No period — create one to schedule here
        </span>
      </div>

      <ScheduleGrid
        dates={dates}
        today={today}
        staff={activeStaff}
        shiftsByCell={shiftsByCell}
        timeOffByCell={timeOffByCell}
        deficientShiftIds={deficientShiftIds}
        constraintShiftIds={constraintShiftIds}
        workTypeById={workTypeById}
        dateStatus={dateStatus}
        onCellClick={(person, date, shift) => {
          const period = periodForDate(date);
          if (period) setEditing({ staff: person, date, shift, period });
        }}
      />

      <WorkTypeLegend workTypes={workTypes} usedIds={usedWorkTypeIds} />

      <p className="font-body text-xs text-steel">
        This is a view across periods — building and publishing still happen one
        period at a time. Click any cell inside a published or draft period to
        edit it; the change saves to that period. A red ⚠ badge marks a deficient
        ratio slot.
      </p>

      {editing && (
        <ShiftModal
          open={true}
          onClose={() => setEditing(null)}
          staff={editing.staff}
          date={editing.date}
          shift={editing.shift}
          period={editing.period}
          locationId={locationId}
          zones={zones}
          workTypes={workTypes}
          hasRatio={tenant.has_ratio}
          defaultBreakMinutes={tenant.default_break_minutes ?? 30}
        />
      )}
    </div>
  );
}

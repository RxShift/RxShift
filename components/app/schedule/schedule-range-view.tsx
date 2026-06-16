"use client";

// Read-mostly multi-period view (week / 2-week / month). Building stays per
// period (the publish unit); this just shows a chosen date window, which may
// span several built periods. Columns are tinted by publish state so the
// employee-visible cutoff is obvious: published vs unpublished draft vs no
// period yet. Clicking a cell still edits — it resolves to the period that
// actually covers that date.

import { useEffect, useMemo, useRef, useState } from "react";
import { eachDate } from "@/lib/dates";
import ShiftModal from "./shift-modal";
import { WorkTypeLegend } from "./shift-block";
import ScheduleGrid, { type DateStatus } from "./schedule-grid";
import type { ValidationOut } from "@/lib/schedule-data";
import type {
  Department,
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
  departments,
  requireDepartment,
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
  departments: Department[];
  requireDepartment: boolean;
  approvedTimeOff: TimeOffRequest[];
  validation: ValidationOut;
}) {
  const [editing, setEditing] = useState<{
    staff: Staff;
    date: string;
    shift: ShiftWithSegments | null;
    period: SchedulePeriod;
  } | null>(null);

  // Fixed-frame: only the grid scrolls (single scroll region).
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
      if (validation.deficientCells[s.location_id]?.includes(s.date))
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
  // shift editor to the correct underlying period). If two periods ever overlap
  // a date, prefer the published one — it's what staff see, and an edit should
  // land there, not in a stale draft.
  const periodForDate = useMemo(() => {
    return (date: string) => {
      const matches = periods.filter(
        (p) => p.start_date <= date && p.end_date >= date
      );
      return matches.find((p) => p.status === "published") ?? matches[0] ?? null;
    };
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
    <div ref={frameRef} className="flex h-[calc(100dvh-180px)] flex-col">
      <div className="flex-none flex flex-wrap items-center gap-x-5 gap-y-2 font-body text-[11px] text-steel">
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

      <div className="mt-3 min-h-0 flex-1">
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
          period={editing.period}
          locationId={locationId}
          departments={departments}
          requireDepartment={requireDepartment}
          workTypes={workTypes}
          defaultBreakMinutes={tenant.default_break_minutes ?? 30}
        />
      )}
    </div>
  );
}

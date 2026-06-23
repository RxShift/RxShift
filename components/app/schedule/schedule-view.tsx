"use client";

// Read-only schedule view — the "View Schedule" surface everyone can see.
// It renders the SAME grid as Build (schedule-grid.tsx, no drift), but:
//   • shows ONLY published shifts (drafts stay invisible until published),
//   • has no edit affordance (cells aren't clickable),
//   • has no toolbar (copy / publish / Ask AI) — those are Build-only,
//   • keeps the department + work-type chip filters and the week/2-week/month
//     zoom (the zoom lives on the page, around this component).
// Compliance rings are intentionally omitted here — flags are a manager/Build
// concern; viewers just see who works when.

import { useEffect, useMemo, useRef, useState } from "react";
import { eachDate } from "@/lib/dates";
import ScheduleGrid from "./schedule-grid";
import { shortLocationName } from "./schedule-matrix";
import type {
  Department,
  Location,
  PtoDay,
  Shift,
  ShiftSegment,
  Staff,
  TimeOffRequest,
  WorkType,
} from "@/lib/types";

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

export default function ScheduleView({
  today,
  viewStart,
  viewEnd,
  shifts,
  staff,
  workTypes,
  locations,
  departments,
  approvedTimeOff,
  ptoDays,
  holidaysByDate,
  avatarUrls,
  locationFilter,
}: {
  today: string;
  viewStart: string;
  viewEnd: string;
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  locations: Location[];
  departments: Department[];
  approvedTimeOff: TimeOffRequest[];
  ptoDays: PtoDay[];
  holidaysByDate: Record<string, string>;
  avatarUrls: Record<string, string>;
  locationFilter: string | null;
}) {
  const [deptFilter, setDeptFilter] = useState<Set<string>>(new Set());
  const [workTypeFilter, setWorkTypeFilter] = useState<Set<string>>(new Set());

  function toggleInSet(setter: typeof setWorkTypeFilter, id: string) {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  const toggleWorkType = (id: string) => toggleInSet(setWorkTypeFilter, id);
  const toggleDept = (id: string) => toggleInSet(setDeptFilter, id);

  // Published-only, real shifts (drafts and empty shells never show here).
  const publishedShifts = useMemo(
    () =>
      shifts.filter((s) => s.status === "published" && s.segments.length > 0),
    [shifts]
  );

  const locShifts = useMemo(
    () =>
      locationFilter
        ? publishedShifts.filter((s) => s.location_id === locationFilter)
        : publishedShifts,
    [publishedShifts, locationFilter]
  );

  const visibleShifts = useMemo(() => {
    let list = locShifts;
    if (deptFilter.size > 0)
      list = list.filter(
        (s) => s.department_id != null && deptFilter.has(s.department_id)
      );
    if (workTypeFilter.size > 0)
      list = list.filter((s) =>
        s.segments.some(
          (seg) => seg.work_type_id && workTypeFilter.has(seg.work_type_id)
        )
      );
    return list;
  }, [locShifts, deptFilter, workTypeFilter]);

  const anyFilter =
    !!locationFilter || deptFilter.size > 0 || workTypeFilter.size > 0;

  const windowWorkTypes = useMemo(() => {
    const ids = new Set<string>();
    for (const s of locShifts)
      for (const seg of s.segments)
        if (seg.work_type_id) ids.add(seg.work_type_id);
    return workTypes.filter((w) => ids.has(w.id));
  }, [locShifts, workTypes]);

  const dates = useMemo(() => eachDate(viewStart, viewEnd), [viewStart, viewEnd]);

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
    for (const p of ptoDays) set.add(`${p.staff_id}|${p.date}`);
    return set;
  }, [approvedTimeOff, ptoDays]);

  const holidayMap = useMemo(
    () => new Map(Object.entries(holidaysByDate)),
    [holidaysByDate]
  );

  const workTypeById = useMemo(
    () => new Map(workTypes.map((w) => [w.id, w])),
    [workTypes]
  );

  const locationNameById = useMemo(
    () => new Map(locations.map((l) => [l.id, shortLocationName(l.name)])),
    [locations]
  );

  // Rows: with no filter, the whole active roster (so you see who's off too);
  // filtered, only people who actually have a matching published shift.
  const activeStaff = useMemo(() => {
    const base = staff.filter((s) => s.active);
    if (!anyFilter) return base;
    const scheduled = new Set(visibleShifts.map((s) => s.staff_id));
    return base.filter((s) => scheduled.has(s.id));
  }, [staff, anyFilter, visibleShifts]);

  const EMPTY = useMemo(() => new Set<string>(), []);

  // Fixed-frame: only the grid scrolls (mirrors the build matrix).
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

  return (
    <div ref={frameRef} className="flex h-[calc(100dvh-180px)] flex-col">
      {(departments.length > 0 || windowWorkTypes.length > 0) && (
        <div className="flex flex-none flex-col gap-1.5 pb-2.5 font-body text-[11px]">
          {departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-[74px] shrink-0 font-brand text-[10px] font-bold uppercase tracking-[0.5px] text-steel">
                Departments
              </span>
              {departments.map((d) => {
                const on = deptFilter.has(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleDept(d.id)}
                    className={`rounded-full border px-2.5 py-0.5 font-medium transition-colors ${
                      on
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-surface text-steel hover:text-navy"
                    }`}
                  >
                    {d.name}
                  </button>
                );
              })}
              {deptFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setDeptFilter(new Set())}
                  className="ml-1 text-steel underline underline-offset-2 hover:text-navy"
                >
                  clear
                </button>
              )}
            </div>
          )}
          {windowWorkTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-[74px] shrink-0 font-brand text-[10px] font-bold uppercase tracking-[0.5px] text-steel">
                Work types
              </span>
              {windowWorkTypes.map((w) => {
                const on = workTypeFilter.has(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorkType(w.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition-colors ${
                      on
                        ? "border-navy bg-navy text-white"
                        : "border-line bg-surface text-steel hover:text-navy"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: w.color ?? "#5B6B82" }}
                    />
                    {w.name}
                  </button>
                );
              })}
              {workTypeFilter.size > 0 && (
                <button
                  type="button"
                  onClick={() => setWorkTypeFilter(new Set())}
                  className="ml-1 text-steel underline underline-offset-2 hover:text-navy"
                >
                  clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1">
        <ScheduleGrid
          dates={dates}
          today={today}
          staff={activeStaff}
          shiftsByCell={shiftsByCell}
          timeOffByCell={timeOffByCell}
          deficientShiftIds={EMPTY}
          constraintShiftIds={EMPTY}
          workTypeById={workTypeById}
          holidaysByDate={holidayMap}
          locationNameById={locationNameById}
          avatarUrlById={avatarUrls}
          onCellClick={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}

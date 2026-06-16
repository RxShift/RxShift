"use client";

// The unified, person-centric schedule matrix: ONE grid across every location.
// Rows = staff; each shift is tagged with its location, so you can see (and the
// engine can flag) a person scheduled across locations or double-booked. This is
// the default scheduling surface — you schedule a person and pick where each
// shift is. Ratio is still per location; publishing still happens per location
// (open a single location to publish it).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { eachDate } from "@/lib/dates";
import { copyForwardWindow, publishWindow } from "@/lib/actions/schedule";
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
  const router = useRouter();
  const [editing, setEditing] = useState<{
    staff: Staff;
    date: string;
    shift: ShiftWithSegments | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCopy, setConfirmCopy] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);

  const flagCount =
    validation.ratioFlags.length + validation.constraintFlags.length;

  async function runPublish(overrideReason: string | null) {
    setBusy(true);
    setToolError(null);
    const result = await publishWindow(
      viewStart,
      viewEnd,
      locationFilter,
      overrideReason
    );
    setBusy(false);
    if (result.ok) {
      setPublishOpen(false);
      setReason("");
      router.refresh();
    } else {
      setToolError(result.error);
      setPublishOpen(true); // surface the reason prompt
    }
  }

  async function handleCopy() {
    setBusy(true);
    setToolError(null);
    const result = await copyForwardWindow(viewStart, viewEnd, locationFilter);
    setBusy(false);
    setConfirmCopy(false);
    if (result.ok) router.refresh();
    else alert(result.error);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const staffById = new Map(staff.map((s) => [s.id, s.full_name]));
    const locById = new Map(locations.map((l) => [l.id, l.name]));
    const header = ["Staff", "Location", "Date", "Shift"].join(",");
    const lines = [...visibleShifts]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((sh) => {
        const times = sh.segments
          .map(
            (seg) =>
              `${String(seg.start_time).slice(0, 5)}-${String(seg.end_time).slice(0, 5)}`
          )
          .join(" / ");
        return [
          esc(staffById.get(sh.staff_id) ?? ""),
          esc(locById.get(sh.location_id) ?? ""),
          sh.date,
          esc(times),
        ].join(",");
      });
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${viewStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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

  // Rows: All Locations shows the whole roster (it's where you build). Filtered
  // to one location, it's a view — show only people actually scheduled there
  // (add someone new from All Locations).
  const activeStaff = useMemo(() => {
    const base = staff.filter((s) => s.active);
    if (!locationFilter) return base;
    const scheduledIds = new Set(visibleShifts.map((s) => s.staff_id));
    return base.filter((s) => scheduledIds.has(s.id));
  }, [staff, locationFilter, visibleShifts]);

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
      <div className="flex flex-none flex-wrap items-center gap-3 pb-3">
        {flagCount > 0 && (
          <span className="font-body text-[13px] font-semibold text-deficiency">
            ⚠ {flagCount} open flag{flagCount === 1 ? "" : "s"}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setConfirmCopy(true)}
            disabled={busy}
          >
            Copy last week&rsquo;s pattern
          </Button>
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          <Button
            onClick={() => (flagCount > 0 ? setPublishOpen(true) : runPublish(null))}
            disabled={busy}
          >
            {busy ? "Working…" : "Publish"}
          </Button>
        </div>
      </div>

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

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish this schedule?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => runPublish(reason || null)} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      >
        <p>
          Publishing makes this {viewStart === viewEnd ? "day" : "window"} visible
          to staff and generates the hourly compliance record
          {locationFilter ? "" : " for every location"}.
        </p>
        {flagCount > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-medium text-deficiency">
              {flagCount} flag{flagCount === 1 ? "" : "s"} will be overridden. A
              reason is required and goes in the override log.
            </p>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is it acceptable to publish with these flags?"
            />
          </div>
        )}
        {toolError && (
          <p className="mt-3 font-body text-sm text-deficiency">{toolError}</p>
        )}
      </Modal>

      <Modal
        open={confirmCopy}
        onClose={() => setConfirmCopy(false)}
        title="Copy last week's pattern?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCopy(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopy} disabled={busy}>
              {busy ? "Copying…" : "Copy forward"}
            </Button>
          </>
        }
      >
        <p>
          This copies the previous window&rsquo;s shifts into this one for{" "}
          {locationFilter ? "this location" : "every location"}, skipping any
          cell that already has a shift.
        </p>
      </Modal>
    </div>
  );
}

/** "SMRX — Southwest Medical Pharmacy" → "SMRX" for a compact cell tag. */
function shortLocationName(name: string): string {
  const dash = name.split(/[—–-]/)[0]?.trim();
  return dash && dash.length <= 12 ? dash : name.slice(0, 12);
}

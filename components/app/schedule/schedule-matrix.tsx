"use client";

// The unified, person-centric schedule matrix: ONE grid across every location.
// Rows = staff; each shift is tagged with its location, so you can see (and the
// engine can flag) a person scheduled across locations or double-booked. This is
// the default scheduling surface — you schedule a person and pick where each
// shift is. Ratio is still per location; publishing still happens per location
// (open a single location to publish it).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { addDaysStr, eachDate } from "@/lib/dates";
import { copyForwardWindow, publishWindow } from "@/lib/actions/schedule";
import { BUILD_MODE_EVENT, isBuildMode, setBuildMode } from "@/lib/build-mode";
import ShiftModal from "./shift-modal";
import AiCommandBar from "./ai-command-bar";
import { WorkTypeLegend } from "./shift-block";
import ScheduleGrid, { type DateStatus } from "./schedule-grid";
import type { ValidationOut } from "@/lib/schedule-data";
import type {
  Department,
  Location,
  PtoDay,
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
  ptoDays,
  holidaysByDate,
  validation,
  avatarUrls,
  /** When set, show only this location (rows with a shift there); null = all. */
  locationFilter,
  /** Current view + anchor, so build mode's command strip can build nav links. */
  view,
  anchor,
  aiPeriodId,
  aiLocationId,
  aiRefDate,
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
  ptoDays: PtoDay[];
  /** Date (yyyy-mm-dd) → holiday name, for the column tint/label. */
  holidaysByDate: Record<string, string>;
  validation: ValidationOut;
  avatarUrls: Record<string, string>;
  locationFilter: string | null;
  view: string;
  anchor: string;
  aiPeriodId: string | null;
  aiLocationId: string | null;
  aiRefDate: string;
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
  const [flagsOpen, setFlagsOpen] = useState(false);
  // Pure view filters (what do I want to look at) — no scheduling effect.
  const [deptFilter, setDeptFilter] = useState(""); // "" = all departments
  const [workTypeFilter, setWorkTypeFilter] = useState<Set<string>>(new Set());

  // Build mode = the focused, chrome-free surface. When on, the four stacked
  // control rows collapse into one command strip (below) and the page chrome
  // hides via CSS, so the grid fills the screen. Driven by the shared helper so
  // the sidebar toggle and the strip's Exit button stay in sync.
  const [buildMode, setBuildModeState] = useState(false);
  useEffect(() => {
    const sync = () => setBuildModeState(isBuildMode());
    sync();
    window.addEventListener(BUILD_MODE_EVENT, sync);
    return () => window.removeEventListener(BUILD_MODE_EVENT, sync);
  }, []);

  function toggleWorkType(id: string) {
    setWorkTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

  // Per-day publish state across the window. For All Locations it's "worst-wins":
  // if ANY location-period covering a day is still draft, that whole column reads
  // draft — so a week that straddles a published/draft (or month) boundary shows
  // the truth per day instead of being collapsed into one "Published ✓".
  const dateStatus = useMemo<Map<string, DateStatus>>(() => {
    const relevant = locationFilter
      ? periods.filter((p) => p.location_id === locationFilter)
      : periods;
    const map = new Map<string, DateStatus>();
    for (const d of dates) {
      const covering = relevant.filter(
        (p) => p.start_date <= d && p.end_date >= d
      );
      if (covering.length === 0) map.set(d, "none");
      else if (covering.some((p) => p.status === "draft")) map.set(d, "draft");
      else map.set(d, "published");
    }
    return map;
  }, [dates, periods, locationFilter]);

  // Honest status pill derived from the per-day map — a partly published window
  // shows "N/M days published", never a misleading single "Published ✓".
  const { hasDraft, statusLabel, statusShort, statusTone } = useMemo(() => {
    let published = 0;
    let draft = 0;
    let none = 0;
    for (const d of dates) {
      const s = dateStatus.get(d);
      if (s === "published") published++;
      else if (s === "draft") draft++;
      else none++;
    }
    const total = dates.length;
    const hasDraft = draft > 0;
    if (published + draft === 0)
      return {
        hasDraft,
        statusLabel: "Nothing scheduled here yet",
        statusShort: "Empty",
        statusTone: "neutral" as const,
      };
    if (published === total)
      return {
        hasDraft,
        statusLabel: "Published — visible to staff",
        statusShort: "Published ✓",
        statusTone: "published" as const,
      };
    if (draft > 0 && published === 0 && none === 0)
      return {
        hasDraft,
        statusLabel: "Draft — not visible to staff yet",
        statusShort: "Draft",
        statusTone: "draft" as const,
      };
    return {
      hasDraft,
      statusLabel: `${published}/${total} days published`,
      statusShort: `${published}/${total} published`,
      statusTone: "draft" as const,
    };
  }, [dates, dateStatus]);

  const statusCls =
    statusTone === "published"
      ? "bg-compliant-bg text-compliant"
      : statusTone === "draft"
        ? "bg-alert-bg text-alert"
        : "bg-cloud text-steel";

  // Location-scoped shifts (drives the work-type chips so they stay stable).
  // A shift with no segments has nothing to draw (no time, no work type); render
  // it and you get a phantom location tag over an empty block. Real shifts always
  // have ≥1 segment (enforced on save), so dropping segment-less ones only hides
  // broken artifacts — never legitimate data.
  const locShifts = useMemo(() => {
    const real = shifts.filter((s) => s.segments.length > 0);
    return locationFilter
      ? real.filter((s) => s.location_id === locationFilter)
      : real;
  }, [shifts, locationFilter]);

  const visibleShifts = useMemo(() => {
    let list = locShifts;
    if (deptFilter) list = list.filter((s) => s.department_id === deptFilter);
    if (workTypeFilter.size > 0)
      list = list.filter((s) =>
        s.segments.some(
          (seg) => seg.work_type_id && workTypeFilter.has(seg.work_type_id)
        )
      );
    return list;
  }, [locShifts, deptFilter, workTypeFilter]);

  const anyFilter =
    !!locationFilter || !!deptFilter || workTypeFilter.size > 0;

  const windowWorkTypes = useMemo(() => {
    const ids = new Set<string>();
    for (const s of locShifts)
      for (const seg of s.segments)
        if (seg.work_type_id) ids.add(seg.work_type_id);
    return workTypes.filter((w) => ids.has(w.id));
  }, [locShifts, workTypes]);

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

  // PTO cells = approved time-off ranges UNION direct pto_day rows. Both render
  // identically (blacked out); pto_day is the write target going forward.
  const timeOffByCell = useMemo(() => {
    const set = new Set<string>();
    for (const t of approvedTimeOff)
      for (const d of eachDate(t.start_date, t.end_date))
        set.add(`${t.staff_id}|${d}`);
    for (const p of ptoDays) set.add(`${p.staff_id}|${p.date}`);
    return set;
  }, [approvedTimeOff, ptoDays]);

  // The pto_day record per cell (for the editor's "Remove PTO" + reason).
  const ptoByCell = useMemo(
    () => new Map(ptoDays.map((p) => [`${p.staff_id}|${p.date}`, p])),
    [ptoDays]
  );

  const holidayMap = useMemo(
    () => new Map(Object.entries(holidaysByDate)),
    [holidaysByDate]
  );

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

  // Informational expected daily Rx volume per column (Decision 4 — shown, never
  // enforced). Scoped to the filtered location, or summed across all locations.
  const expectedRxByDate = useMemo(() => {
    const scoped = locationFilter
      ? locations.filter((l) => l.id === locationFilter)
      : locations;
    const fieldByDow: Record<number, keyof Location> = {
      0: "expected_rx_sun",
      1: "expected_rx_mon",
      2: "expected_rx_tue",
      3: "expected_rx_wed",
      4: "expected_rx_thu",
      5: "expected_rx_fri",
      6: "expected_rx_sat",
    };
    const map = new Map<string, number>();
    for (const d of dates) {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      const field = fieldByDow[dow];
      let sum = 0;
      let any = false;
      for (const loc of scoped) {
        const v = loc[field] as number | null | undefined;
        if (v != null) {
          sum += v;
          any = true;
        }
      }
      if (any) map.set(d, sum);
    }
    return map;
  }, [dates, locations, locationFilter]);

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
    if (!anyFilter) return base;
    const scheduledIds = new Set(visibleShifts.map((s) => s.staff_id));
    // A plain location filter (no dept/work-type filter) is also a BUILD surface:
    // show that location's HOME team even with no shifts yet, so an empty or
    // not-yet-built week is still buildable. Without this, a filtered empty week
    // has zero rows and there's nothing to click to add anyone.
    const showHomeTeam =
      !!locationFilter && !deptFilter && workTypeFilter.size === 0;
    return base.filter(
      (s) =>
        scheduledIds.has(s.id) ||
        (showHomeTeam && s.home_location_id === locationFilter)
    );
  }, [staff, anyFilter, visibleShifts, locationFilter, deptFilter, workTypeFilter]);

  // For editing, the shift carries its own location + period.
  const periodById = useMemo(
    () => new Map(periods.map((p) => [p.id, p])),
    [periods]
  );

  const editingPeriod = editing?.shift
    ? (periodById.get(editing.shift.schedule_period_id) ?? null)
    : null;
  const editingLocationId = editing?.shift?.location_id ?? locationFilter ?? "";

  // Command-strip nav (build mode). The day just before the window lands in the
  // previous window; the day just after lands in the next — works uniformly for
  // week / 2-week / month without per-view math.
  const prevAnchor = addDaysStr(viewStart, -1);
  const nextAnchor = addDaysStr(viewEnd, 1);
  const schedHref = (v: string, loc: string | null, a: string) =>
    `/app/schedule?view=${v}${loc ? `&location=${loc}` : ""}&anchor=${a}`;
  const stripNavCls =
    "rounded-md border border-line bg-surface px-2.5 py-1 font-body text-[13px] font-medium text-navy transition-colors hover:border-navy";
  const pillCls = (active: boolean) =>
    `rounded-md px-2.5 py-1 font-brand text-[12px] font-semibold transition-colors ${
      active
        ? "bg-navy text-white"
        : "border border-line bg-surface text-steel hover:text-navy"
    }`;

  return (
    <div ref={frameRef} className="flex h-[calc(100dvh-180px)] flex-col">
      {buildMode ? (
        // ONE command strip: everything you need to build, in a single ~44px bar.
        // Date nav · view · location · status · flags · Ask AI · actions · Exit.
        <div className="flex flex-none flex-wrap items-center gap-2 pb-2">
          <div className="flex items-center gap-1">
            <Link
              href={schedHref(view, locationFilter, prevAnchor)}
              className={stripNavCls}
              title="Previous window"
              aria-label="Previous window"
            >
              ◀
            </Link>
            <Link
              href={schedHref(view, locationFilter, today)}
              className={stripNavCls}
            >
              Today
            </Link>
            <Link
              href={schedHref(view, locationFilter, nextAnchor)}
              className={stripNavCls}
              title="Next window"
              aria-label="Next window"
            >
              ▶
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <Link href={schedHref("week", locationFilter, anchor)} className={pillCls(view === "week")}>
              Wk
            </Link>
            <Link href={schedHref("2week", locationFilter, anchor)} className={pillCls(view === "2week")}>
              2wk
            </Link>
            <Link href={schedHref("month", locationFilter, anchor)} className={pillCls(view === "month")}>
              Mo
            </Link>
          </div>

          {locations.length > 1 && (
            <select
              value={locationFilter ?? ""}
              onChange={(e) =>
                router.push(schedHref(view, e.target.value || null, anchor))
              }
              className="rounded-md border-[1.5px] border-line bg-surface px-2 py-1 font-body text-[13px] text-navy"
              title="Filter to a location (All locations is the build surface)"
            >
              <option value="">All locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {shortLocationName(l.name)}
                </option>
              ))}
            </select>
          )}

          <span
            className={`rounded-full px-2.5 py-1 font-brand text-[11px] font-bold uppercase tracking-[0.5px] ${statusCls}`}
            title={statusLabel}
          >
            {statusShort}
          </span>
          {flagCount > 0 && (
            <button
              type="button"
              onClick={() => setFlagsOpen(true)}
              className="font-body text-[13px] font-semibold text-deficiency underline-offset-2 hover:underline"
              title="Open flags"
            >
              ⚠ {flagCount} ▸
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {aiLocationId && (
              // No contextNote in the strip — the location dropdown + date nav
              // already say where/when, and the long note wrapped the strip.
              <AiCommandBar
                periodId={aiPeriodId}
                locationId={aiLocationId}
                refDate={aiRefDate}
                contextNote=""
              />
            )}
            <Button
              variant="secondary"
              onClick={() => setConfirmCopy(true)}
              disabled={busy}
              title="Copy last week's weekday pattern into this window"
            >
              Copy
            </Button>
            <Button variant="secondary" onClick={exportCsv} title="Export CSV">
              Export
            </Button>
            <Button
              onClick={() =>
                flagCount > 0 ? setPublishOpen(true) : runPublish(null)
              }
              disabled={busy || !hasDraft}
            >
              {busy
                ? "Working…"
                : hasDraft
                  ? "Publish"
                  : statusTone === "published"
                    ? "Published ✓"
                    : "Publish"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setBuildMode(false)}
              title="Exit build mode"
            >
              ⤢ Exit
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-none flex-wrap items-center gap-3 pb-3">
          <span
            className={`rounded-full px-2.5 py-1 font-brand text-[11px] font-bold uppercase tracking-[0.5px] ${statusCls}`}
          >
            {statusLabel}
          </span>
          {flagCount > 0 && (
            <button
              type="button"
              onClick={() => setFlagsOpen(true)}
              className="font-body text-[13px] font-semibold text-deficiency underline-offset-2 hover:underline"
            >
              ⚠ {flagCount} open flag{flagCount === 1 ? "" : "s"} ▸
            </button>
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
              disabled={busy || !hasDraft}
            >
              {busy
                ? "Working…"
                : hasDraft
                  ? "Publish"
                  : statusTone === "published"
                    ? "Published ✓"
                    : "Publish"}
            </Button>
          </div>
        </div>
      )}

      {/* View filters — what do I want to look at (no scheduling effect). */}
      {!buildMode && (departments.length > 0 || windowWorkTypes.length > 0) && (
        <div className="flex flex-none flex-wrap items-center gap-2 pb-3 font-body text-[12px]">
          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-md border-[1.5px] border-line bg-surface px-2.5 py-1.5 text-navy"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          {windowWorkTypes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-steel">Work type:</span>
              {windowWorkTypes.map((w) => {
                const on = workTypeFilter.has(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggleWorkType(w.id)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition-colors ${
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
          deficientShiftIds={deficientShiftIds}
          constraintShiftIds={constraintShiftIds}
          workTypeById={workTypeById}
          dateStatus={dateStatus}
          holidaysByDate={holidayMap}
          locationNameById={locationNameById}
          expectedRxByDate={expectedRxByDate}
          avatarUrlById={avatarUrls}
          onCellClick={(person, date, shift) =>
            setEditing({ staff: person, date, shift })
          }
        />
      </div>

      {!buildMode && (
        <div className="flex-none pt-3">
          <WorkTypeLegend workTypes={workTypes} usedIds={usedWorkTypeIds} />
        </div>
      )}

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
          existingPto={
            ptoByCell.get(`${editing.staff.id}|${editing.date}`) ?? null
          }
          ptoReasonRequired={tenant.pto_reason_required}
          viewEnd={viewEnd}
        />
      )}

      <Modal
        open={flagsOpen}
        onClose={() => setFlagsOpen(false)}
        title={`Open flags (${flagCount})`}
        footer={
          <Button variant="secondary" onClick={() => setFlagsOpen(false)}>
            Close
          </Button>
        }
      >
        {flagCount === 0 ? (
          <p className="font-body text-sm text-steel">No open flags.</p>
        ) : (
          <div className="max-h-[60vh] space-y-4 overflow-auto">
            {validation.ratioFlags.length > 0 && (
              <div>
                <p className="font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-deficiency">
                  Ratio
                </p>
                <ul className="mt-1.5 space-y-1.5 font-body text-[13px] text-navy">
                  {validation.ratioFlags.map((f, i) => (
                    <li key={`r${i}`}>
                      <span className="font-medium">{f.location_name}</span> ·{" "}
                      {f.date} {f.slot_label}: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {validation.constraintFlags.length > 0 && (
              <div>
                <p className="font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-alert">
                  Hours &amp; constraints
                </p>
                <ul className="mt-1.5 space-y-1.5 font-body text-[13px] text-navy">
                  {validation.constraintFlags.map((f, i) => (
                    <li key={`c${i}`}>
                      <span className="font-medium">
                        {f.rule_type.replace(/_/g, " ")}
                      </span>{" "}
                      · {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish this schedule?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => runPublish(reason || null)}
              disabled={busy || (flagCount > 0 && reason.trim().length < 3)}
            >
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      >
        <p>
          Publishing makes this {viewStart === viewEnd ? "day" : "window"} visible
          to staff and drives the Coverage Forecast
          {locationFilter ? "" : " for every location"}. The Compliance Record
          then finalizes hour by hour as the day passes.
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

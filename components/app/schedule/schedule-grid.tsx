"use client";

// The shared spreadsheet grid: rows = staff (banded by role), columns = days.
//
// Sticky behavior: the staff-name column freezes on horizontal scroll and the
// date header freezes on vertical scroll, like a spreadsheet. Two things make
// this work:
//   1. `border-separate` on the table — Chrome silently ignores
//      `position: sticky` on cells in a `border-collapse` table.
//   2. This container `h-full overflow-auto` FILLS a bounded flex parent, so
//      both axes scroll *inside* it. That pins the header to the top of the grid
//      (not off-screen) and keeps the horizontal scrollbar at the grid's bottom
//      edge, always on screen. The caller must give it a bounded height — it
//      lives inside a fixed-frame flex column (header `flex-none`, grid
//      `flex-1 min-h-0`). Do NOT let the page document-scroll around it, or the
//      sticky header sticks to a box that itself scrolls away.
//
// Used by the schedule builder (single editable period) and the range view
// (week / 2-week / month across periods). The caller owns the data maps and
// what a cell click does; this component owns layout + sticky + banding.

import { Fragment, useEffect, useRef } from "react";
import { fmtDay } from "@/lib/dates";
import Avatar from "@/components/app/avatar";
import ShiftBlock from "./shift-block";
import type { Shift, ShiftSegment, Staff, WorkType } from "@/lib/types";

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

/** Per-column publish state, used by the range view to show the cutoff. */
export type DateStatus = "published" | "draft" | "none";

// Holiday column treatment, applied to every cell in a holiday column (header +
// body) as an INLINE style so it composes over each cell's own state background
// (draft amber, PTO, empty) and can't be overridden by Tailwind's border-color
// class ordering: a translucent tint overlay (background-IMAGE layers over the
// state background-COLOR) plus inset left/right accent lines that frame the column.
const HOLIDAY_CELL_STYLE = {
  backgroundImage:
    "linear-gradient(var(--color-holiday-overlay), var(--color-holiday-overlay))",
  boxShadow:
    "inset 1px 0 0 var(--color-holiday), inset -1px 0 0 var(--color-holiday)",
} as const;

export default function ScheduleGrid({
  dates,
  today,
  staff,
  shiftsByCell,
  timeOffByCell,
  deficientShiftIds,
  constraintShiftIds,
  workTypeById,
  dateStatus,
  holidaysByDate,
  locationNameById,
  expectedRxByDate,
  avatarUrlById,
  onCellClick,
  readOnly = false,
}: {
  dates: string[];
  today: string;
  staff: Staff[];
  shiftsByCell: Map<string, ShiftWithSegments[]>;
  timeOffByCell: Set<string>;
  deficientShiftIds: Set<string>;
  constraintShiftIds: Set<string>;
  workTypeById: Map<string, WorkType>;
  /** Optional per-date publish state — when set, columns are tinted/labeled. */
  dateStatus?: Map<string, DateStatus>;
  /** Date → holiday name. Tints + labels the column; never blocks staffing. */
  holidaysByDate?: Map<string, string>;
  /** When set (all-locations view), each shift shows a location tag. */
  locationNameById?: Map<string, string>;
  /** Informational expected Rx volume per date (Decision 4 — display only). */
  expectedRxByDate?: Map<string, number>;
  /** When set, an avatar (photo or initials) shows before each staff name. */
  avatarUrlById?: Record<string, string>;
  onCellClick: (staff: Staff, date: string, shift: ShiftWithSegments | null) => void;
  /** Read-only (View Schedule): no cursor/hover affordance, cells aren't clickable. */
  readOnly?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLSpanElement>(null);

  // On open, land TODAY flush against the right edge of the frozen staff column,
  // so the grid opens on "today → forward" with no manual horizontal scrolling (a
  // mid-month view otherwise starts on the 1st, hiding the days that matter).
  // Horizontal only — no vertical jump.
  useEffect(() => {
    const scroller = scrollRef.current;
    const todaySpan = todayRef.current;
    if (!scroller || !todaySpan || !dates.includes(today)) return;
    const th = todaySpan.closest("th");
    if (!th) return;
    const staffTh = scroller.querySelector("thead th");
    const staffWidth = staffTh ? staffTh.getBoundingClientRect().width : 180;
    const offset =
      th.getBoundingClientRect().left -
      scroller.getBoundingClientRect().left -
      staffWidth;
    scroller.scrollLeft += offset; // clamps at 0 / max automatically
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rows banded by role: pharmacists, then technicians, then everyone else.
  const bands = [
    { label: "Pharmacists", staff: staff.filter((s) => s.ratio_type === "pharmacist") },
    { label: "Technicians", staff: staff.filter((s) => s.ratio_type === "technician") },
    { label: "Other staff", staff: staff.filter((s) => s.ratio_type === "non_counting") },
  ].filter((b) => b.staff.length > 0);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-auto rounded-[10px] border border-line bg-surface shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
    >
      {/* table-fixed: every column is a uniform width and long cell content
          (e.g. a work-type name like "CCC (Clinical Call Center)") truncates
          instead of widening its column. */}
      <table className="w-full table-fixed border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 w-[180px] border-b border-r border-line bg-cloud px-3 py-2 text-left font-brand text-[9.5px] font-bold uppercase tracking-[1px] text-steel">
              Staff
            </th>
            {dates.map((d) => {
              const day = fmtDay(d);
              const isWeekend = day.dow === "Sat" || day.dow === "Sun";
              const status = dateStatus?.get(d);
              const isToday = d === today;
              const holiday = holidaysByDate?.get(d);
              return (
                <th
                  key={d}
                  className={`sticky top-0 z-20 w-[120px] border-b border-line bg-cloud px-2 py-2 text-center font-brand text-[9.5px] font-bold uppercase tracking-[0.5px] ${
                    status === "draft"
                      ? "border-b-2 border-b-alert"
                      : status === "published"
                        ? "border-b-2 border-b-compliant"
                        : ""
                  } ${isWeekend ? "text-steel/70" : "text-steel"}`}
                  style={holiday ? HOLIDAY_CELL_STYLE : undefined}
                >
                  <span ref={isToday ? todayRef : undefined}>
                    {day.dow}
                    <br />
                    <span
                      className={`font-body text-[10px] font-medium normal-case tracking-normal ${
                        isToday ? "font-bold text-amber" : ""
                      }`}
                    >
                      {day.label}
                    </span>
                  </span>
                  {status === "draft" && (
                    <span className="mt-0.5 block font-body text-[8px] font-semibold normal-case tracking-normal text-alert">
                      Draft
                    </span>
                  )}
                  {status === "none" && (
                    <span className="mt-0.5 block font-body text-[8px] font-medium normal-case tracking-normal text-steel/60">
                      No period
                    </span>
                  )}
                  {holiday && (
                    <span
                      className="mt-0.5 flex items-center justify-center gap-0.5 font-body text-[8px] font-bold normal-case tracking-normal text-holiday"
                      title={holiday}
                    >
                      <span aria-hidden>★</span>
                      <span className="truncate">{holiday}</span>
                    </span>
                  )}
                  {expectedRxByDate?.get(d) != null && (
                    <span
                      className="mt-0.5 block font-body text-[8px] font-medium normal-case tracking-normal text-steel/70"
                      title="Expected prescription volume (informational — not enforced)"
                    >
                      Rx {expectedRxByDate.get(d)}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {bands.map((band) => (
            <Fragment key={band.label}>
              <tr>
                <td className="sticky left-0 z-10 border-b border-r border-line bg-cloud px-3 py-1 font-brand text-[9px] font-bold uppercase tracking-[1.2px] text-steel">
                  {band.label} ({band.staff.length})
                </td>
                <td colSpan={dates.length} className="border-b border-line bg-cloud" />
              </tr>
              {band.staff.map((person) => (
                <tr key={person.id}>
                  <td className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      {avatarUrlById && (
                        <Avatar
                          url={avatarUrlById[person.id]}
                          name={person.full_name}
                          size={24}
                        />
                      )}
                      <span className="font-body text-[13px] font-medium text-navy">
                        {person.full_name}
                      </span>
                      {person.ratio_type === "technician" &&
                        person.certified && (
                          <span className="font-body text-[10px] text-steel">
                            CPhT
                          </span>
                        )}
                    </div>
                  </td>
                  {dates.map((d) => {
                    const key = `${person.id}|${d}`;
                    const cellShifts = shiftsByCell.get(key) ?? [];
                    const hasPto = timeOffByCell.has(key);
                    const noPeriod = dateStatus?.get(d) === "none";
                    const isDraft = dateStatus?.get(d) === "draft";
                    const isHoliday = holidaysByDate?.has(d) ?? false;

                    const hover = readOnly ? "" : "hover:bg-navy/[0.04]";
                    return (
                      <td
                        key={d}
                        onClick={
                          readOnly ? undefined : () => onCellClick(person, d, null)
                        }
                        className={`w-[120px] border-b border-line px-1.5 py-1.5 text-center align-top transition-colors ${
                          readOnly ? "cursor-default" : "cursor-pointer"
                        } ${
                          hasPto
                            ? "bg-[#222a38]"
                            : isDraft
                              ? `bg-alert-bg ${hover}`
                              : noPeriod
                                ? `bg-cloud/40 ${hover}`
                                : hover
                        }`}
                        style={isHoliday ? HOLIDAY_CELL_STYLE : undefined}
                        title={
                          hasPto
                            ? "Time off (PTO) — click to edit or remove"
                            : noPeriod
                              ? "Not built yet — scheduling here creates this period."
                              : undefined
                        }
                      >
                        {hasPto && (
                          <span className="block py-1 font-brand text-[10px] font-bold uppercase tracking-[1.5px] text-white/85">
                            PTO
                          </span>
                        )}
                        {cellShifts.length > 0 && (
                          <div className="space-y-1">
                            {cellShifts.map((sh) => (
                              <div
                                key={sh.id}
                                onClick={
                                  readOnly
                                    ? undefined
                                    : (e) => {
                                        e.stopPropagation();
                                        onCellClick(person, d, sh);
                                      }
                                }
                              >
                                {locationNameById && (
                                  <span className="mb-0.5 block truncate font-brand text-[8px] font-bold uppercase tracking-[0.5px] text-steel">
                                    {locationNameById.get(sh.location_id) ?? ""}
                                  </span>
                                )}
                                <ShiftBlock
                                  segments={sh.segments}
                                  workTypeById={workTypeById}
                                  deficient={deficientShiftIds.has(sh.id)}
                                  constrained={constraintShiftIds.has(sh.id)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

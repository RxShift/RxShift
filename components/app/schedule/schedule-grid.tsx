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
  locationNameById,
  expectedRxByDate,
  avatarUrlById,
  onCellClick,
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
  /** When set (all-locations view), each shift shows a location tag. */
  locationNameById?: Map<string, string>;
  /** Informational expected Rx volume per date (Decision 4 — display only). */
  expectedRxByDate?: Map<string, number>;
  /** When set, an avatar (photo or initials) shows before each staff name. */
  avatarUrlById?: Record<string, string>;
  onCellClick: (staff: Staff, date: string, shift: ShiftWithSegments | null) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLSpanElement>(null);

  // On open, center today's column so a mid-month view doesn't start on the 1st.
  useEffect(() => {
    if (todayRef.current && dates.includes(today)) {
      todayRef.current.scrollIntoView({
        inline: "center",
        block: "nearest",
      });
    }
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
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-30 min-w-[160px] border-b border-r border-line bg-cloud px-3 py-2 text-left font-brand text-[9.5px] font-bold uppercase tracking-[1px] text-steel">
              Staff
            </th>
            {dates.map((d) => {
              const day = fmtDay(d);
              const isWeekend = day.dow === "Sat" || day.dow === "Sun";
              const status = dateStatus?.get(d);
              const isToday = d === today;
              return (
                <th
                  key={d}
                  className={`sticky top-0 z-20 min-w-[92px] border-b border-line bg-cloud px-2 py-2 text-center font-brand text-[9.5px] font-bold uppercase tracking-[0.5px] ${
                    status === "draft"
                      ? "border-b-2 border-b-alert"
                      : status === "published"
                        ? "border-b-2 border-b-compliant"
                        : ""
                  } ${isWeekend ? "text-steel/70" : "text-steel"}`}
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

                    return (
                      <td
                        key={d}
                        onClick={
                          noPeriod ? undefined : () => onCellClick(person, d, null)
                        }
                        className={`border-b border-line px-1.5 py-1.5 text-center align-top transition-colors ${
                          noPeriod
                            ? "cursor-not-allowed bg-cloud/40"
                            : "cursor-pointer hover:bg-navy/[0.04]"
                        } ${hasPto ? "bg-cloud" : isDraft ? "bg-alert-bg" : ""}`}
                        title={
                          noPeriod
                            ? "No schedule period covers this date — create the next period to schedule here."
                            : undefined
                        }
                      >
                        {hasPto && (
                          <span className="block font-brand text-[9px] font-bold uppercase tracking-[0.5px] text-steel">
                            PTO
                          </span>
                        )}
                        {cellShifts.length > 0 && (
                          <div className="space-y-1">
                            {cellShifts.map((sh) => (
                              <div
                                key={sh.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCellClick(person, d, sh);
                                }}
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

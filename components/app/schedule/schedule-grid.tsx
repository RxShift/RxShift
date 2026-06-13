"use client";

// The shared spreadsheet grid: rows = staff (banded by role), columns = days.
//
// Sticky behavior (the part that used to be broken): the staff-name column
// freezes on horizontal scroll and the date header freezes on vertical scroll,
// like a spreadsheet. This ONLY works because the table uses
// `border-separate` — Chrome silently ignores `position: sticky` on cells in a
// `border-collapse` table, which is why the staff column scrolled away before.
// Horizontal scroll happens inside this component's overflow-x container;
// vertical scroll is the page/window, so `top-0` pins the header to the
// viewport. Don't add a fixed height / overflow-y here or `top-0` breaks.
//
// Used by the schedule builder (single editable period) and the range view
// (week / 2-week / month across periods). The caller owns the data maps and
// what a cell click does; this component owns layout + sticky + banding.

import { Fragment, useEffect, useRef } from "react";
import { fmtDay } from "@/lib/dates";
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
      className="overflow-x-auto rounded-[10px] border border-line bg-surface shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
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
                    <span className="font-body text-[13px] font-medium text-navy">
                      {person.full_name}
                    </span>
                    {person.ratio_type === "technician" && person.certified && (
                      <span className="ml-1.5 font-body text-[10px] text-steel">
                        CPhT
                      </span>
                    )}
                  </td>
                  {dates.map((d) => {
                    const key = `${person.id}|${d}`;
                    const cellShifts = shiftsByCell.get(key) ?? [];
                    const hasPto = timeOffByCell.has(key);
                    const shift = cellShifts[0] ?? null;
                    const deficient = shift ? deficientShiftIds.has(shift.id) : false;
                    const constrained = shift ? constraintShiftIds.has(shift.id) : false;
                    const noPeriod = dateStatus?.get(d) === "none";
                    const isDraft = dateStatus?.get(d) === "draft";

                    return (
                      <td
                        key={d}
                        onClick={
                          noPeriod ? undefined : () => onCellClick(person, d, shift)
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
                        {shift && (
                          <ShiftBlock
                            segments={shift.segments}
                            workTypeById={workTypeById}
                            deficient={deficient}
                            constrained={constrained}
                          />
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

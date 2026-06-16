"use client";

// The shared spreadsheet grid: rows = staff (banded by role), columns = days.
//
// Sticky behavior: the staff-name column freezes on horizontal scroll and the
// date header freezes on vertical scroll, like a spreadsheet. Two things make
// this work:
//   1. `border-separate` on the table — Chrome silently ignores
//      `position: sticky` on cells in a `border-collapse` table.
//   2. This container is a BOUNDED scroll region: it has a capped height and
//      `overflow-auto`, so both axes scroll *inside* it. That is what pins the
//      header to the top of the grid (instead of off-screen) and keeps the
//      horizontal scrollbar at the grid's bottom edge, always on screen. An
//      earlier version let the whole page scroll with no height cap here — but
//      `overflow-x` already makes this a scroll container on both axes, so the
//      header stuck to a box that itself scrolled away. The height cap is the
//      fix; it is measured at runtime to fill the viewport below whatever
//      chrome sits above the grid.
//
// Used by the schedule builder (single editable period) and the range view
// (week / 2-week / month across periods). The caller owns the data maps and
// what a cell click does; this component owns layout + sticky + banding.
// `onCondensedChange` (optional) fires as the grid scrolls so the caller can
// collapse its top chrome to a slim strip; absent = no-op (range view).

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
  onCondensedChange,
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
  /** Fires (rAF-debounced) as the grid scrolls so the caller can condense its top chrome. */
  onCondensedChange?: (condensed: boolean) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLSpanElement>(null);

  // Bound the grid to the viewport so it scrolls internally — this is what makes
  // the sticky header and frozen column work and keeps the horizontal scrollbar
  // on screen. Measured rather than hardcoded because the chrome above the grid
  // varies (pills, AI bar, toolbar, flags, banners) and can condense.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const FOOTER_RESERVE = 112; // room for the legend + help line below the grid
    const fit = () => {
      const top = el.getBoundingClientRect().top;
      const next = `${Math.max(320, window.innerHeight - top - FOOTER_RESERVE)}px`;
      if (el.style.maxHeight !== next) el.style.maxHeight = next; // guard avoids RO loop
    };
    fit();
    window.addEventListener("resize", fit);
    // Recompute when the chrome above the grid changes height (e.g. it condenses).
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, []);

  // Tell the caller to condense/expand its top chrome as the grid scrolls.
  // Hysteresis (24 / 8 px) avoids flicker right at the threshold.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onCondensedChange) return;
    let raf = 0;
    let condensed = false;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = el.scrollTop;
        if (!condensed && y > 24) {
          condensed = true;
          onCondensedChange(true);
        } else if (condensed && y < 8) {
          condensed = false;
          onCondensedChange(false);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [onCondensedChange]);

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
      className="max-h-[calc(100dvh-260px)] overflow-auto rounded-[10px] border border-line bg-surface shadow-[0_1px_3px_rgba(28,47,94,0.08)]"
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

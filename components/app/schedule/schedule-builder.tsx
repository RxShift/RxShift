"use client";

// The schedule grid builder. Rows = staff, columns = the period's days.
// Click a cell to add or edit a shift (with split segments). Flags from
// the deterministic engines render as red/amber highlights plus a flag
// panel; publishing with open flags requires a logged reason.

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { eachDate, fmtDay, fmtRange } from "@/lib/dates";
import { copyForward, publishPeriod } from "@/lib/actions/schedule";
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
import ShiftModal from "./shift-modal";
import ShiftBlock, { WorkTypeLegend } from "./shift-block";

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

export interface BuilderBundle {
  period: SchedulePeriod;
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  zones: RatioZone[];
  approvedTimeOff: TimeOffRequest[];
}

export default function ScheduleBuilder({
  tenant,
  locationId,
  periods,
  bundle,
  validation,
}: {
  tenant: Tenant;
  locationId: string;
  periods: SchedulePeriod[];
  bundle: BuilderBundle;
  validation: ValidationOut;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<{
    staff: Staff;
    date: string;
    shift: ShiftWithSegments | null;
  } | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showFlags, setShowFlags] = useState(true);

  const dates = useMemo(
    () => eachDate(bundle.period.start_date, bundle.period.end_date),
    [bundle.period.start_date, bundle.period.end_date]
  );

  const shiftsByCell = useMemo(() => {
    const map = new Map<string, ShiftWithSegments[]>();
    for (const s of bundle.shifts) {
      const key = `${s.staff_id}|${s.date}`;
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [bundle.shifts]);

  const timeOffByCell = useMemo(() => {
    const set = new Set<string>();
    for (const t of bundle.approvedTimeOff) {
      for (const d of eachDate(t.start_date, t.end_date)) {
        set.add(`${t.staff_id}|${d}`);
      }
    }
    return set;
  }, [bundle.approvedTimeOff]);

  // Dates with a deficient slot in the zone a staff member is shifted into
  const deficientShiftIds = useMemo(() => {
    const out = new Set<string>();
    for (const s of bundle.shifts) {
      if (!s.ratio_zone_id) continue;
      const dates = validation.deficientCells[s.ratio_zone_id];
      if (dates?.includes(s.date)) out.add(s.id);
    }
    return out;
  }, [bundle.shifts, validation.deficientCells]);

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
    () => new Map(bundle.workTypes.map((w) => [w.id, w])),
    [bundle.workTypes]
  );

  // Work types actually scheduled this period — drives the legend
  const usedWorkTypeIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of bundle.shifts)
      for (const seg of s.segments)
        ids.add(seg.work_type_id ?? "__none__");
    return ids;
  }, [bundle.shifts]);

  // Rows banded by role: pharmacists, then technicians, then everyone
  // else (drivers, clerks…). Alphabetical within each band.
  const staffBands = useMemo(() => {
    const band = (rt: Staff["ratio_type"]) =>
      bundle.staff.filter((s) => s.ratio_type === rt);
    return [
      { label: "Pharmacists", staff: band("pharmacist") },
      { label: "Technicians", staff: band("technician") },
      { label: "Other staff", staff: band("non_counting") },
    ].filter((b) => b.staff.length > 0);
  }, [bundle.staff]);

  // One line per (rule, person) in the flag panel — "Melissa Morse — 4×"
  // instead of four near-identical overtime lines
  const groupedConstraintFlags = useMemo(() => {
    const groups = new Map<
      string,
      { rule_type: string; staff_name: string; messages: string[]; dates: string[] }
    >();
    for (const f of validation.constraintFlags) {
      const key = `${f.rule_type}|${f.staff_id}`;
      const g =
        groups.get(key) ??
        { rule_type: f.rule_type, staff_name: f.staff_name, messages: [], dates: [] };
      g.messages.push(f.message);
      if (f.date) g.dates.push(f.date);
      groups.set(key, g);
    }
    return [...groups.values()];
  }, [validation.constraintFlags]);

  const flagCount =
    validation.ratioFlags.length + validation.constraintFlags.length;
  const isPublished = bundle.period.status === "published";

  async function handlePublish() {
    setBusy(true);
    setPublishError(null);
    const result = await publishPeriod(
      bundle.period.id,
      flagCount > 0 ? overrideReason : null
    );
    if (result.ok) {
      setPublishOpen(false);
      router.refresh();
    } else {
      setPublishError(result.error);
    }
    setBusy(false);
  }

  async function handleCopyForward() {
    setBusy(true);
    const result = await copyForward(bundle.period.id);
    if (result.ok && result.data) {
      router.refresh();
    } else if (!result.ok) {
      alert(result.error);
    }
    setBusy(false);
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Staff", ...dates].join(",");
    const lines = bundle.staff.map((person) => {
      const cells = dates.map((d) => {
        const shifts = shiftsByCell.get(`${person.id}|${d}`) ?? [];
        if (timeOffByCell.has(`${person.id}|${d}`)) return "PTO";
        return shifts
          .flatMap((s) =>
            s.segments.map(
              (seg) =>
                `${String(seg.start_time).slice(0, 5)}-${String(seg.end_time).slice(0, 5)}`
            )
          )
          .join(" / ");
      });
      return [esc(person.full_name), ...cells.map(esc)].join(",");
    });
    const blob = new Blob([[header, ...lines].join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schedule-${bundle.period.start_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={bundle.period.id}
          onChange={(e) =>
            router.push(
              `/app/schedule?location=${locationId}&period=${e.target.value}`
            )
          }
          className="rounded-md border-[1.5px] border-line bg-surface px-3 py-2 font-body text-sm text-navy"
        >
          {periods.map((p) => (
            <option key={p.id} value={p.id}>
              {fmtRange(p.start_date, p.end_date)}
              {p.status === "published" ? " ✓" : " (draft)"}
            </option>
          ))}
        </select>

        <Badge tone={isPublished ? "compliant" : "neutral"}>
          {isPublished ? "Published" : "Draft"}
        </Badge>

        <div className="ml-auto flex items-center gap-3">
          {bundle.shifts.length === 0 && (
            <Button variant="secondary" onClick={handleCopyForward} disabled={busy}>
              Copy previous period
            </Button>
          )}
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
          {!isPublished && (
            <Button onClick={() => setPublishOpen(true)} disabled={busy}>
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* Flag summary */}
      {flagCount > 0 && (
        <div className="rounded-lg border-l-[3px] border-l-deficiency bg-deficiency-bg p-4">
          <button
            onClick={() => setShowFlags(!showFlags)}
            className="font-brand text-sm font-bold text-deficiency"
          >
            {flagCount} open flag{flagCount === 1 ? "" : "s"}{" "}
            {showFlags ? "▾" : "▸"}
          </button>
          {showFlags && (
            <ul className="mt-2 space-y-1.5 font-body text-[13px] text-navy">
              {validation.ratioFlags.slice(0, 20).map((f, i) => (
                <li key={`r${i}`}>
                  <span className="font-medium text-deficiency">Ratio</span> ·{" "}
                  {f.date} {f.slot_label} ({f.zone_name}): {f.reason}
                </li>
              ))}
              {groupedConstraintFlags.slice(0, 20).map((g, i) => (
                <li key={`c${i}`}>
                  <span className="font-medium text-alert">
                    {g.rule_type.replace(/_/g, " ")}
                  </span>{" "}
                  ·{" "}
                  {g.messages.length === 1
                    ? g.messages[0]
                    : `${g.staff_name} — ${g.messages.length}× (${g.dates
                        .slice(0, 4)
                        .join(", ")}${g.dates.length > 4 ? ", …" : ""})`}
                </li>
              ))}
              {validation.ratioFlags.length > 20 ||
              groupedConstraintFlags.length > 20 ? (
                <li>…and more.</li>
              ) : null}
            </ul>
          )}
        </div>
      )}

      {/* The grid */}
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-line bg-cloud px-3 py-2 text-left font-brand text-[9.5px] font-bold uppercase tracking-[1px] text-steel">
                Staff
              </th>
              {dates.map((d) => {
                const day = fmtDay(d);
                const isWeekend = day.dow === "Sat" || day.dow === "Sun";
                return (
                  <th
                    key={d}
                    className={`min-w-[92px] border-b border-line px-2 py-2 text-center font-brand text-[9.5px] font-bold uppercase tracking-[0.5px] ${
                      isWeekend ? "bg-cloud/60 text-steel/70" : "bg-cloud text-steel"
                    }`}
                  >
                    {day.dow}
                    <br />
                    <span className="font-body text-[10px] font-medium normal-case tracking-normal">
                      {day.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {staffBands.map((band) => (
              <Fragment key={band.label}>
                <tr>
                  <td className="sticky left-0 z-10 border-r border-t border-line bg-cloud px-3 py-1 font-brand text-[9px] font-bold uppercase tracking-[1.2px] text-steel">
                    {band.label} ({band.staff.length})
                  </td>
                  <td
                    colSpan={dates.length}
                    className="border-t border-line bg-cloud"
                  />
                </tr>
                {band.staff.map((person) => (
                  <tr key={person.id}>
                    <td className="sticky left-0 z-10 border-r border-t border-line bg-surface px-3 py-1.5">
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
                      const deficient = shift
                        ? deficientShiftIds.has(shift.id)
                        : false;
                      const constrained = shift
                        ? constraintShiftIds.has(shift.id)
                        : false;

                      return (
                        <td
                          key={d}
                          onClick={() =>
                            setEditing({ staff: person, date: d, shift })
                          }
                          className={`cursor-pointer border-t border-line px-1.5 py-1.5 text-center align-top transition-colors hover:bg-navy/[0.04] ${
                            hasPto ? "bg-cloud" : ""
                          }`}
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

      <WorkTypeLegend workTypes={bundle.workTypes} usedIds={usedWorkTypeIds} />

      <p className="font-body text-xs text-steel">
        Click any cell to add or edit a shift. Blocks are colored by work
        type (set colors in Settings → Work Types). A red ring with ⚠ marks
        a shift in a deficient ratio slot; an amber ring marks a constraint
        flag; grey = approved time off. Flags are advisory — publishing past
        them requires a reason, which is logged.
      </p>

      {/* Shift editor */}
      {editing && (
        <ShiftModal
          open={true}
          onClose={() => setEditing(null)}
          staff={editing.staff}
          date={editing.date}
          shift={editing.shift}
          period={bundle.period}
          locationId={locationId}
          zones={bundle.zones}
          workTypes={bundle.workTypes}
          hasRatio={tenant.has_ratio}
          defaultBreakMinutes={tenant.default_break_minutes ?? 30}
        />
      )}

      {/* Publish confirm */}
      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title="Publish this schedule?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </>
        }
      >
        <p>
          Publishing makes the schedule visible to staff and generates the
          hourly compliance record.
        </p>
        {flagCount > 0 && (
          <div className="mt-4">
            <p className="mb-2 font-medium text-deficiency">
              {flagCount} flag{flagCount === 1 ? "" : "s"} will be overridden.
              A reason is required and goes in the override log.
            </p>
            <Textarea
              rows={2}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Why is it acceptable to publish with these flags?"
            />
          </div>
        )}
        {publishError && (
          <p className="mt-3 font-body text-sm text-deficiency">{publishError}</p>
        )}
      </Modal>
    </div>
  );
}

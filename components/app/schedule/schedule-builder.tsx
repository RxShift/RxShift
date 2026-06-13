"use client";

// The schedule grid builder. Rows = staff, columns = the period's days.
// Click a cell to add or edit a shift (with split segments). Flags from
// the deterministic engines render as red/amber highlights plus a flag
// panel; publishing with open flags requires a logged reason.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Textarea } from "@/components/ui/form";
import { eachDate, fmtRange } from "@/lib/dates";
import { copyForward, createNextPeriod, publishPeriod } from "@/lib/actions/schedule";
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
import { WorkTypeLegend } from "./shift-block";
import ScheduleGrid from "./schedule-grid";

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
  today,
}: {
  tenant: Tenant;
  locationId: string;
  periods: SchedulePeriod[];
  bundle: BuilderBundle;
  validation: ValidationOut;
  today: string;
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
  const [confirmCopy, setConfirmCopy] = useState(false);

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

  // Period navigation: periods arrive newest-first; sort oldest-first so the
  // ◀ / ▶ steppers move chronologically.
  const { prevPeriod, nextPeriod } = useMemo(() => {
    const ordered = [...periods].sort((a, b) =>
      a.start_date.localeCompare(b.start_date)
    );
    const idx = ordered.findIndex((p) => p.id === bundle.period.id);
    return {
      prevPeriod: idx > 0 ? ordered[idx - 1] : null,
      nextPeriod:
        idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null,
    };
  }, [periods, bundle.period.id]);

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

  function goToPeriod(id: string) {
    router.push(`/app/schedule?location=${locationId}&period=${id}`);
  }

  async function handleCreateNext() {
    setBusy(true);
    const result = await createNextPeriod(locationId);
    if (result.ok && result.data) {
      router.push(
        `/app/schedule?location=${locationId}&period=${result.data.id}`
      );
      router.refresh();
    } else if (!result.ok) {
      alert(result.error);
    }
    setBusy(false);
  }

  async function handleCopyForward() {
    setBusy(true);
    const result = await copyForward(bundle.period.id);
    setConfirmCopy(false);
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
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            className="px-3"
            onClick={() => prevPeriod && goToPeriod(prevPeriod.id)}
            disabled={!prevPeriod}
            aria-label="Previous period"
          >
            ←
          </Button>
          <select
            value={bundle.period.id}
            onChange={(e) => goToPeriod(e.target.value)}
            className="rounded-md border-[1.5px] border-line bg-surface px-3 py-2 font-body text-sm text-navy"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {fmtRange(p.start_date, p.end_date)}
                {p.status === "published" ? " ✓" : " (draft)"}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            className="px-3"
            onClick={() => nextPeriod && goToPeriod(nextPeriod.id)}
            disabled={!nextPeriod}
            aria-label="Next period"
          >
            →
          </Button>
        </div>

        <Badge tone={isPublished ? "compliant" : "neutral"}>
          {isPublished ? "Published" : "Draft"}
        </Badge>

        <div className="ml-auto flex items-center gap-3">
          {bundle.shifts.length === 0 && (
            <Button
              variant="secondary"
              onClick={() => setConfirmCopy(true)}
              disabled={busy}
            >
              Copy last period&rsquo;s weekday pattern
            </Button>
          )}
          <Button variant="secondary" onClick={handleCreateNext} disabled={busy}>
            Create next period
          </Button>
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
      <ScheduleGrid
        dates={dates}
        today={today}
        staff={bundle.staff}
        shiftsByCell={shiftsByCell}
        timeOffByCell={timeOffByCell}
        deficientShiftIds={deficientShiftIds}
        constraintShiftIds={constraintShiftIds}
        workTypeById={workTypeById}
        onCellClick={(staff, date, shift) =>
          setEditing({ staff, date, shift })
        }
      />

      <WorkTypeLegend workTypes={bundle.workTypes} usedIds={usedWorkTypeIds} />

      <p className="font-body text-xs text-steel">
        Click any cell to add or edit a shift. Blocks are colored by work
        type (set colors in Settings → Work Types). A red ⚠ badge marks
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

      {/* Copy-forward confirm */}
      <Modal
        open={confirmCopy}
        onClose={() => setConfirmCopy(false)}
        title="Copy last period's weekday pattern?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmCopy(false)}>
              Cancel
            </Button>
            <Button onClick={handleCopyForward} disabled={busy}>
              {busy ? "Copying…" : "Copy forward"}
            </Button>
          </>
        }
      >
        <p>
          This copies every shift from the previous period into this one,
          keeping the same day-of-week pattern and break times. It only works on
          an empty period — nothing here will be overwritten.
        </p>
      </Modal>

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

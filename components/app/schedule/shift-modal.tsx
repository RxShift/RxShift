"use client";

// Shift editor: one shift = one or more segments, each with its own work
// type and an optional counting override — this is how a tech splits a day
// between counting (dispensing) and non-counting (inventory) work.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { addDaysStr, eachDate } from "@/lib/dates";
import {
  copyShiftForward,
  deleteShift,
  upsertShift,
} from "@/lib/actions/schedule";
import { clearPtoDay, setPtoRange } from "@/lib/actions/pto";
import type {
  Department,
  Location,
  PtoDay,
  SchedulePeriod,
  Shift,
  ShiftSegment,
  Staff,
  WorkType,
} from "@/lib/types";

interface SegmentDraft {
  start_time: string;
  end_time: string;
  work_type_id: string;
  counts: "default" | "yes" | "no";
}

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

export default function ShiftModal({
  open,
  onClose,
  staff,
  date,
  shift,
  period,
  locationId,
  locationName,
  departments,
  requireDepartment,
  workTypes,
  defaultBreakMinutes,
  locationOptions,
  periods,
  existingPto = null,
  ptoReasonRequired = false,
  viewEnd,
}: {
  open: boolean;
  onClose: () => void;
  staff: Staff;
  date: string;
  shift: ShiftWithSegments | null;
  /** The covering period when known (editing); resolved from the picker when null. */
  period: SchedulePeriod | null;
  locationId: string;
  /** Shown as read-only context when the location is fixed. */
  locationName?: string;
  departments: Department[];
  requireDepartment: boolean;
  workTypes: WorkType[];
  defaultBreakMinutes: number;
  /** All-locations create: show a location picker instead of fixed context. */
  locationOptions?: Location[];
  /** Periods across locations, used to resolve the covering period when picking. */
  periods?: SchedulePeriod[];
  /** The PTO record for this person+date, if they're already marked off. */
  existingPto?: PtoDay | null;
  /** When true, a reason is required to save PTO (tenant setting). */
  ptoReasonRequired?: boolean;
  /** The current view's last date — bounds the "copy to following days" range. */
  viewEnd?: string;
}) {
  const router = useRouter();
  const [selectedLocationId, setSelectedLocationId] = useState(
    locationId || locationOptions?.[0]?.id || ""
  );
  const [segments, setSegments] = useState<SegmentDraft[]>(
    shift && shift.segments.length > 0
      ? shift.segments.map((s) => ({
          start_time: String(s.start_time).slice(0, 5),
          end_time: String(s.end_time).slice(0, 5),
          work_type_id: s.work_type_id ?? "",
          counts:
            s.counts_toward_ratio === null
              ? "default"
              : s.counts_toward_ratio
                ? "yes"
                : "no",
        }))
      : [{ start_time: "09:00", end_time: "17:00", work_type_id: "", counts: "default" }]
  );
  const [departmentId, setDepartmentId] = useState(shift?.department_id ?? "");
  const [breakMinutes, setBreakMinutes] = useState(
    String(shift ? shift.break_minutes : defaultBreakMinutes)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // PTO: marking the day off blacks out the rest of the record. A PTO cell has
  // no shift (it was deleted), so isPto starts true only when there's an existing
  // pto_day. Checking it on a shift cell converts the day to PTO on save.
  const [isPto, setIsPto] = useState(!!existingPto);
  const [ptoReason, setPtoReason] = useState(existingPto?.reason ?? "");
  // Multi-day PTO: mark a continuous block off in one save (default = just this
  // day). Unlike shift carry-forward this isn't bound to the view window — PTO is
  // a person-level record independent of periods, so a long vacation still works.
  const [ptoThrough, setPtoThrough] = useState(date);
  // Carry-forward: copy this shift to following days through a chosen date.
  const copyFrom = addDaysStr(date, 1);
  const canCopyForward = !!shift && !isPto && !!viewEnd && copyFrom <= viewEnd;
  const [copyThrough, setCopyThrough] = useState(viewEnd ?? "");
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    setSegments((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  async function handleSavePto() {
    if (ptoReasonRequired && !ptoReason.trim()) {
      setError("A reason is required for PTO at this pharmacy.");
      return;
    }
    const end = ptoThrough && ptoThrough >= date ? ptoThrough : date;
    setBusy(true);
    setError(null);
    const result = await setPtoRange({
      staff_id: staff.id,
      start_date: date,
      end_date: end,
      reason: ptoReason.trim() || null,
    });
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function handleRemovePto() {
    setBusy(true);
    setError(null);
    const result = await clearPtoDay({ staff_id: staff.id, date });
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function handleCopyForward() {
    if (!shift) return;
    if (!copyThrough || copyThrough < copyFrom) {
      setCopyMsg("Pick a date after this shift.");
      return;
    }
    setBusy(true);
    setCopyMsg(null);
    const result = await copyShiftForward({
      shiftId: shift.id,
      targetDates: eachDate(copyFrom, copyThrough),
    });
    setBusy(false);
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      setCopyMsg(result.error);
    }
  }

  async function handleSave() {
    if (isPto) return handleSavePto();
    if (requireDepartment && !departmentId) {
      setError("This pharmacy requires a department on every shift.");
      return;
    }
    const loc = locationOptions ? selectedLocationId : locationId;
    if (!loc) {
      setError("Choose a location for this shift.");
      return;
    }
    // Editing uses the shift's own period; creating resolves the period that
    // covers this date at the chosen location. If none exists yet (a future
    // week that hasn't been built), send null — upsertShift auto-creates the
    // cycle-aligned period on the server (periods are invisible plumbing).
    const resolvedPeriod =
      period ??
      periods?.find(
        (p) =>
          p.location_id === loc &&
          p.start_date <= date &&
          p.end_date >= date
      ) ??
      null;
    setBusy(true);
    setError(null);
    const result = await upsertShift(shift?.id ?? null, {
      schedule_period_id: resolvedPeriod?.id ?? null,
      location_id: loc,
      staff_id: staff.id,
      date,
      department_id: departmentId || null,
      break_minutes: Math.max(0, parseInt(breakMinutes, 10) || 0),
      segments: segments.map((s) => ({
        start_time: s.start_time,
        end_time: s.end_time,
        work_type_id: s.work_type_id || null,
        counts_toward_ratio:
          s.counts === "default" ? null : s.counts === "yes",
      })),
    });
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function handleDelete() {
    if (!shift) return;
    setBusy(true);
    const result = await deleteShift(shift.id);
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${staff.full_name} — ${date}`}
      wide
      footer={
        <>
          {shift && !isPto && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
              className="mr-auto"
            >
              Delete shift
            </Button>
          )}
          {existingPto && (
            <Button
              variant="destructive"
              onClick={handleRemovePto}
              disabled={busy}
              className="mr-auto"
            >
              Remove PTO
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : isPto ? "Save PTO" : "Save shift"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* PTO blacks out the day — checking it hides the shift fields and saves
            a pto_day record (deleting any shift that day). */}
        <label className="flex items-center gap-2.5 rounded-lg border border-line bg-cloud/50 p-3">
          <input
            type="checkbox"
            checked={isPto}
            onChange={(e) => setIsPto(e.target.checked)}
            className="h-4 w-4 accent-amber"
          />
          <span className="font-body text-sm font-medium text-navy">
            PTO / time off — {staff.full_name} is off this day
          </span>
        </label>

        {isPto ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="pto-reason">
                Reason{ptoReasonRequired ? "" : " (optional)"}
              </Label>
              <Input
                id="pto-reason"
                value={ptoReason}
                onChange={(e) => setPtoReason(e.target.value)}
                placeholder="e.g. vacation, sick, personal"
              />
            </div>
            {!existingPto && (
              <div>
                <Label htmlFor="pto-through">Through this date (optional)</Label>
                <Input
                  id="pto-through"
                  type="date"
                  value={ptoThrough}
                  min={date}
                  onChange={(e) => setPtoThrough(e.target.value || date)}
                  className="w-40"
                />
                <HelpText>
                  Leave as {date} for a single day, or pick a later date to mark a
                  continuous block off in one step (e.g. a week&rsquo;s vacation).
                  Any shifts in the range are removed.
                </HelpText>
              </div>
            )}
            <HelpText>
              PTO is a person-level record — it shows blacked out on the schedule
              and isn&rsquo;t tied to a published period. The reason stays here; it
              never goes into the compliance override log.
            </HelpText>
          </div>
        ) : (
          <>
        <div className="flex flex-wrap gap-4">
          {locationOptions && (
            <div className="w-[280px]">
              <Label htmlFor="loc">Location</Label>
              <Select
                id="loc"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
              >
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div className="w-[280px]">
            <Label htmlFor="dept">
              Department{requireDepartment ? "" : " (optional)"}
            </Label>
            <Select
              id="dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">
                {requireDepartment ? "— Select a department —" : "— None —"}
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            {locationName && <HelpText>Location: {locationName}</HelpText>}
          </div>
          <div>
            <Label htmlFor="break">Unpaid break (min)</Label>
            <Input
              id="break"
              type="number"
              min={0}
              max={240}
              step={5}
              value={breakMinutes}
              onChange={(e) => setBreakMinutes(e.target.value)}
              className="w-28"
            />
            <HelpText>
              Subtracted from paid hours. Doesn&rsquo;t affect ratio coverage.
            </HelpText>
          </div>
        </div>

        <div>
          <Label>Segments</Label>
          <HelpText>
            Split a shift when part of it counts toward ratio and part
            doesn&rsquo;t — e.g. dispensing until noon, inventory after.
            End before start means the segment runs past midnight.
          </HelpText>
          <div className="mt-2 space-y-2">
            {segments.map((seg, i) => (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-cloud/50 p-3"
              >
                <div>
                  <Label>Start</Label>
                  <Input
                    type="time"
                    value={seg.start_time}
                    onChange={(e) =>
                      updateSegment(i, { start_time: e.target.value })
                    }
                    className="w-28"
                  />
                </div>
                <div>
                  <Label>End</Label>
                  <Input
                    type="time"
                    value={seg.end_time}
                    onChange={(e) =>
                      updateSegment(i, { end_time: e.target.value })
                    }
                    className="w-28"
                  />
                </div>
                <div className="min-w-[160px] flex-1">
                  <Label>Work type</Label>
                  <Select
                    value={seg.work_type_id}
                    onChange={(e) =>
                      updateSegment(i, { work_type_id: e.target.value })
                    }
                  >
                    <option value="">
                      {staff.ratio_type === "pharmacist"
                        ? "— Default (counts) —"
                        : "— None —"}
                    </option>
                    {workTypes.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                        {w.counting_default ? " · counts" : " · doesn't count"}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Counting</Label>
                  <Select
                    value={seg.counts}
                    onChange={(e) =>
                      updateSegment(i, {
                        counts: e.target.value as SegmentDraft["counts"],
                      })
                    }
                    className="w-32"
                  >
                    <option value="default">Default</option>
                    <option value="yes">Counts</option>
                    <option value="no">Doesn&rsquo;t count</option>
                  </Select>
                </div>
                {segments.length > 1 && (
                  <button
                    onClick={() =>
                      setSegments((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="mb-2 font-body text-xs font-medium text-deficiency hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          {segments.length < 8 && (
            <button
              onClick={() => {
                const last = segments[segments.length - 1];
                setSegments((prev) => [
                  ...prev,
                  {
                    start_time: last?.end_time ?? "12:00",
                    end_time: "17:00",
                    work_type_id: "",
                    counts: "default",
                  },
                ]);
              }}
              className="mt-2 font-body text-sm font-medium text-navy underline-offset-2 hover:underline"
            >
              + Split shift / add segment
            </button>
          )}
        </div>

        {canCopyForward && (
          <div className="border-t border-line pt-4">
            <Label htmlFor="copy-through">
              Copy this shift to following days
            </Label>
            <div className="mt-1.5 flex flex-wrap items-end gap-2">
              <Input
                id="copy-through"
                type="date"
                value={copyThrough}
                min={copyFrom}
                max={viewEnd}
                onChange={(e) => setCopyThrough(e.target.value)}
                className="w-40"
              />
              <Button
                variant="secondary"
                onClick={handleCopyForward}
                disabled={busy}
              >
                Copy through this date
              </Button>
            </div>
            <HelpText>
              Repeats this shift on every day from the next day through the date
              you pick (within the current view). Days the person already works or
              has off are skipped.
            </HelpText>
            {copyMsg && (
              <p className="mt-1 font-body text-sm text-deficiency">{copyMsg}</p>
            )}
          </div>
        )}
          </>
        )}

        {error && <p className="font-body text-sm text-deficiency">{error}</p>}
      </div>
    </Modal>
  );
}

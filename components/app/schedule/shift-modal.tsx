"use client";

// Shift editor: one shift = one or more segments, each with its own work
// type and an optional counting override — this is how a tech splits a day
// between counting (dispensing) and non-counting (inventory) work.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { deleteShift, upsertShift } from "@/lib/actions/schedule";
import type {
  RatioZone,
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
  zones,
  workTypes,
  hasRatio,
  defaultBreakMinutes,
}: {
  open: boolean;
  onClose: () => void;
  staff: Staff;
  date: string;
  shift: ShiftWithSegments | null;
  period: SchedulePeriod;
  locationId: string;
  zones: RatioZone[];
  workTypes: WorkType[];
  hasRatio: boolean;
  defaultBreakMinutes: number;
}) {
  const router = useRouter();
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
  const [zoneId, setZoneId] = useState(
    shift?.ratio_zone_id ?? zones[0]?.id ?? ""
  );
  const [breakMinutes, setBreakMinutes] = useState(
    String(shift ? shift.break_minutes : defaultBreakMinutes)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSegment(i: number, patch: Partial<SegmentDraft>) {
    setSegments((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await upsertShift(shift?.id ?? null, {
      schedule_period_id: period.id,
      location_id: locationId,
      staff_id: staff.id,
      date,
      ratio_zone_id: zoneId || null,
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
          {shift && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy}
              className="mr-auto"
            >
              Delete shift
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy}>
            {busy ? "Saving…" : "Save shift"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4">
          {hasRatio && zones.length > 0 && (
            <div className="w-[280px]">
              <Label htmlFor="zone">Ratio zone</Label>
              <Select
                id="zone"
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                    {z.ratio_isolated ? " (isolated)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
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
                    className="mb-2 font-body text-xs font-medium text-[#C0392B] hover:underline"
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

        {error && <p className="font-body text-sm text-[#C0392B]">{error}</p>}
      </div>
    </Modal>
  );
}

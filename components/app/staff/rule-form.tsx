"use client";

// Add / edit one scheduling rule for a staff member. Conditional fields per rule_type
// (mirrors the constraint form). Builds the canonical params shape (see
// lib/scheduling-rules-display.ts) and writes via the generic entity CRUD.

import { useState } from "react";
import Button from "@/components/ui/button";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/form";
import { createEntity, updateEntity } from "@/lib/actions/settings";
import { RULE_TYPE_LABELS } from "@/lib/scheduling-rules-display";
import type {
  Location,
  SchedulingRuleFrequency,
  SchedulingRuleType,
  StaffSchedulingRule,
  WorkType,
} from "@/lib/types";

// Monday-first display order (Lucy's pharmacies think Mon→Sun); value is the 0–6 dow.
const DAY_ORDER: { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Which rule types use which field groups.
const USES_DAYS = new Set<SchedulingRuleType>([
  "recurring_shift",
  "preferred_days",
  "preferred_work_type_by_day",
  "recurring_work_type_assignment",
]);
const USES_TIMES = new Set<SchedulingRuleType>([
  "recurring_shift",
  "recurring_work_type_assignment",
]);
const USES_WORK_TYPE = new Set<SchedulingRuleType>([
  "recurring_shift",
  "preferred_work_type_by_day",
  "recurring_work_type_assignment",
  "monthly_quota",
  "nth_weekday_assignment",
  "quarterly_project_days",
  "preferred_not_assigned",
]);
const USES_FREQUENCY = new Set<SchedulingRuleType>([
  "recurring_shift",
  "recurring_work_type_assignment",
]);

const ORDER: SchedulingRuleType[] = [
  "recurring_shift",
  "recurring_work_type_assignment",
  "preferred_work_type_by_day",
  "nth_weekday_assignment",
  "monthly_quota",
  "quarterly_project_days",
  "preferred_shift_length",
  "preferred_days",
  "per_diem_availability",
  "float_location",
  "preferred_not_assigned",
];

function num(form: FormData, key: string): number | undefined {
  const v = form.get(key);
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function RuleForm({
  staffId,
  workTypes,
  locations,
  initial,
  onSaved,
  onCancel,
}: {
  staffId: string;
  workTypes: WorkType[];
  locations: Location[];
  initial?: StaffSchedulingRule | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [ruleType, setRuleType] = useState<SchedulingRuleType>(
    initial?.rule_type ?? "recurring_shift"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ip = (initial?.params ?? {}) as Record<string, unknown>;
  const initDays = Array.isArray(ip.days) ? (ip.days as number[]) : [];
  const initMonths = Array.isArray(ip.month_occurrence)
    ? (ip.month_occurrence as number[])
    : [];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    const params: Record<string, unknown> = {};
    if (USES_DAYS.has(ruleType)) {
      params.days = DAY_ORDER.map((d) => d.value).filter(
        (v) => form.get(`day-${v}`) === "on"
      );
    }
    if (USES_TIMES.has(ruleType)) {
      if (form.get("start_time")) params.start_time = form.get("start_time");
      if (form.get("end_time")) params.end_time = form.get("end_time");
    }
    if (ruleType === "preferred_shift_length") {
      params.shift_length_hours = num(form, "shift_length_hours") ?? 8;
      const spw = num(form, "shifts_per_week");
      if (spw) params.shifts_per_week = spw;
    }
    if (ruleType === "monthly_quota" || ruleType === "quarterly_project_days") {
      params.quota_per_period = num(form, "quota_per_period") ?? 1;
    }
    if (ruleType === "nth_weekday_assignment") {
      params.week_occurrence = num(form, "week_occurrence") ?? 1;
      params.day_of_week = num(form, "day_of_week") ?? 4;
      const dur = num(form, "duration_hours");
      if (dur) params.duration_hours = dur;
    }
    if (ruleType === "quarterly_project_days") {
      params.month_occurrence = MONTHS.map((_, i) => i + 1).filter(
        (m) => form.get(`month-${m}`) === "on"
      );
    }
    if (ruleType === "per_diem_availability") {
      params.quota_per_period = num(form, "quota_per_period") ?? 0;
      if (form.get("latest_end_time"))
        params.latest_end_time = form.get("latest_end_time");
    }

    const payload = {
      staff_id: staffId,
      rule_type: ruleType,
      work_type_id: USES_WORK_TYPE.has(ruleType)
        ? (form.get("work_type_id") as string) || null
        : null,
      location_id: (form.get("location_id") as string) || null,
      frequency: USES_FREQUENCY.has(ruleType)
        ? ((form.get("frequency") as SchedulingRuleFrequency) || null)
        : null,
      params,
      notes: (form.get("notes") as string) || null,
      is_active: true,
    };

    const result = initial
      ? await updateEntity("staff_scheduling_rule", initial.id, payload)
      : await createEntity("staff_scheduling_rule", payload);
    setBusy(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  const workTypeOptions = (
    <>
      <option value="">—</option>
      {workTypes.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="rule_type">Rule type</Label>
        <Select
          id="rule_type"
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as SchedulingRuleType)}
        >
          {ORDER.map((t) => (
            <option key={t} value={t}>
              {RULE_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </div>

      {USES_FREQUENCY.has(ruleType) && (
        <div>
          <Label htmlFor="frequency">How often</Label>
          <Select
            id="frequency"
            name="frequency"
            defaultValue={initial?.frequency ?? (ruleType === "recurring_shift" ? "weekly" : "every_other_week")}
          >
            <option value="weekly">Every week</option>
            <option value="every_other_week">Every other week</option>
            <option value="every_other_month">Every other month</option>
            <option value="monthly_by_occurrence">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </Select>
          {ruleType === "recurring_work_type_assignment" && (
            <HelpText>
              e.g. &ldquo;every other Monday&rdquo; = Every other week + pick Monday below.
            </HelpText>
          )}
        </div>
      )}

      {USES_DAYS.has(ruleType) && (
        <div>
          <Label>Days</Label>
          <div className="flex flex-wrap gap-3">
            {DAY_ORDER.map((d) => (
              <label
                key={d.value}
                className="flex items-center gap-1.5 font-body text-sm text-navy"
              >
                <input
                  type="checkbox"
                  name={`day-${d.value}`}
                  defaultChecked={initDays.includes(d.value)}
                  className="h-4 w-4 accent-amber"
                />
                {d.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {USES_TIMES.has(ruleType) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start_time">Start</Label>
            <Input
              id="start_time"
              name="start_time"
              type="time"
              defaultValue={(ip.start_time as string) ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="end_time">End</Label>
            <Input
              id="end_time"
              name="end_time"
              type="time"
              defaultValue={(ip.end_time as string) ?? ""}
            />
          </div>
        </div>
      )}

      {ruleType === "preferred_shift_length" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="shift_length_hours">Shift length (hours)</Label>
            <Input
              id="shift_length_hours"
              name="shift_length_hours"
              type="number"
              min={1}
              max={24}
              defaultValue={(ip.shift_length_hours as number) ?? 10}
            />
          </div>
          <div>
            <Label htmlFor="shifts_per_week">Shifts per week (optional)</Label>
            <Input
              id="shifts_per_week"
              name="shifts_per_week"
              type="number"
              min={1}
              max={7}
              defaultValue={(ip.shifts_per_week as number) ?? ""}
            />
            <HelpText>e.g. 4 → &ldquo;4×10&rdquo;.</HelpText>
          </div>
        </div>
      )}

      {ruleType === "nth_weekday_assignment" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="week_occurrence">Which occurrence</Label>
            <Select
              id="week_occurrence"
              name="week_occurrence"
              defaultValue={String((ip.week_occurrence as number) ?? 3)}
            >
              <option value="1">1st</option>
              <option value="2">2nd</option>
              <option value="3">3rd</option>
              <option value="4">4th</option>
              <option value="5">Last</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="day_of_week">Weekday</Label>
            <Select
              id="day_of_week"
              name="day_of_week"
              defaultValue={String((ip.day_of_week as number) ?? 4)}
            >
              {DAY_ORDER.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="duration_hours">Hours (optional)</Label>
            <Input
              id="duration_hours"
              name="duration_hours"
              type="number"
              min={1}
              max={12}
              step="0.5"
              defaultValue={(ip.duration_hours as number) ?? ""}
            />
            <HelpText>e.g. 1 → &ldquo;1 hr of consulting&rdquo;.</HelpText>
          </div>
        </div>
      )}

      {(ruleType === "monthly_quota" ||
        (ruleType === "quarterly_project_days") ||
        ruleType === "per_diem_availability") && (
        <div>
          <Label htmlFor="quota_per_period">
            {ruleType === "per_diem_availability"
              ? "Days committed per month"
              : ruleType === "quarterly_project_days"
                ? "Extra days each period"
                : "Days per month"}
          </Label>
          <Input
            id="quota_per_period"
            name="quota_per_period"
            type="number"
            min={ruleType === "per_diem_availability" ? 0 : 1}
            max={31}
            defaultValue={(ip.quota_per_period as number) ?? 1}
          />
        </div>
      )}

      {ruleType === "per_diem_availability" && (
        <div>
          <Label htmlFor="latest_end_time">Latest end time (optional)</Label>
          <Input
            id="latest_end_time"
            name="latest_end_time"
            type="time"
            defaultValue={(ip.latest_end_time as string) ?? ""}
          />
          <HelpText>e.g. can only work until 6:00pm.</HelpText>
        </div>
      )}

      {ruleType === "quarterly_project_days" && (
        <div>
          <Label>Months (last week of each)</Label>
          <div className="flex flex-wrap gap-2">
            {MONTHS.map((m, i) => (
              <label
                key={m}
                className="flex items-center gap-1 font-body text-xs text-navy"
              >
                <input
                  type="checkbox"
                  name={`month-${i + 1}`}
                  defaultChecked={initMonths.includes(i + 1)}
                  className="h-3.5 w-3.5 accent-amber"
                />
                {m}
              </label>
            ))}
          </div>
          <HelpText>e.g. Mar, Jun, Sep, Dec for quarterly project days.</HelpText>
        </div>
      )}

      {USES_WORK_TYPE.has(ruleType) && (
        <div>
          <Label htmlFor="work_type_id">
            Work type{ruleType === "preferred_not_assigned" ? " to avoid" : ""}
          </Label>
          <Select
            id="work_type_id"
            name="work_type_id"
            defaultValue={initial?.work_type_id ?? ""}
          >
            {workTypeOptions}
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="location_id">
          Location{ruleType === "float_location" ? "" : " (optional)"}
        </Label>
        <Select
          id="location_id"
          name="location_id"
          defaultValue={initial?.location_id ?? ""}
        >
          <option value="">{ruleType === "float_location" ? "—" : "Any / home"}</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={initial?.notes ?? ""}
          placeholder="Plain-English context for whoever reads this rule."
        />
      </div>

      {error && <p className="font-body text-sm text-deficiency">{error}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : initial ? "Save rule" : "Add rule"}
        </Button>
      </div>
    </form>
  );
}

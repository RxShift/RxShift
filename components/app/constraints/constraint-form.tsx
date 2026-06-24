"use client";

// Add / edit one constraint rule. Shared by Settings → Constraints (scope picker
// shown) and the staff record (scope locked to one person). Builds the params shape
// the engine reads and writes via the generic entity CRUD.

import { useState } from "react";
import Button from "@/components/ui/button";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { createEntity, updateEntity } from "@/lib/actions/settings";
import { CONSTRAINT_DAY_OPTIONS } from "@/lib/constraints-display";
import { todayStr } from "@/lib/dates";
import type { ConstraintRule, ConstraintRuleType, Staff } from "@/lib/types";

const RULE_LABELS: Record<ConstraintRuleType, string> = {
  hour_cap: "Hour cap",
  overtime: "Overtime threshold",
  unavailable_window: "Unavailable window",
  hard_stop: "Hard stop time",
  recurring_unavailable: "Recurring unavailability",
  always_off: "Always off",
  max_consecutive_days: "Max consecutive days",
};

export default function ConstraintForm({
  staff,
  lockedStaffId,
  initial,
  onSaved,
  onCancel,
}: {
  staff: Staff[];
  /** When set, scope is fixed to this person and the scope picker is hidden. */
  lockedStaffId?: string;
  initial?: ConstraintRule | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [ruleType, setRuleType] = useState<ConstraintRuleType>(
    initial?.rule_type ?? "hour_cap"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ip = (initial?.params ?? {}) as Record<string, unknown>;
  const initDays = (ip.days as string[]) ?? [];
  const initRec = (ip.recurrence as { days?: string[]; interval_weeks?: number; anchor_date?: string }) ?? {};
  const initRange = (ip.time_range as { start?: string; end?: string }) ?? {};

  function collectDays(form: FormData, field: string): string[] {
    return CONSTRAINT_DAY_OPTIONS.filter((d) => form.get(`${field}-${d}`) === "on");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    let params: Record<string, unknown> = {};
    switch (ruleType) {
      case "hour_cap":
        params = { hours: Number(form.get("hours")), period: form.get("period") };
        break;
      case "overtime":
        params = { threshold_hours: Number(form.get("threshold_hours") || 40) };
        break;
      case "unavailable_window":
        params = {
          days: collectDays(form, "days"),
          time_range: {
            start: form.get("start") as string,
            end: form.get("end") as string,
          },
        };
        break;
      case "hard_stop":
        params = { time: form.get("time"), days: collectDays(form, "days") };
        break;
      case "recurring_unavailable":
        params = {
          recurrence: {
            days: collectDays(form, "days"),
            interval_weeks: Number(form.get("interval_weeks") || 1),
            anchor_date: form.get("anchor_date") || undefined,
          },
        };
        break;
      case "always_off":
        params = { days: collectDays(form, "days") };
        break;
      case "max_consecutive_days":
        params = { max_days: Number(form.get("max_days") || 6) };
        break;
    }

    const scopeType = lockedStaffId ? "staff" : (form.get("scope_type") as string);
    const scopeId = lockedStaffId ?? (form.get("scope_id") as string);

    const payload = {
      scope_type: scopeType,
      scope_id: scopeId,
      rule_type: ruleType,
      params,
      effective_start: form.get("effective_start") || todayStr(),
      effective_end: (form.get("effective_end") as string) || null,
      active: true,
    };

    const result = initial
      ? await updateEntity("constraint_rule", initial.id, payload)
      : await createEntity("constraint_rule", payload);
    setBusy(false);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  const showDays =
    ruleType === "unavailable_window" ||
    ruleType === "hard_stop" ||
    ruleType === "recurring_unavailable" ||
    ruleType === "always_off";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!lockedStaffId && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="scope_type">Applies to</Label>
            <Select id="scope_type" name="scope_type" defaultValue="staff">
              <option value="staff">A person</option>
              <option value="role">A whole role</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="scope_id">Who</Label>
            <Select id="scope_id" name="scope_id" required>
              <optgroup label="People">
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Roles">
                <option value="pharmacist">All pharmacists</option>
                <option value="technician">All technicians</option>
              </optgroup>
            </Select>
          </div>
        </div>
      )}

      <div>
        <Label htmlFor="rule_type">Rule type</Label>
        <Select
          id="rule_type"
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as ConstraintRuleType)}
        >
          {Object.entries(RULE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {ruleType === "hour_cap" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="hours">Max hours</Label>
            <Input
              id="hours"
              name="hours"
              type="number"
              min={1}
              required
              defaultValue={(ip.hours as number) ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="period">Per</Label>
            <Select
              id="period"
              name="period"
              defaultValue={(ip.period as string) ?? "week"}
            >
              <option value="week">Week</option>
              <option value="pay_period">Pay period</option>
              <option value="year">Year</option>
            </Select>
          </div>
        </div>
      )}

      {ruleType === "overtime" && (
        <div>
          <Label htmlFor="threshold_hours">Weekly threshold (hours)</Label>
          <Input
            id="threshold_hours"
            name="threshold_hours"
            type="number"
            defaultValue={(ip.threshold_hours as number) ?? 40}
            min={1}
          />
        </div>
      )}

      {showDays && (
        <div>
          <Label>Days</Label>
          <div className="flex flex-wrap gap-3">
            {CONSTRAINT_DAY_OPTIONS.map((d) => {
              const checked =
                ruleType === "recurring_unavailable"
                  ? (initRec.days ?? []).includes(d)
                  : initDays.includes(d);
              return (
                <label
                  key={d}
                  className="flex items-center gap-1.5 font-body text-sm text-navy"
                >
                  <input
                    type="checkbox"
                    name={`days-${d}`}
                    defaultChecked={checked}
                    className="h-4 w-4 accent-amber"
                  />
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {ruleType === "unavailable_window" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start">From</Label>
            <Input
              id="start"
              name="start"
              type="time"
              required
              defaultValue={initRange.start ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="end">To</Label>
            <Input
              id="end"
              name="end"
              type="time"
              required
              defaultValue={initRange.end ?? ""}
            />
          </div>
        </div>
      )}

      {ruleType === "hard_stop" && (
        <div>
          <Label htmlFor="time">Cannot work past</Label>
          <Input
            id="time"
            name="time"
            type="time"
            required
            defaultValue={(ip.time as string) ?? ""}
          />
        </div>
      )}

      {ruleType === "recurring_unavailable" && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="interval_weeks">Every N weeks</Label>
            <Input
              id="interval_weeks"
              name="interval_weeks"
              type="number"
              min={1}
              defaultValue={initRec.interval_weeks ?? 2}
            />
            <HelpText>2 = every other week</HelpText>
          </div>
          <div>
            <Label htmlFor="anchor_date">Starting from</Label>
            <Input
              id="anchor_date"
              name="anchor_date"
              type="date"
              defaultValue={initRec.anchor_date ?? ""}
            />
          </div>
        </div>
      )}

      {ruleType === "max_consecutive_days" && (
        <div>
          <Label htmlFor="max_days">Max consecutive days</Label>
          <Input
            id="max_days"
            name="max_days"
            type="number"
            min={1}
            defaultValue={(ip.max_days as number) ?? 6}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="effective_start">Effective from</Label>
          <Input
            id="effective_start"
            name="effective_start"
            type="date"
            required
            defaultValue={initial?.effective_start ?? todayStr()}
          />
        </div>
        <div>
          <Label htmlFor="effective_end">Until (optional)</Label>
          <Input
            id="effective_end"
            name="effective_end"
            type="date"
            defaultValue={initial?.effective_end ?? ""}
          />
          <HelpText>Leave blank for open-ended.</HelpText>
        </div>
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

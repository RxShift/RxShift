"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  createEntity,
  deleteEntity,
  updateEntity,
} from "@/lib/actions/settings";
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

const DAY_OPTIONS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function describeParams(rule: ConstraintRule): string {
  const p = rule.params as Record<string, unknown>;
  switch (rule.rule_type) {
    case "hour_cap":
      return `${p.hours} hours per ${p.period ?? "week"}`;
    case "overtime":
      return `over ${p.threshold_hours ?? 40} hours/week`;
    case "unavailable_window": {
      const r = p.time_range as { start: string; end: string } | undefined;
      return `${(p.days as string[])?.join(", ") ?? "any day"}${r ? ` ${r.start}–${r.end}` : ""}`;
    }
    case "hard_stop":
      return `after ${p.time}${p.days ? ` on ${(p.days as string[]).join(", ")}` : ""}`;
    case "recurring_unavailable": {
      const rec = p.recurrence as { days?: string[]; interval_weeks?: number } | undefined;
      return `${rec?.days?.join(", ") ?? ""} every ${rec?.interval_weeks ?? 1} week(s)`;
    }
    case "always_off":
      return (p.days as string[])?.join(", ") ?? "";
    case "max_consecutive_days":
      return `max ${p.max_days} days in a row`;
  }
}

export default function ConstraintManager({
  rules,
  staff,
}: {
  rules: ConstraintRule[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState<ConstraintRuleType>("hour_cap");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffName = (id: string) =>
    staff.find((s) => s.id === id)?.full_name ?? id;

  function collectDays(form: FormData, field: string): string[] {
    return DAY_OPTIONS.filter((d) => form.get(`${field}-${d}`) === "on");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);

    let params: Record<string, unknown> = {};
    switch (ruleType) {
      case "hour_cap":
        params = {
          hours: Number(form.get("hours")),
          period: form.get("period"),
        };
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

    const result = await createEntity("constraint_rule", {
      scope_type: form.get("scope_type"),
      scope_id: form.get("scope_id"),
      rule_type: ruleType,
      params,
      effective_start: form.get("effective_start"),
      effective_end: (form.get("effective_end") as string) || null,
      active: true,
    });

    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function toggleActive(rule: ConstraintRule) {
    setBusy(true);
    await updateEntity("constraint_rule", rule.id, {
      scope_type: rule.scope_type,
      scope_id: rule.scope_id,
      rule_type: rule.rule_type,
      params: rule.params,
      effective_start: rule.effective_start,
      effective_end: rule.effective_end,
      active: !rule.active,
    });
    router.refresh();
    setBusy(false);
  }

  async function remove(rule: ConstraintRule) {
    if (!confirm("Delete this rule?")) return;
    await deleteEntity("constraint_rule", rule.id);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-brand text-base font-bold text-navy">
          Constraint rules
        </h2>
        <Button onClick={() => setOpen(true)}>Add Rule</Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState message="No constraint rules yet. Add hour caps (like a per-diem 960 hours/year), availability windows, or always-off days. RxShift flags conflicts at scheduling time and re-checks published schedules when rules change." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Applies to</Th>
              <Th>Rule</Th>
              <Th>Detail</Th>
              <Th>Effective</Th>
              <Th>Status</Th>
              <Th className="w-28"> </Th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">
                  {r.scope_type === "staff"
                    ? staffName(r.scope_id)
                    : `All ${r.scope_id}s`}
                </Td>
                <Td>{RULE_LABELS[r.rule_type]}</Td>
                <Td>{describeParams(r)}</Td>
                <Td>
                  {r.effective_start}
                  {r.effective_end ? ` → ${r.effective_end}` : " → open"}
                </Td>
                <Td>
                  <Badge tone={r.active ? "compliant" : "neutral"}>
                    {r.active ? "Active" : "Paused"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => toggleActive(r)}
                      disabled={busy}
                      className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="font-body text-xs font-medium text-[#C0392B] underline-offset-2 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add constraint rule"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="constraint-form" disabled={busy}>
              {busy ? "Saving…" : "Add rule"}
            </Button>
          </>
        }
      >
        <form id="constraint-form" onSubmit={handleSubmit} className="space-y-4">
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
                <Input id="hours" name="hours" type="number" min={1} required />
              </div>
              <div>
                <Label htmlFor="period">Per</Label>
                <Select id="period" name="period" defaultValue="week">
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
                defaultValue={40}
                min={1}
              />
            </div>
          )}

          {(ruleType === "unavailable_window" ||
            ruleType === "hard_stop" ||
            ruleType === "recurring_unavailable" ||
            ruleType === "always_off") && (
            <div>
              <Label>Days</Label>
              <div className="flex flex-wrap gap-3">
                {DAY_OPTIONS.map((d) => (
                  <label key={d} className="flex items-center gap-1.5 font-body text-sm text-navy">
                    <input type="checkbox" name={`days-${d}`} className="h-4 w-4 accent-amber" />
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </label>
                ))}
              </div>
            </div>
          )}

          {ruleType === "unavailable_window" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start">From</Label>
                <Input id="start" name="start" type="time" required />
              </div>
              <div>
                <Label htmlFor="end">To</Label>
                <Input id="end" name="end" type="time" required />
              </div>
            </div>
          )}

          {ruleType === "hard_stop" && (
            <div>
              <Label htmlFor="time">Cannot work past</Label>
              <Input id="time" name="time" type="time" required />
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
                  defaultValue={2}
                />
                <HelpText>2 = every other week</HelpText>
              </div>
              <div>
                <Label htmlFor="anchor_date">Starting from</Label>
                <Input id="anchor_date" name="anchor_date" type="date" />
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
                defaultValue={6}
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
              />
            </div>
            <div>
              <Label htmlFor="effective_end">Until (optional)</Label>
              <Input id="effective_end" name="effective_end" type="date" />
              <HelpText>Leave blank for open-ended or to-be-determined.</HelpText>
            </div>
          </div>

          {error && <p className="font-body text-sm text-[#C0392B]">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

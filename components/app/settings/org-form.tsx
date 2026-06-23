"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { TIMEZONES } from "@/lib/seeds";
import { updateTenant } from "@/lib/actions/settings";
import type { Tenant } from "@/lib/types";

export default function OrgSettingsForm({ tenant }: { tenant: Tenant }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const data = new FormData(e.currentTarget);
    const result = await updateTenant({
      name: data.get("name"),
      timezone: data.get("timezone"),
      schedule_cycle: data.get("schedule_cycle"),
      ratio_slot_minutes: data.get("ratio_slot_minutes"),
      has_ratio: data.get("has_ratio") === "on",
      default_break_minutes: data.get("default_break_minutes"),
      nevada_r072_25: data.get("nevada_r072_25") === "on",
      pto_reason_required: data.get("pto_reason_required") === "on",
    });
    setMessage(result.ok ? "Saved." : result.error);
    setSaving(false);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label htmlFor="name">Pharmacy / organization name</Label>
          <Input id="name" name="name" defaultValue={tenant.name} required />
        </div>
        <div>
          <Label htmlFor="timezone">Timezone</Label>
          <Select id="timezone" name="timezone" defaultValue={tenant.timezone}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="schedule_cycle">Build cadence</Label>
          <Select
            id="schedule_cycle"
            name="schedule_cycle"
            defaultValue={tenant.schedule_cycle}
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
          </Select>
          <HelpText>
            You build and publish in this cadence — each published period is one{" "}
            {tenant.schedule_cycle === "monthly"
              ? "month"
              : tenant.schedule_cycle === "biweekly"
                ? "two weeks"
                : "week"}
            . You can still view the schedule by week, two weeks, or month at any
            time; this only sets how you build. Biweekly cadences tend to reduce
            unplanned callouts.
          </HelpText>
        </div>
        <div>
          <Label htmlFor="ratio_slot_minutes">Ratio slot length</Label>
          <Select
            id="ratio_slot_minutes"
            name="ratio_slot_minutes"
            defaultValue={String(tenant.ratio_slot_minutes)}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </Select>
          <HelpText>
            How finely ratio is evaluated. The Compliance Record always rolls
            up to hourly.
          </HelpText>
        </div>
        <div>
          <Label htmlFor="default_break_minutes">
            Default unpaid break (minutes)
          </Label>
          <Input
            id="default_break_minutes"
            name="default_break_minutes"
            type="number"
            min={0}
            max={240}
            step={5}
            defaultValue={String(tenant.default_break_minutes ?? 30)}
            className="w-32"
          />
          <HelpText>
            Pre-filled on new shifts of 6+ hours and subtracted from paid
            hours (an 8.5-hour shift counts as 8). Doesn&rsquo;t affect ratio
            coverage — lunches are tracked live on the board.
          </HelpText>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id="has_ratio"
            name="has_ratio"
            defaultChecked={tenant.has_ratio}
            className="h-4 w-4 accent-amber"
          />
          <label htmlFor="has_ratio" className="font-body text-sm text-navy">
            We have a pharmacist-to-technician ratio requirement
          </label>
        </div>
        <div className="flex items-start gap-2.5">
          <input
            type="checkbox"
            id="pto_reason_required"
            name="pto_reason_required"
            defaultChecked={tenant.pto_reason_required}
            className="mt-0.5 h-4 w-4 accent-amber"
          />
          <label
            htmlFor="pto_reason_required"
            className="font-body text-sm text-navy"
          >
            Require a reason on PTO
            <span className="block font-body text-xs text-steel">
              When on, a reason must be entered to save time off (whether a
              scheduler enters it directly or approves a request). The reason is
              stored with the PTO record, never in the compliance override log.
            </span>
          </label>
        </div>
        <div className="rounded-lg border border-line bg-cloud/40 p-4">
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="nevada_r072_25"
              name="nevada_r072_25"
              defaultChecked={tenant.nevada_r072_25}
              className="h-4 w-4 accent-amber"
            />
            <label
              htmlFor="nevada_r072_25"
              className="font-body text-sm font-medium text-navy"
            >
              Apply Nevada R072-25 rules (proposed — not yet adopted)
            </label>
          </div>
          <HelpText>
            Current Nevada law (NAC 639.250) is always enforced. Turn this on to
            preview the proposed R072-25 rules at your retail locations: a 4-tech
            ceiling (or 2 techs + 2 trainees) and a minimum-staffing floor when a
            single pharmacist is on duty. R072-25 had its public hearing in June
            2026 and is not yet law — leave this off until it&rsquo;s adopted.
          </HelpText>
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-5">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          {message && (
            <span
              className={`font-body text-sm ${message === "Saved." ? "text-compliant" : "text-deficiency"}`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

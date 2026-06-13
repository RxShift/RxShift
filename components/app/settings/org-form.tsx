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
          <Label htmlFor="schedule_cycle">Schedule cycle</Label>
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
            Biweekly cycles tend to reduce unplanned callouts.
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
            How finely ratio is evaluated. The compliance record always rolls
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

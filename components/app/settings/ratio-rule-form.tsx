"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { US_STATES } from "@/lib/seeds";
import { upsertRatioRule } from "@/lib/actions/settings";
import type { RatioRule } from "@/lib/types";

export default function RatioRuleForm({
  tenantRule,
  nvSeed,
}: {
  tenantRule: RatioRule | null;
  nvSeed: RatioRule | null;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const data = new FormData(e.currentTarget);
    const result = await upsertRatioRule({
      state: data.get("state"),
      max_techs_per_pharmacist: data.get("max_techs_per_pharmacist"),
      notes: data.get("notes") || null,
    });
    setMessage(result.ok ? "Saved." : result.error);
    setSaving(false);
    if (result.ok) router.refresh();
  }

  const rule = tenantRule;

  return (
    <Card>
      <h2 className="mb-1 font-brand text-base font-bold text-navy">
        Your ratio rule
      </h2>
      <p className="mb-5 font-body text-sm text-steel">
        The maximum number of counting technicians one pharmacist may
        supervise. RxShift seeds known state defaults — always verify against
        your board&rsquo;s current language before relying on it.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="state">State</Label>
            <Select id="state" name="state" defaultValue={rule?.state ?? "NV"}>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="max_techs_per_pharmacist">
              Max techs per pharmacist
            </Label>
            <Input
              id="max_techs_per_pharmacist"
              name="max_techs_per_pharmacist"
              type="number"
              min={1}
              max={10}
              required
              defaultValue={
                rule?.max_techs_per_pharmacist ??
                nvSeed?.max_techs_per_pharmacist ??
                3
              }
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            name="notes"
            defaultValue={rule?.notes ?? ""}
            placeholder="Anything your team should know about this rule"
          />
          {nvSeed && (
            <HelpText>
              Nevada default: {nvSeed.max_techs_per_pharmacist} techs per
              pharmacist ({nvSeed.source_citation}). One technician plus two
              trainees is the alternative composition.
            </HelpText>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : rule ? "Update rule" : "Set rule"}
          </Button>
          {message && (
            <span
              className={`font-body text-sm ${message === "Saved." ? "text-[#2E7D5E]" : "text-[#C0392B]"}`}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

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
  const [formula, setFormula] = useState<"flat" | "additive">(
    tenantRule?.formula ?? "flat"
  );
  const [stateCode, setStateCode] = useState(tenantRule?.state ?? "NV");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const data = new FormData(e.currentTarget);
    const result = await upsertRatioRule({
      state: data.get("state"),
      max_techs_per_pharmacist: data.get("max_techs_per_pharmacist"),
      formula,
      additive_first_techs: data.get("additive_first_techs") || null,
      additive_additional_techs: data.get("additive_additional_techs") || null,
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
            <Select
              id="state"
              name="state"
              value={stateCode}
              onChange={(e) => setStateCode(e.target.value)}
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="formula">Rule type</Label>
            <Select
              id="formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value as "flat" | "additive")}
            >
              <option value="flat">Flat — each pharmacist adds the same</option>
              <option value="additive">
                Additive — first pharmacist adds less (California)
              </option>
            </Select>
          </div>
        </div>
        {formula === "flat" ? (
          <div className="max-w-[280px]">
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
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {/* keep a value posted for the flat column even in additive mode */}
            <input
              type="hidden"
              name="max_techs_per_pharmacist"
              value={rule?.max_techs_per_pharmacist ?? 1}
            />
            <div>
              <Label htmlFor="additive_first_techs">
                Techs allowed by FIRST pharmacist
              </Label>
              <Input
                id="additive_first_techs"
                name="additive_first_techs"
                type="number"
                min={0}
                max={10}
                required
                defaultValue={rule?.additive_first_techs ?? 1}
              />
            </div>
            <div>
              <Label htmlFor="additive_additional_techs">
                Techs added by EACH ADDITIONAL pharmacist
              </Label>
              <Input
                id="additive_additional_techs"
                name="additive_additional_techs"
                type="number"
                min={0}
                max={10}
                required
                defaultValue={rule?.additive_additional_techs ?? 2}
              />
              <HelpText>
                California (BPC 4115): first = 1, each additional = 2 — so two
                pharmacists allow 3 techs, three allow 5.
              </HelpText>
            </div>
          </div>
        )}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Input
            id="notes"
            name="notes"
            defaultValue={rule?.notes ?? ""}
            placeholder="Anything your team should know about this rule"
          />
          {stateCode === "TN" ? (
            <HelpText>
              Tennessee: certified (CPhT) technicians are <strong>uncapped</strong>
              {" "}— the limit above applies to non-certified technicians only.
              Mark certified staff with the CPhT checkbox in the staff directory.
            </HelpText>
          ) : (
            nvSeed && (
              <HelpText>
                Nevada default: {nvSeed.max_techs_per_pharmacist} techs per
                pharmacist ({nvSeed.source_citation}). One technician plus two
                trainees is the alternative composition.
              </HelpText>
            )
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : rule ? "Update rule" : "Set rule"}
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

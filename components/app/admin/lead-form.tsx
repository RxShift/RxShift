"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/form";
import { createLead, updateLead } from "@/lib/actions/crm";
import type { Lead } from "@/lib/types";

const SOURCES = ["inbound", "referral", "LinkedIn", "Susie", "cold"] as const;
const STAGES = ["Lead", "Demo", "Trial", "Active", "Churned"] as const;

export default function LeadForm({ initial }: { initial: Lead | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const data = new FormData(e.currentTarget);
    const values = {
      pharmacy_name: data.get("pharmacy_name"),
      location_count: data.get("location_count"),
      contact_name: (data.get("contact_name") as string) || null,
      contact_email: data.get("contact_email"),
      contact_phone: (data.get("contact_phone") as string) || null,
      source: data.get("source"),
      stage: data.get("stage"),
      state: (data.get("state") as string) || null,
      message: (data.get("message") as string) || null,
    };

    if (initial) {
      const result = await updateLead(initial.id, values);
      setMessage(result.ok ? "Saved." : result.error);
      if (result.ok) router.refresh();
    } else {
      const result = await createLead(values);
      if (result.ok && result.data) {
        router.push(`/app/admin/leads/${result.data.id}`);
        return;
      }
      setMessage(result.ok ? null : result.error);
    }
    setBusy(false);
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="pharmacy_name">Pharmacy name</Label>
            <Input
              id="pharmacy_name"
              name="pharmacy_name"
              required
              defaultValue={initial?.pharmacy_name ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="location_count">Locations</Label>
            <Input
              id="location_count"
              name="location_count"
              type="number"
              min={1}
              max={999}
              defaultValue={initial?.location_count ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="contact_name">Contact name</Label>
            <Input
              id="contact_name"
              name="contact_name"
              defaultValue={initial?.contact_name ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="contact_email">Contact email</Label>
            <Input
              id="contact_email"
              name="contact_email"
              type="email"
              defaultValue={initial?.contact_email ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="contact_phone">Contact phone</Label>
            <Input
              id="contact_phone"
              name="contact_phone"
              defaultValue={initial?.contact_phone ?? ""}
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="stage">Stage</Label>
            <Select id="stage" name="stage" defaultValue={initial?.stage ?? "Lead"}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="source">Source</Label>
            <Select
              id="source"
              name="source"
              defaultValue={initial?.source ?? "inbound"}
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="state">State</Label>
            <Input
              id="state"
              name="state"
              placeholder="Nevada"
              defaultValue={initial?.state ?? ""}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="message">Original message / context</Label>
          <Textarea
            id="message"
            name="message"
            rows={3}
            defaultValue={initial?.message ?? ""}
          />
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Add lead"}
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

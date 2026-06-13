"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { updateLiveStatusConfig } from "@/lib/actions/settings";
import { LOCKED_STATUS, type ResolvedStatus } from "@/lib/live-status-config";

export default function LiveStatusesManager({
  initial,
}: {
  initial: ResolvedStatus[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function patch(value: string, change: Partial<ResolvedStatus>) {
    setRows((rs) => rs.map((r) => (r.value === value ? { ...r, ...change } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const result = await updateLiveStatusConfig({
      statuses: rows.map((r) => ({
        status: r.value,
        enabled: r.enabled,
        label: r.label,
        counts_toward_ratio: r.counts,
      })),
    });
    setMessage(result.ok ? "Saved." : result.error);
    setSaving(false);
    if (result.ok) router.refresh();
  }

  return (
    <Card>
      <h2 className="mb-1 font-brand text-base font-bold text-navy">
        Live-board statuses
      </h2>
      <p className="mb-5 font-body text-sm text-steel">
        Choose which statuses your team can pick on the live board and My
        Schedule, rename them to match how your pharmacy talks, and set whether
        each one counts toward the pharmacist-to-technician ratio.
        &ldquo;Working&rdquo; is always shown and always counts.
      </p>

      <div className="space-y-3">
        {rows.map((r) => {
          const locked = r.value === LOCKED_STATUS;
          return (
            <div
              key={r.value}
              className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <Input
                className="sm:flex-1"
                value={r.label}
                maxLength={40}
                onChange={(e) => patch(r.value, { label: e.target.value })}
                aria-label="Status label"
              />
              <div className="flex items-center gap-5">
                <label className="flex items-center gap-1.5 font-body text-sm text-navy">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber disabled:opacity-50"
                    checked={r.enabled}
                    disabled={locked}
                    onChange={(e) => patch(r.value, { enabled: e.target.checked })}
                  />
                  Shown
                </label>
                <label className="flex items-center gap-1.5 font-body text-sm text-navy">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-amber disabled:opacity-50"
                    checked={r.counts}
                    disabled={locked}
                    onChange={(e) => patch(r.value, { counts: e.target.checked })}
                  />
                  Counts toward ratio
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save statuses"}
        </Button>
        {message && (
          <span
            className={`font-body text-sm ${
              message === "Saved." ? "text-compliant" : "text-deficiency"
            }`}
          >
            {message}
          </span>
        )}
      </div>
    </Card>
  );
}

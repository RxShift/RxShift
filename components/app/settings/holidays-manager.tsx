"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HelpText, Input, Label } from "@/components/ui/form";
import {
  deleteHoliday,
  generateHolidaysForYear,
  upsertHoliday,
} from "@/lib/actions/holidays";
import { fmtDay } from "@/lib/dates";
import type { Holiday } from "@/lib/types";

type Result = { ok: boolean; error?: string };

export default function HolidaysManager({ initial }: { initial: Holiday[] }) {
  const router = useRouter();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<Result>, okMsg?: string) {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    if (r.ok) {
      if (okMsg) setMsg(okMsg);
      router.refresh();
    } else {
      setMsg(r.error ?? "Something went wrong.");
    }
  }

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h2 className="font-brand text-base font-bold text-navy">Holidays</h2>
          <HelpText>
            Tenant-wide and uniform across all your locations. Holidays only tint
            and label the day on the schedule — they never block staffing, so you
            can still staff a holiday and see who&rsquo;s working it.
          </HelpText>
        </div>

        {/* Generate from the built-in US federal generator (deterministic; no
            network). It includes the observed-day rule — e.g. when July 4 is a
            Saturday it generates Friday, July 3. */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-cloud/40 p-4">
          <div>
            <Label htmlFor="year">Generate US federal holidays</Label>
            <Input
              id="year"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-28"
            />
          </div>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => generateHolidaysForYear(parseInt(year, 10)),
                `Generated US federal holidays for ${year}.`
              )
            }
          >
            Generate
          </Button>
          <HelpText>
            Adds any missing federal holidays for the year. It won&rsquo;t change
            ones you&rsquo;ve already added or edited.
          </HelpText>
        </div>

        {/* Existing holidays */}
        <div className="space-y-1.5">
          {initial.length === 0 && (
            <p className="font-body text-sm text-steel">
              No holidays yet. Generate a year above, or add one below.
            </p>
          )}
          {initial.map((h) => {
            const day = fmtDay(h.date);
            return editingId === h.id ? (
              <div
                key={h.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2.5"
              >
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-[180px] flex-1"
                />
                <Button
                  disabled={busy || !editDate || !editName.trim()}
                  onClick={() =>
                    run(
                      () =>
                        upsertHoliday({
                          id: h.id,
                          date: editDate,
                          name: editName.trim(),
                        }),
                      "Saved."
                    ).then(() => setEditingId(null))
                  }
                >
                  Save
                </Button>
                <Button variant="secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div
                key={h.id}
                className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2"
              >
                <span className="w-24 font-body text-[13px] font-medium text-steel">
                  {day.dow} {day.label}
                </span>
                <span className="flex-1 font-body text-sm text-navy">
                  {h.name}
                </span>
                <button
                  type="button"
                  className="font-body text-xs font-medium text-navy hover:underline"
                  onClick={() => {
                    setEditingId(h.id);
                    setEditDate(h.date);
                    setEditName(h.name);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="font-body text-xs font-medium text-deficiency hover:underline"
                  onClick={() => run(() => deleteHoliday(h.id))}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>

        {/* Add one */}
        <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
          <div>
            <Label htmlFor="new-date">Add a holiday</Label>
            <Input
              id="new-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Input
            aria-label="Holiday name"
            placeholder="e.g. Day after Thanksgiving"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="min-w-[200px] flex-1"
          />
          <Button
            disabled={busy || !newDate || !newName.trim()}
            onClick={() =>
              run(
                () => upsertHoliday({ date: newDate, name: newName.trim() }),
                "Added."
              ).then(() => {
                setNewDate("");
                setNewName("");
              })
            }
          >
            Add
          </Button>
        </div>

        {msg && (
          <p
            className={`font-body text-sm ${
              msg.endsWith(".") &&
              !msg.toLowerCase().includes("wrong") &&
              !msg.toLowerCase().includes("valid")
                ? "text-compliant"
                : "text-deficiency"
            }`}
          >
            {msg}
          </p>
        )}
      </div>
    </Card>
  );
}

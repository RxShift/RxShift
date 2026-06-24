"use client";

// Period-level propose-and-accept: "Apply scheduling rules" on the builder. Resolves
// every active rule for the open window (deterministically), groups concrete
// proposals by person, and lets the scheduler Accept individually, per-person, or all
// at once — Lucy's manual "plug in the regular schedule" step, in one place. Advisory
// warnings (quotas, quarterly project days, day-specific reminders) list below with a
// logged Dismiss. Nothing auto-commits.

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { fmtDay } from "@/lib/dates";
import { fmtTime } from "@/lib/scheduling-rules-display";
import {
  applyRuleProposals,
  dismissRuleWarning,
  resolveProposals,
  type ProposalDTO,
  type UnmetDTO,
} from "@/lib/actions/scheduling-rules";

export default function RulesApplyModal({
  open,
  onClose,
  windowStart,
  windowEnd,
  windowLabel,
  locationFilter,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
  locationFilter: string | null;
  onApplied: () => void;
}) {
  const [proposals, setProposals] = useState<ProposalDTO[] | null>(null);
  const [unmet, setUnmet] = useState<UnmetDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProposals(null);
    setError(null);
    const res = await resolveProposals({ windowStart, windowEnd, locationFilter });
    if (res.ok && res.data) {
      setProposals(res.data.proposals);
      setUnmet(res.data.unmet);
    } else if (!res.ok) {
      setError(res.error);
      setProposals([]);
    }
  }, [windowStart, windowEnd, locationFilter]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function accept(items: ProposalDTO[]) {
    const usable = items.filter((p) => p.location_id);
    if (usable.length === 0) return;
    setBusy(true);
    setError(null);
    const res = await applyRuleProposals({
      proposals: usable.map((p) => ({
        staff_id: p.staff_id,
        date: p.date,
        start_time: p.start_time,
        end_time: p.end_time,
        work_type_id: p.work_type_id,
        location_id: p.location_id,
      })),
    });
    setBusy(false);
    if (res.ok) {
      await load();
      onApplied();
    } else {
      setError(res.error);
    }
  }

  async function dismiss(u: UnmetDTO) {
    const reason = prompt(`Dismiss this rule warning?\n\n${u.message}\n\nReason (logged):`);
    if (!reason || !reason.trim()) return;
    setBusy(true);
    const res = await dismissRuleWarning(u.rule_id, reason);
    setBusy(false);
    if (res.ok) setUnmet((prev) => prev.filter((x) => x !== u));
    else setError(res.error);
  }

  // Group proposals by staff for display.
  const byStaff = new Map<string, ProposalDTO[]>();
  for (const p of proposals ?? []) {
    const list = byStaff.get(p.staff_id) ?? [];
    list.push(p);
    byStaff.set(p.staff_id, list);
  }
  const usableCount = (proposals ?? []).filter((p) => p.location_id).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply scheduling rules"
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {usableCount > 0 && (
            <Button disabled={busy} onClick={() => accept(proposals ?? [])}>
              {busy ? "Working…" : `Accept all (${usableCount})`}
            </Button>
          )}
        </>
      }
    >
      <p className="mb-3 font-body text-[13px] text-steel">
        What your scheduling rules say for{" "}
        <span className="font-medium text-navy">{windowLabel}</span>
        {locationFilter ? " (this location)" : ""}. Accept to add the shift —
        nothing is scheduled until you do.
      </p>

      {proposals === null ? (
        <p className="font-body text-sm text-steel">Checking rules…</p>
      ) : usableCount === 0 && unmet.length === 0 ? (
        <p className="font-body text-sm text-steel">
          No rule-driven shifts to propose for this window. Either everything the
          rules call for is already scheduled, or there are no recurring rules yet
          (add them on each person&rsquo;s staff record).
        </p>
      ) : (
        <div className="max-h-[55vh] space-y-4 overflow-auto">
          {[...byStaff.entries()].map(([sid, items]) => (
            <div key={sid}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="font-brand text-[12px] font-bold text-navy">
                  {items[0].staff_name}
                </p>
                {items.filter((p) => p.location_id).length > 1 && (
                  <button
                    disabled={busy}
                    onClick={() => accept(items)}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Accept all for {items[0].staff_name.split(" ")[0]}
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {items.map((p, i) => {
                  const day = fmtDay(p.date);
                  return (
                    <div
                      key={`${p.rule_id}-${p.date}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="font-body text-[13px] text-navy">
                          {day.dow} {day.label}: {p.work_type_name ?? "Shift"},{" "}
                          {fmtTime(p.start_time)}–{fmtTime(p.end_time)}
                          {p.location_name ? ` · ${p.location_name}` : ""}
                        </p>
                        {!p.location_id && (
                          <p className="font-body text-[11px] text-alert">
                            ⚠ no location — set {items[0].staff_name}&rsquo;s home
                            location first
                          </p>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        disabled={busy || !p.location_id}
                        onClick={() => accept([p])}
                      >
                        Accept
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {unmet.length > 0 && (
            <div>
              <p className="mb-1.5 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-alert">
                Unmet rules ({unmet.length})
              </p>
              <ul className="space-y-1">
                {unmet.map((u, i) => (
                  <li
                    key={`${u.rule_id}-${i}`}
                    className="flex items-start justify-between gap-3 font-body text-[12px] text-navy"
                  >
                    <span>
                      <span className="font-medium">{u.staff_name}:</span>{" "}
                      {u.message}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() => dismiss(u)}
                      className="shrink-0 font-medium text-steel underline-offset-2 hover:underline"
                    >
                      Dismiss
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 font-body text-sm text-deficiency">{error}</p>
      )}
    </Modal>
  );
}

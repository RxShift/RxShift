"use client";

// Per-person rule proposals for the open builder window: "here's what the rules say
// for this person this week → Accept." Deterministic (no LLM) — it calls the
// resolver, shows accept-able shift proposals + advisory warnings, and applies the
// ones the scheduler accepts. Mirrors Ask AI's propose → confirm shape.

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/button";
import { fmtDay } from "@/lib/dates";
import { fmtTime } from "@/lib/scheduling-rules-display";
import {
  applyRuleProposals,
  dismissRuleWarning,
  resolveProposals,
  type ProposalDTO,
  type UnmetDTO,
} from "@/lib/actions/scheduling-rules";

export default function RuleProposalsSection({
  staffId,
  staffName,
  window: win,
  onApplied,
}: {
  staffId: string;
  staffName: string;
  window: { start: string; end: string; label?: string };
  onApplied?: () => void;
}) {
  const [proposals, setProposals] = useState<ProposalDTO[] | null>(null);
  const [unmet, setUnmet] = useState<UnmetDTO[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await resolveProposals({
      windowStart: win.start,
      windowEnd: win.end,
      staffId,
    });
    if (res.ok && res.data) {
      setProposals(res.data.proposals);
      setUnmet(res.data.unmet);
    } else if (!res.ok) {
      setError(res.error);
      setProposals([]);
    }
  }, [win.start, win.end, staffId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      onApplied?.();
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
    if (res.ok) {
      setUnmet((prev) => prev.filter((x) => x !== u));
    } else {
      setError(res.error);
    }
  }

  const hasContent = (proposals && proposals.length > 0) || unmet.length > 0;

  return (
    <section className="rounded-lg border border-amber/40 bg-amber/[0.06] p-4">
      <h3 className="font-brand text-[11px] font-bold uppercase tracking-[0.6px] text-steel">
        Rules for {win.label ?? `${win.start} – ${win.end}`}
      </h3>

      {proposals === null ? (
        <p className="mt-1 font-body text-[13px] text-steel">Checking rules…</p>
      ) : !hasContent ? (
        <p className="mt-1 font-body text-[13px] text-steel">
          {staffName}&rsquo;s rules are all satisfied for this window. ✓
        </p>
      ) : (
        <div className="mt-2 space-y-3">
          {proposals.length > 0 && (
            <div className="space-y-1.5">
              {proposals.map((p, i) => {
                const day = fmtDay(p.date);
                return (
                  <div
                    key={`${p.rule_id}-${p.date}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="font-body text-[13px] font-medium text-navy">
                        {day.dow} {day.label}
                        {": "}
                        {p.work_type_name ?? "Shift"}, {fmtTime(p.start_time)}–
                        {fmtTime(p.end_time)}
                      </p>
                      <p className="truncate font-body text-[11px] text-steel">
                        {p.label}
                        {p.location_name ? ` · ${p.location_name}` : ""}
                        {!p.location_id ? " · ⚠ set a home location first" : ""}
                      </p>
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
              {proposals.filter((p) => p.location_id).length > 1 && (
                <div className="flex justify-end">
                  <Button disabled={busy} onClick={() => accept(proposals)}>
                    {busy ? "Working…" : `Accept all (${proposals.filter((p) => p.location_id).length})`}
                  </Button>
                </div>
              )}
            </div>
          )}

          {unmet.length > 0 && (
            <ul className="space-y-1">
              {unmet.map((u, i) => (
                <li
                  key={`${u.rule_id}-${i}`}
                  className="flex items-start justify-between gap-3 font-body text-[12px] text-alert"
                >
                  <span>⚠ {u.message}</span>
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
          )}
        </div>
      )}

      {error && (
        <p className="mt-2 font-body text-[12px] text-deficiency">{error}</p>
      )}
    </section>
  );
}

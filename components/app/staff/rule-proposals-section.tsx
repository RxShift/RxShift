"use client";

// Per-person rule proposals for the open builder window ("here's what the rules say
// for this person this week → Accept"). Placeholder until Phase 3 wires the
// deterministic resolver (lib/engine/scheduling-rules.ts) + applyRuleProposals.

export default function RuleProposalsSection({
  staffName,
  window: win,
}: {
  staffId: string;
  staffName: string;
  window: { start: string; end: string; label?: string };
  onApplied?: () => void;
}) {
  return (
    <section className="rounded-lg border border-dashed border-line bg-cloud/40 p-4">
      <h3 className="font-brand text-[11px] font-bold uppercase tracking-[0.6px] text-steel">
        Rules for {win.label ?? `${win.start} – ${win.end}`}
      </h3>
      <p className="mt-1 font-body text-[13px] text-steel">
        Rule-driven proposals for {staffName} will appear here.
      </p>
    </section>
  );
}

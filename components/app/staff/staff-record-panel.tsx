"use client";

// The full staff record: everything that governs how a person gets scheduled, in
// one place — core fields + scheduling notes + ratio-exclusion flag, their
// constraints, their scheduling rules, and an availability summary. Self-loads by
// staffId so BOTH call sites stay simple: the staff list and the schedule builder
// each just render <SlideOver><StaffRecordPanel …/></SlideOver>. Each section saves
// independently; after any write we reload and notify the parent (onChanged) so the
// grid behind a builder slide-over refreshes in place.

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import {
  getStaffRecord,
  type StaffRecordData,
} from "@/lib/actions/staff";
import { deleteEntity, updateEntity } from "@/lib/actions/settings";
import StaffFieldsForm from "./staff-fields-form";
import RuleForm from "./rule-form";
import RuleProposalsSection from "./rule-proposals-section";
import ConstraintForm from "@/components/app/constraints/constraint-form";
import {
  CONSTRAINT_RULE_LABELS,
  describeConstraint,
} from "@/lib/constraints-display";
import {
  RULE_TYPE_LABELS,
  describeRule,
} from "@/lib/scheduling-rules-display";
import type {
  ConstraintRule,
  StaffSchedulingRule,
} from "@/lib/types";

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-brand text-[11px] font-bold uppercase tracking-[0.6px] text-steel">
      {children}
    </h3>
  );
}

export default function StaffRecordPanel({
  staffId,
  proposalWindow,
  avatarUrl,
  onChanged,
}: {
  staffId: string;
  /** When set (opened from the builder), shows rule proposals for this window. */
  proposalWindow?: { start: string; end: string; label?: string } | null;
  avatarUrl?: string;
  /** Called after any successful write, so the parent can refresh its view. */
  onChanged?: () => void;
}) {
  const [data, setData] = useState<StaffRecordData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingConstraint, setEditingConstraint] = useState<
    ConstraintRule | "new" | null
  >(null);
  const [editingRule, setEditingRule] = useState<
    StaffSchedulingRule | "new" | null
  >(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Confirm-delete dialog target (replaces native confirm() so the action works
  // under branding + automated QA, which can't drive native dialogs).
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "rule" | "constraint"; id: string; label: string }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await getStaffRecord(staffId);
    if (res.ok) setData(res.data ?? null);
    else setError(res.error);
  }, [staffId]);

  useEffect(() => {
    void load();
  }, [load]);

  function afterChange() {
    setEditingConstraint(null);
    setEditingRule(null);
    void load();
    onChanged?.();
  }

  if (error)
    return <p className="font-body text-sm text-deficiency">{error}</p>;
  if (!data)
    return <p className="font-body text-sm text-steel">Loading…</p>;

  const { staff, account, locations, workTypes, constraints, rules, canEditRoles } =
    data;
  const workTypeName = (id: string) =>
    workTypes.find((w) => w.id === id)?.name;
  const locationName = (id: string) =>
    locations.find((l) => l.id === id)?.name;

  const availabilityConstraints = constraints.filter(
    (c) =>
      c.active &&
      [
        "unavailable_window",
        "always_off",
        "hard_stop",
        "recurring_unavailable",
        "max_consecutive_days",
      ].includes(c.rule_type)
  );

  return (
    <div className="space-y-7">
      {/* Rule proposals (builder context only) — what the rules say for this week. */}
      {proposalWindow && (
        <RuleProposalsSection
          staffId={staffId}
          staffName={staff.full_name}
          window={proposalWindow}
          onApplied={afterChange}
        />
      )}

      {/* ── Scheduling rules ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Scheduling rules</SectionHeading>
          {editingRule === null && (
            <Button variant="secondary" onClick={() => setEditingRule("new")}>
              Add rule
            </Button>
          )}
        </div>
        {editingRule !== null ? (
          <div className="rounded-lg border border-line bg-cloud/40 p-4">
            <RuleForm
              staffId={staffId}
              workTypes={workTypes}
              locations={locations}
              initial={editingRule === "new" ? null : editingRule}
              onSaved={afterChange}
              onCancel={() => setEditingRule(null)}
            />
          </div>
        ) : rules.length === 0 ? (
          <p className="font-body text-[13px] text-steel">
            No scheduling rules yet. Add the person&rsquo;s regular pattern and any
            recurring assignments (e.g. &ldquo;every other Monday: Hospice&rdquo;).
          </p>
        ) : (
          <ul className="space-y-1.5">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
              >
                <div>
                  <p
                    className={`font-body text-[13px] ${r.is_active ? "text-navy" : "text-steel line-through"}`}
                  >
                    {describeRule(r, { workTypeName, locationName })}
                  </p>
                  <p className="mt-0.5 font-body text-[11px] text-steel">
                    {RULE_TYPE_LABELS[r.rule_type]}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2.5 pt-0.5">
                  <button
                    onClick={() => setEditingRule(r)}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    disabled={busyId === r.id}
                    onClick={async () => {
                      setBusyId(r.id);
                      await updateEntity("staff_scheduling_rule", r.id, {
                        staff_id: r.staff_id,
                        rule_type: r.rule_type,
                        work_type_id: r.work_type_id,
                        location_id: r.location_id,
                        frequency: r.frequency,
                        params: r.params,
                        notes: r.notes,
                        is_active: !r.is_active,
                      });
                      setBusyId(null);
                      afterChange();
                    }}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {r.is_active ? "Pause" : "Resume"}
                  </button>
                  <button
                    onClick={() =>
                      setPendingDelete({
                        kind: "rule",
                        id: r.id,
                        label: describeRule(r, { workTypeName, locationName }),
                      })
                    }
                    className="font-body text-xs font-medium text-deficiency underline-offset-2 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Constraints ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionHeading>Constraints (guards)</SectionHeading>
          {editingConstraint === null && (
            <Button
              variant="secondary"
              onClick={() => setEditingConstraint("new")}
            >
              Add constraint
            </Button>
          )}
        </div>
        {editingConstraint !== null ? (
          <div className="rounded-lg border border-line bg-cloud/40 p-4">
            <ConstraintForm
              staff={[staff]}
              lockedStaffId={staffId}
              initial={editingConstraint === "new" ? null : editingConstraint}
              onSaved={afterChange}
              onCancel={() => setEditingConstraint(null)}
            />
          </div>
        ) : constraints.length === 0 ? (
          <p className="font-body text-[13px] text-steel">
            No constraints. Add hour caps, unavailable windows, or always-off days
            — RxShift flags conflicts at scheduling time.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {constraints.map((c) => (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface px-3 py-2"
              >
                <div>
                  <p
                    className={`font-body text-[13px] ${c.active ? "text-navy" : "text-steel line-through"}`}
                  >
                    {CONSTRAINT_RULE_LABELS[c.rule_type]}: {describeConstraint(c)}
                  </p>
                  <p className="mt-0.5 font-body text-[11px] text-steel">
                    {c.effective_start}
                    {c.effective_end ? ` → ${c.effective_end}` : " → open"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2.5 pt-0.5">
                  <button
                    onClick={() => setEditingConstraint(c)}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() =>
                      setPendingDelete({
                        kind: "constraint",
                        id: c.id,
                        label: `${CONSTRAINT_RULE_LABELS[c.rule_type]}: ${describeConstraint(c)}`,
                      })
                    }
                    className="font-body text-xs font-medium text-deficiency underline-offset-2 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Availability summary (read-only roll-up) ─────────────────────── */}
      <section className="space-y-2">
        <SectionHeading>Availability</SectionHeading>
        {availabilityConstraints.length === 0 ? (
          <p className="font-body text-[13px] text-steel">
            No availability limits set. PTO and approved time off still block
            scheduling on those days.
          </p>
        ) : (
          <ul className="space-y-1 font-body text-[13px] text-navy">
            {availabilityConstraints.map((c) => (
              <li key={c.id}>
                · {CONSTRAINT_RULE_LABELS[c.rule_type]}: {describeConstraint(c)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Core fields ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <SectionHeading>Person &amp; ratio</SectionHeading>
          {staff.excluded_from_ratio && (
            <Badge tone="neutral">Excluded from ratio</Badge>
          )}
        </div>
        <StaffFieldsForm
          initial={staff}
          initialAccount={account}
          locations={locations}
          canEditRoles={canEditRoles}
          avatarUrl={avatarUrl}
          onSaved={afterChange}
        />
      </section>

      {/* Delete confirmation (rules + constraints) */}
      <Modal
        open={pendingDelete !== null}
        onClose={() => !deleting && setPendingDelete(null)}
        title={
          pendingDelete?.kind === "constraint"
            ? "Delete constraint?"
            : "Delete rule?"
        }
        footer={
          <>
            <Button
              variant="secondary"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={async () => {
                if (!pendingDelete) return;
                setDeleting(true);
                await deleteEntity(
                  pendingDelete.kind === "constraint"
                    ? "constraint_rule"
                    : "staff_scheduling_rule",
                  pendingDelete.id
                );
                setDeleting(false);
                setPendingDelete(null);
                afterChange();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <p>
          This will permanently remove{" "}
          <span className="font-medium text-navy">{pendingDelete?.label}</span>.
          This can&rsquo;t be undone.
        </p>
      </Modal>
    </div>
  );
}

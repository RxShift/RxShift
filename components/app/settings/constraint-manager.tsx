"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { deleteEntity, updateEntity } from "@/lib/actions/settings";
import ConstraintForm from "@/components/app/constraints/constraint-form";
import {
  CONSTRAINT_RULE_LABELS,
  describeConstraint,
} from "@/lib/constraints-display";
import type { ConstraintRule, Staff } from "@/lib/types";

export default function ConstraintManager({
  rules,
  staff,
}: {
  rules: ConstraintRule[];
  staff: Staff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ConstraintRule | null>(null);
  const [busy, setBusy] = useState(false);

  const staffName = (id: string) =>
    staff.find((s) => s.id === id)?.full_name ?? id;

  async function toggleActive(rule: ConstraintRule) {
    setBusy(true);
    await updateEntity("constraint_rule", rule.id, {
      scope_type: rule.scope_type,
      scope_id: rule.scope_id,
      rule_type: rule.rule_type,
      params: rule.params,
      effective_start: rule.effective_start,
      effective_end: rule.effective_end,
      active: !rule.active,
    });
    router.refresh();
    setBusy(false);
  }

  async function remove(rule: ConstraintRule) {
    if (!confirm("Delete this rule?")) return;
    await deleteEntity("constraint_rule", rule.id);
    router.refresh();
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-brand text-base font-bold text-navy">
          Constraint rules
        </h2>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <EmptyState message="No constraint rules yet. Add hour caps (like a per-diem 960 hours/year), availability windows, or always-off days. RxShift flags conflicts at scheduling time and re-checks published schedules when rules change." />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Applies to</Th>
              <Th>Rule</Th>
              <Th>Detail</Th>
              <Th>Effective</Th>
              <Th>Status</Th>
              <Th className="w-36"> </Th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <Tr key={r.id}>
                <Td className="font-medium">
                  {r.scope_type === "staff"
                    ? staffName(r.scope_id)
                    : `All ${r.scope_id}s`}
                </Td>
                <Td>{CONSTRAINT_RULE_LABELS[r.rule_type]}</Td>
                <Td>{describeConstraint(r)}</Td>
                <Td>
                  {r.effective_start}
                  {r.effective_end ? ` → ${r.effective_end}` : " → open"}
                </Td>
                <Td>
                  <Badge tone={r.active ? "compliant" : "neutral"}>
                    {r.active ? "Active" : "Paused"}
                  </Badge>
                </Td>
                <Td>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => { setEditing(r); setOpen(true); }}
                      className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(r)}
                      disabled={busy}
                      className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      {r.active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="font-body text-xs font-medium text-deficiency underline-offset-2 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={open}
        onClose={closeForm}
        title={editing ? "Edit constraint rule" : "Add constraint rule"}
      >
        <ConstraintForm
          staff={staff}
          initial={editing}
          onSaved={() => { closeForm(); router.refresh(); }}
          onCancel={closeForm}
        />
      </Modal>
    </div>
  );
}

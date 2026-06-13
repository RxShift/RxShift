"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/form";
import { deleteWorkspace } from "@/lib/actions/danger";

export default function DangerZone({ tenantName }: { tenantName: string }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteWorkspace(confirm);
    if (result.ok) {
      // Hard navigation — the session no longer has a workspace
      window.location.assign("/app");
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 rounded-[10px] border border-deficiency/30 bg-surface p-6">
      <h2 className="font-brand text-base font-bold text-deficiency">
        Danger zone
      </h2>
      <p className="mt-1 max-w-[420px] font-body text-sm leading-relaxed text-steel">
        Deleting this workspace permanently removes every location, staff
        record, schedule, request, and compliance record in it. There is no
        undo.
      </p>
      <Button
        variant="destructive"
        onClick={() => {
          setConfirm("");
          setError(null);
          setOpen(true);
        }}
        className="mt-4"
      >
        Delete this workspace
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${tenantName}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy || confirm.trim() !== tenantName}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          </>
        }
      >
        <p>
          This deletes <strong>everything</strong> in this workspace —
          schedules, staff, compliance records, all of it. Type the workspace
          name to confirm:
        </p>
        <div className="mt-4">
          <Label htmlFor="confirm-name">{tenantName}</Label>
          <Input
            id="confirm-name"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={tenantName}
            autoFocus
          />
        </div>
        {error && <p className="mt-3 font-body text-sm text-deficiency">{error}</p>}
      </Modal>
    </div>
  );
}

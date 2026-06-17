"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Input, Label } from "@/components/ui/form";
import { deleteLead } from "@/lib/actions/crm";

// Platform-admin delete for a lead (confirm by typing the pharmacy name).
// Notes cascade; email-log audit rows are intentionally kept.
export default function DeleteLead({
  leadId,
  pharmacyName,
}: {
  leadId: string;
  pharmacyName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    const result = await deleteLead(leadId);
    if (result.ok) {
      router.push("/app/admin/leads");
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 rounded-[10px] border border-deficiency/30 bg-surface p-6">
      <h2 className="font-brand text-base font-bold text-deficiency">Danger zone</h2>
      <p className="mt-1 max-w-[460px] font-body text-sm leading-relaxed text-steel">
        Deleting this lead permanently removes it and all of its notes. Emails
        already logged to it are kept in the email log (audit trail). No undo.
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
        Delete this lead
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${pharmacyName}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={busy || confirm.trim() !== pharmacyName}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          </>
        }
      >
        <p>
          This permanently deletes the lead and its notes. Type the pharmacy name
          to confirm:
        </p>
        <div className="mt-4">
          <Label htmlFor="confirm-lead">{pharmacyName}</Label>
          <Input
            id="confirm-lead"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={pharmacyName}
            autoFocus
          />
        </div>
        {error && <p className="mt-3 font-body text-sm text-deficiency">{error}</p>}
      </Modal>
    </div>
  );
}

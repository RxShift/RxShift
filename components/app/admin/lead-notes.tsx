"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/form";
import { addLeadNote } from "@/lib/actions/crm";
import type { LeadNote } from "@/lib/types";

function fmtWhen(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

// Append-only by design: no editing or deleting past notes keeps the
// history honest between the two admins.
export default function LeadNotes({
  leadId,
  notes,
}: {
  leadId: string;
  notes: LeadNote[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    const result = await addLeadNote(leadId, draft);
    if (result.ok) {
      setDraft("");
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  return (
    <Card className="mt-6">
      <h2 className="font-brand text-base font-bold text-navy">Notes</h2>
      {notes.length === 0 ? (
        <p className="mt-2 font-body text-sm text-steel">No notes yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {notes.map((n) => (
            <div key={n.id} className="rounded-md bg-cloud p-3">
              <p className="font-body text-[11px] text-steel">
                {fmtWhen(n.created_at)} · <span className="font-medium">{n.author}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap font-body text-[13px] text-navy">
                {n.body}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 border-t border-line pt-4">
        <Textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note — calls, context, next steps…"
        />
        <div className="mt-2 flex items-center gap-3">
          <Button disabled={busy || !draft.trim()} onClick={handleAdd}>
            Add Note
          </Button>
          {error && (
            <span className="font-body text-sm text-deficiency">{error}</span>
          )}
        </div>
      </div>
    </Card>
  );
}

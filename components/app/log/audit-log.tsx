"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { Label, Textarea, HelpText } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { appendActivityNote } from "@/lib/actions/audit";

export interface AuditEntry {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  detail: Record<string, unknown> | null;
  notes: { id: string; note: string; created_at: string; author: string }[];
}

function summarize(e: AuditEntry): string {
  // A compact, human label: "approved time_off_request", "publish schedule_period"…
  return `${e.action} ${e.entity_type.replace(/_/g, " ")}`;
}

export default function AuditLog({ entries }: { entries: AuditEntry[] }) {
  const router = useRouter();
  const [noteFor, setNoteFor] = useState<AuditEntry | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveNote() {
    if (!noteFor || note.trim().length === 0) return;
    setBusy(true);
    setError(null);
    const res = await appendActivityNote({
      activity_log_id: noteFor.id,
      note: note.trim(),
    });
    if (res.ok) {
      setNoteFor(null);
      setNote("");
      router.refresh();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th className="w-44">When</Th>
            <Th className="w-36">Who</Th>
            <Th>Action</Th>
            <Th className="w-28"> </Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <Tr key={e.id}>
              <Td className="whitespace-nowrap align-top text-steel">
                {new Date(e.created_at).toLocaleString()}
              </Td>
              <Td className="align-top font-medium">{e.actor}</Td>
              <Td className="align-top">
                <span className="font-body text-navy">{summarize(e)}</span>
                {e.reason && (
                  <span className="mt-0.5 block font-body text-[12px] text-deficiency">
                    Override reason: {e.reason}
                  </span>
                )}
                {e.notes.length > 0 && (
                  <ul className="mt-1.5 space-y-1 border-l-2 border-amber/40 pl-3">
                    {e.notes.map((n) => (
                      <li key={n.id} className="font-body text-[12px] text-steel">
                        <span className="font-semibold text-navy">Note</span> ·{" "}
                        {n.author} · {new Date(n.created_at).toLocaleDateString()}
                        : {n.note}
                      </li>
                    ))}
                  </ul>
                )}
              </Td>
              <Td className="align-top">
                <button
                  onClick={() => {
                    setNoteFor(e);
                    setNote("");
                    setError(null);
                  }}
                  className="rounded border border-line px-2.5 py-1 font-brand text-[11px] font-semibold text-navy hover:border-amber"
                >
                  + Note
                </button>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal
        open={noteFor !== null}
        onClose={() => {
          setNoteFor(null);
          setNote("");
        }}
        title="Add a note to this entry"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setNoteFor(null);
                setNote("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveNote} disabled={busy || note.trim().length === 0}>
              {busy ? "Saving…" : "Add note"}
            </Button>
          </>
        }
      >
        {noteFor && (
          <div className="space-y-3">
            <p className="font-body text-sm text-steel">
              {new Date(noteFor.created_at).toLocaleString()} ·{" "}
              <span className="text-navy">{summarize(noteFor)}</span> by{" "}
              {noteFor.actor}
            </p>
            <div>
              <Label htmlFor="audit-note">Note</Label>
              <Textarea
                id="audit-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. RPh forgot to clock back from lunch; corrected on the floor at 1:10pm."
              />
              <HelpText>
                The original entry is never changed — your note is appended and
                attributed to you.
              </HelpText>
            </div>
            {error && (
              <p className="font-body text-sm text-deficiency">{error}</p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

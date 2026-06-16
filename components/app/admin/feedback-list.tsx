"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFeedbackStatus, setFeedbackNote } from "@/lib/actions/feedback";
import type { Feedback, FeedbackStatus } from "@/lib/types";

const STATUSES: FeedbackStatus[] = [
  "new",
  "triaged",
  "in_progress",
  "done",
  "wont_do",
];

export default function FeedbackList({
  items,
  screenshotUrls,
}: {
  items: Feedback[];
  screenshotUrls: Record<string, string>;
}) {
  if (items.length === 0)
    return (
      <p className="font-body text-sm text-steel">No feedback matches.</p>
    );
  return (
    <div className="space-y-3">
      {items.map((f) => (
        <FeedbackCard key={f.id} f={f} shot={screenshotUrls[f.id]} />
      ))}
    </div>
  );
}

function FeedbackCard({ f, shot }: { f: Feedback; shot?: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<FeedbackStatus>(f.status);
  const [note, setNote] = useState(f.internal_note ?? "");
  const [busy, setBusy] = useState(false);
  const [savedNote, setSavedNote] = useState(false);

  async function changeStatus(next: FeedbackStatus) {
    setStatus(next);
    setBusy(true);
    await updateFeedbackStatus(f.id, next);
    setBusy(false);
    router.refresh();
  }

  async function saveNote() {
    setBusy(true);
    const result = await setFeedbackNote(f.id, note);
    setBusy(false);
    if (result.ok) setSavedNote(true);
  }

  const kindTone =
    f.kind === "bug"
      ? "bg-deficiency-bg text-deficiency"
      : f.kind === "feature"
        ? "bg-alert-bg text-alert"
        : "bg-cloud text-steel";

  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 font-brand text-[11px] font-bold ${kindTone}`}
        >
          {f.kind}
        </span>
        {f.source === "system" && (
          <span className="rounded bg-navy px-2 py-0.5 font-brand text-[11px] font-bold text-white">
            system
          </span>
        )}
        <span className="font-brand text-sm font-bold text-navy">
          {f.subject}
        </span>
        <span className="ml-auto font-body text-xs text-steel">
          {f.created_at.slice(0, 10)}
        </span>
      </div>

      {f.body && (
        <p className="mt-2 whitespace-pre-wrap font-body text-sm text-steel">
          {f.body}
        </p>
      )}
      {f.page_url && (
        <p className="mt-1 font-body text-xs text-steel">Page: {f.page_url}</p>
      )}

      {shot && (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={shot} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img
            src={shot}
            alt="screenshot"
            className="max-h-40 rounded border border-line"
          />
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="font-body text-xs text-steel">
          Status
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value as FeedbackStatus)}
            disabled={busy}
            className="ml-2 rounded border border-line bg-surface px-2 py-1 text-sm text-navy"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSavedNote(false);
          }}
          placeholder="Internal note"
          className="flex-1 rounded border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy"
        />
        <button
          onClick={saveNote}
          disabled={busy}
          className="rounded-md border border-line px-3 py-1.5 font-brand text-xs font-medium text-navy"
        >
          {savedNote ? "Saved" : "Save note"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedback } from "@/lib/actions/feedback";
import type { FeedbackKind } from "@/lib/types";

const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "feedback", label: "Feedback" },
];

/**
 * Always-present feedback trigger (sidebar footer). Opens a modal to file a
 * bug / feature request / general feedback, with an optional screenshot. Posts
 * through the submitFeedback server action → the platform Feedback inbox.
 */
export default function FeedbackButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setKind("bug");
    setSubject("");
    setBody("");
    setFile(null);
    setError(null);
    setDone(false);
  }

  async function submit() {
    if (!subject.trim()) {
      setError("Add a short subject.");
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError("That image is over 5 MB — please attach a smaller screenshot.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("subject", subject);
      fd.append("body", body);
      fd.append("page_url", pathname);
      if (file) fd.append("screenshot", file, file.name);
      const result = await submitFeedback(fd);
      if (result.ok) setDone(true);
      else setError(result.error);
    } catch {
      // A rejected server action (e.g. body too large, dropped connection)
      // must never leave the button stuck on "Sending…".
      setError(
        "Couldn't send — the screenshot may be too large or the connection dropped. Try again, or remove the image."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="mt-2 block font-body text-[11px] text-white/40 hover:text-white/70"
      >
        Feedback / report a bug
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {done ? (
              <div className="text-center">
                <h2 className="font-brand text-base font-bold text-navy">
                  Thanks!
                </h2>
                <p className="mt-2 font-body text-sm text-steel">
                  Your {kind} was sent to the RxShift team.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 rounded-md bg-amber px-4 py-2 font-brand text-sm font-bold text-white"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <h2 className="mb-1 font-brand text-base font-bold text-navy">
                  Send feedback
                </h2>
                <p className="mb-4 font-body text-xs text-steel">
                  Found a bug, want a feature, or have a thought? Tell us — it
                  goes straight to the RxShift team.
                </p>

                <div className="mb-3 flex gap-2">
                  {KINDS.map((k) => (
                    <button
                      key={k.value}
                      type="button"
                      onClick={() => setKind(k.value)}
                      className={`rounded-md border px-3 py-1.5 font-brand text-xs font-bold ${
                        kind === k.value
                          ? "border-amber bg-amber/10 text-amber"
                          : "border-line text-steel hover:border-steel/40"
                      }`}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>

                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Short subject"
                  maxLength={200}
                  className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2 font-body text-sm text-navy"
                />
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="What happened, or what would you like?"
                  rows={4}
                  maxLength={5000}
                  className="mb-3 w-full rounded-md border border-line bg-surface px-3 py-2 font-body text-sm text-navy"
                />

                <label className="mb-3 block cursor-pointer font-body text-xs text-steel">
                  <span className="underline underline-offset-2">
                    Attach a screenshot (optional)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && <span className="ml-2 text-navy">{file.name}</span>}
                </label>

                {error && (
                  <p className="mb-3 font-body text-sm text-deficiency">{error}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-line px-4 py-2 font-brand text-sm font-medium text-steel"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submit}
                    disabled={busy}
                    className="rounded-md bg-amber px-4 py-2 font-brand text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

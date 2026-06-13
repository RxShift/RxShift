"use client";

// Natural-language schedule assistant: AI proposes, the deterministic
// engine's validation is shown, the manager confirms before anything
// commits.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/button";
import {
  aiScheduleCommand,
  applyAiOperations,
  type AiCommandResult,
} from "@/lib/actions/ai";

export default function AiCommandBar({ periodId }: { periodId: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AiCommandResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await aiScheduleCommand(periodId, input.trim());
    if (res.ok && res.data) setResult(res.data);
    else if (!res.ok) setError(res.error);
    setBusy(false);
  }

  async function handleApply() {
    if (!result?.operations) return;
    setBusy(true);
    const res = await applyAiOperations(periodId, result.operations);
    if (res.ok) {
      setResult(null);
      setInput("");
      router.refresh();
    } else {
      setError(res.error);
    }
    setBusy(false);
  }

  return (
    <div className="rounded-[10px] border border-line bg-surface p-4 shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='Ask or edit in plain English — "who is short Thursday?", "give Maria Fridays off this month"'
          className="flex-1 rounded-md border-[1.5px] border-line bg-surface px-3 py-2.5 font-body text-sm text-navy placeholder:text-steel-light focus:border-navy focus:outline-none focus:ring-[3px] focus:ring-navy/10"
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {error && <p className="mt-3 font-body text-sm text-deficiency">{error}</p>}

      {result?.mode === "answer" && (
        <div className="mt-3 rounded-lg bg-cloud/60 p-4 font-body text-sm leading-relaxed text-navy">
          {result.answer}
        </div>
      )}

      {result?.mode === "proposal" && (
        <div className="mt-3 rounded-lg border-l-[3px] border-l-amber bg-alert-bg p-4">
          <p className="font-brand text-sm font-bold text-navy">
            Proposed change ({result.operations?.length} operation
            {result.operations?.length === 1 ? "" : "s"})
          </p>
          <p className="mt-1 font-body text-sm leading-relaxed text-navy">
            {result.description}
          </p>
          <p className="mt-2 font-body text-[13px] font-medium text-steel">
            Engine check: {result.validation}
          </p>
          <div className="mt-3 flex gap-2">
            <Button onClick={handleApply} disabled={busy}>
              {busy ? "Applying…" : "Confirm & apply"}
            </Button>
            <Button variant="secondary" onClick={() => setResult(null)}>
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

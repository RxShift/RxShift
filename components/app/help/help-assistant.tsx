"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { askHelpAssistant } from "@/lib/actions/ai";

export default function HelpAssistant() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError(null);
    setAnswer(null);
    const result = await askHelpAssistant(question.trim());
    if (result.ok && result.data) setAnswer(result.data.answer);
    else if (!result.ok) setError(result.error);
    setBusy(false);
  }

  return (
    <div className="rounded-[10px] border border-line bg-white p-5 shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
      <p className="mb-3 font-brand text-sm font-bold text-navy">
        Ask the help assistant
      </p>
      <form onSubmit={handleAsk} className="flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder='e.g. "How do I split a tech&apos;s shift between counting and inventory?"'
          className="flex-1 rounded-md border-[1.5px] border-line bg-white px-3 py-2.5 font-body text-sm text-navy placeholder:text-[#9BAABB] focus:border-navy focus:outline-none focus:ring-[3px] focus:ring-navy/10"
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </form>
      {answer && (
        <div className="mt-4 whitespace-pre-wrap rounded-lg bg-cloud/60 p-4 font-body text-sm leading-relaxed text-navy">
          {answer}
        </div>
      )}
      {error && <p className="mt-3 font-body text-sm text-[#C0392B]">{error}</p>}
      <p className="mt-3 font-body text-[11px] text-steel">
        Answers come from the help articles below. For state-rule questions,
        verify with your board of pharmacy — the assistant doesn&rsquo;t give
        regulatory advice.
      </p>
    </div>
  );
}

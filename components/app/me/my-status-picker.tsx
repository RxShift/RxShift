"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { setLiveStatus } from "@/lib/actions/live";

export default function MyStatusPicker({
  current,
  options,
  ratioImpact,
}: {
  current: string;
  options: { value: string; label: string; counts: boolean }[];
  /** Set for an on-shift pharmacist: whether stepping away keeps the location
   *  compliant. Undefined for techs / non-counting (their status can't break ratio). */
  ratioImpact?: { locationName: string; safeToLeave: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(status: string) {
    const currentCounts =
      options.find((o) => o.value === current)?.counts ?? true;
    const targetCounts = options.find((o) => o.value === status)?.counts ?? true;
    // Warn — never block — a counting pharmacist about to break ratio by stepping
    // away. (RxShift never blocks; the call is always the pharmacy's.)
    if (
      currentCounts &&
      !targetCounts &&
      ratioImpact &&
      !ratioImpact.safeToLeave &&
      !window.confirm(
        `Heads up: switching to a non-counting status will put ${ratioImpact.locationName} out of ratio right now. Continue?`
      )
    ) {
      return;
    }
    setBusy(true);
    const result = await setLiveStatus(null, status);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  const counting = options.filter((o) => o.counts).map((o) => o.label);

  return (
    <Card>
      <h2 className="mb-3 font-brand text-base font-bold text-navy">
        My status now
      </h2>

      {ratioImpact && (
        <p
          className={`mb-3 rounded-md px-3 py-2 font-body text-[13px] font-medium ${
            ratioImpact.safeToLeave
              ? "bg-compliant-bg text-compliant"
              : "bg-alert-bg text-alert"
          }`}
        >
          {ratioImpact.safeToLeave
            ? `✓ You can step away right now — ${ratioImpact.locationName} stays in ratio.`
            : `⚠ ${ratioImpact.locationName} is at the ratio limit — if you step away now, it goes out of compliance.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            disabled={busy}
            onClick={() => pick(o.value)}
            className={`min-h-[44px] rounded-md px-4 py-2 font-brand text-sm font-bold transition-colors ${
              current === o.value
                ? "bg-amber text-white"
                : "border-[1.5px] border-line bg-surface text-navy hover:border-steel/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="mt-3 font-body text-xs text-steel">
        One tap updates the live ratio board instantly.{" "}
        {counting.length > 0
          ? `${counting.join(", ")} count toward ratio; the rest don't.`
          : "None of these count toward ratio."}
      </p>
    </Card>
  );
}

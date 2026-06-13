"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { setLiveStatus } from "@/lib/actions/live";

export default function MyStatusPicker({
  current,
  options,
}: {
  current: string;
  options: { value: string; label: string; counts: boolean }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(status: string) {
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

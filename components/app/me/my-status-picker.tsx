"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { setLiveStatus } from "@/lib/actions/live";

const OPTIONS = [
  { value: "present_counting", label: "Working" },
  { value: "on_lunch", label: "Lunch" },
  { value: "in_meeting", label: "Meeting" },
  { value: "off_floor", label: "Off floor" },
  { value: "non_tech_function", label: "Non-tech" },
];

export default function MyStatusPicker({ current }: { current: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function pick(status: string) {
    setBusy(true);
    const result = await setLiveStatus(null, status);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  return (
    <Card>
      <h2 className="mb-3 font-brand text-base font-bold text-navy">
        My status now
      </h2>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((o) => (
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
        One tap updates the live ratio board instantly. &ldquo;Working&rdquo;
        counts toward ratio; everything else doesn&rsquo;t.
      </p>
    </Card>
  );
}

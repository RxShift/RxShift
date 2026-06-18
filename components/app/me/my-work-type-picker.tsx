"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { setMyWorkType } from "@/lib/actions/me";

export default function MyWorkTypePicker({
  shiftId,
  currentWorkTypeId,
  workTypes,
}: {
  shiftId: string;
  currentWorkTypeId: string | null;
  workTypes: {
    id: string;
    name: string;
    counting_default: boolean;
    color: string | null;
  }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(currentWorkTypeId ?? "");

  async function change(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    const res = await setMyWorkType({
      shift_id: shiftId,
      work_type_id: next || null,
    });
    if (res.ok) {
      router.refresh();
    } else {
      setValue(prev);
      setError(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  const selected = workTypes.find((w) => w.id === value);

  return (
    <Card>
      <h2 className="mb-1 font-brand text-base font-bold text-navy">
        What I&rsquo;m doing now
      </h2>
      <p className="mb-3 font-body text-sm text-steel">
        Switch your current work type and the live ratio updates from this moment
        on. Tap the active one again to clear it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {workTypes.map((w) => {
          const active = w.id === value;
          return (
            <button
              key={w.id}
              disabled={busy}
              onClick={() => change(active ? "" : w.id)}
              className={`flex items-center gap-2 rounded-full border px-3.5 py-2 font-brand text-[13px] font-semibold transition-colors disabled:opacity-60 ${
                active
                  ? "border-navy bg-navy text-white"
                  : "border-line bg-surface text-steel hover:text-navy"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: w.color ?? "#9BAABB" }}
              />
              {w.name}
              {!w.counting_default && (
                <span
                  className={`text-[10px] ${active ? "text-white/70" : "text-steel"}`}
                >
                  · doesn&rsquo;t count
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && !selected.counting_default && (
        <p className="mt-2 font-body text-[12px] text-alert">
          {selected.name} doesn&rsquo;t count toward the ratio — the live board
          reflects that now.
        </p>
      )}
      {error && <p className="mt-2 font-body text-sm text-deficiency">{error}</p>}
    </Card>
  );
}

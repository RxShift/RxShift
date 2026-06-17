"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/page-header";
import { setLiveStatus } from "@/lib/actions/live";

interface BoardPerson {
  name: string;
  staffId: string;
  live: string;
  color: string | null;
  workType: string | null;
}

interface LocationCard {
  locationId: string;
  locationName: string;
  pharmacistsCounting: BoardPerson[];
  pharmacistsNotCounting: (BoardPerson & { reason: string })[];
  techsCounting: BoardPerson[];
  techsNotCounting: (BoardPerson & { reason: string })[];
  othersOnNow: BoardPerson[];
  status: "compliant" | "deficient";
  reason: string | null;
  techLimit: number;
  limitLabel: string;
}

function GroupHead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 font-brand text-[9px] font-bold uppercase tracking-[1px] text-steel first:mt-0">
      {children}
    </p>
  );
}

// A small work-type color dot before a person's name on the board.
function Dot({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <span
      className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
      style={{ backgroundColor: color }}
    />
  );
}

export default function LiveBoard({
  locations,
  staff,
  isManager,
  statusOptions,
  labels,
}: {
  locations: LocationCard[];
  staff: { id: string; name: string; live: string; offShift: boolean }[];
  isManager: boolean;
  statusOptions: { value: string; label: string }[];
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Refresh the board every 60 seconds so the ratio stays current
  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 60_000);
    return () => clearInterval(interval);
  }, [router]);

  async function changeStatus(staffId: string, status: string) {
    setBusy(true);
    const result = await setLiveStatus(staffId, status);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  if (locations.length === 0) {
    return (
      <EmptyState message="No shifts scheduled for today. The live board reads from today's published schedule." />
    );
  }

  return (
    <div className="max-w-[1040px] space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {locations.map((loc) => (
          <Card
            key={loc.locationId}
            className={
              loc.status === "deficient" ? "border-l-4 border-l-deficiency" : ""
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-brand text-base font-bold text-navy">
                {loc.locationName}
              </h2>
              <Badge tone={loc.status === "deficient" ? "deficiency" : "compliant"}>
                {loc.status === "deficient" ? "Deficient now" : "Compliant now"}
              </Badge>
            </div>

            <div className="mb-4 flex items-end gap-6">
              <div>
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
                  Pharmacists counting
                </p>
                <p className="font-brand text-[32px] font-bold text-navy">
                  {loc.pharmacistsCounting.length}
                </p>
              </div>
              <div>
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
                  Techs counting
                </p>
                <p
                  className={`font-brand text-[32px] font-bold ${loc.status === "deficient" ? "text-deficiency" : "text-navy"}`}
                >
                  {loc.techsCounting.length}
                </p>
              </div>
              <p className="mb-2 font-body text-xs text-steel">
                limit {loc.techLimit} ({loc.limitLabel})
              </p>
            </div>

            {loc.reason && (
              <p className="mb-3 rounded bg-deficiency-bg p-2.5 font-body text-[13px] text-deficiency">
                {loc.reason}
              </p>
            )}

            <div className="space-y-1 font-body text-[13px] text-navy">
              <GroupHead>Pharmacists</GroupHead>
              {loc.pharmacistsCounting.map((p) => (
                <p key={p.staffId}>
                  <Dot color={p.color} />
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-steel">
                    RPh{p.workType ? ` · ${p.workType}` : " · counting"}
                  </span>
                </p>
              ))}
              <GroupHead>Techs — counting</GroupHead>
              {loc.techsCounting.map((t) => (
                <p key={t.staffId}>
                  <Dot color={t.color} />
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-steel">
                    Tech{t.workType ? ` · ${t.workType}` : " · counting"}
                  </span>
                </p>
              ))}
              {loc.othersOnNow.length > 0 && (
                <>
                  <GroupHead>Other staff</GroupHead>
                  {loc.othersOnNow.map((o) => (
                    <p key={o.staffId}>
                      <Dot color={o.color} />
                      <span className="font-medium">{o.name}</span>{" "}
                      <span className="text-steel">
                        {o.workType ?? "non-counting"}
                      </span>
                    </p>
                  ))}
                </>
              )}
              {(loc.pharmacistsNotCounting.length > 0 ||
                loc.techsNotCounting.length > 0) && (
                <>
                  <GroupHead>Not counting right now</GroupHead>
                  {loc.pharmacistsNotCounting.map((p) => (
                    <p key={p.staffId} className="text-steel">
                      <Dot color={p.color} />
                      {p.name} · RPh · {p.reason}
                    </p>
                  ))}
                  {loc.techsNotCounting.map((t) => (
                    <p key={t.staffId} className="text-steel">
                      <Dot color={t.color} />
                      {t.name} · {t.reason}
                    </p>
                  ))}
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="mb-1 font-brand text-base font-bold text-navy">
          Status board
        </h2>
        <p className="mb-4 font-body text-xs text-steel">
          Changing a status recalculates the ratio instantly.{" "}
          {isManager ? "Managers can set anyone's status." : "You can set your own status."}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between gap-2 rounded-lg border border-line p-2.5 ${
                s.offShift ? "opacity-60" : ""
              }`}
            >
              <span className="truncate font-body text-[13px] font-medium text-navy">
                {s.name}
              </span>
              {s.offShift ? (
                <span className="shrink-0 font-brand text-xs font-bold text-steel/70">
                  Off shift
                </span>
              ) : (
                <Select
                  value={s.live}
                  disabled={busy || !isManager}
                  onChange={(e) => changeStatus(s.id, e.target.value)}
                  className="!w-40 !py-1.5 text-xs"
                >
                  {(statusOptions.some((o) => o.value === s.live)
                    ? statusOptions
                    : [
                        { value: s.live, label: labels[s.live] ?? s.live },
                        ...statusOptions,
                      ]
                  ).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

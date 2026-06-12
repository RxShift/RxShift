"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/page-header";
import { setLiveStatus } from "@/lib/actions/live";

const STATUS_LABELS: Record<string, string> = {
  present_counting: "Working (counts)",
  on_lunch: "Lunch",
  off_floor: "Off floor",
  in_meeting: "Meeting",
  non_tech_function: "Non-tech work",
};

interface ZoneCard {
  zoneId: string;
  zoneName: string;
  pharmacists: { name: string; staffId: string; live: string }[];
  techsCounting: { name: string; staffId: string; live: string }[];
  techsNotCounting: { name: string; staffId: string; live: string; reason: string }[];
  status: "compliant" | "deficient";
  reason: string | null;
  maxTechs: number;
}

export default function LiveBoard({
  zones,
  staff,
  isManager,
}: {
  zones: ZoneCard[];
  staff: { id: string; name: string; live: string }[];
  isManager: boolean;
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

  if (zones.length === 0) {
    return (
      <EmptyState message="No zone-assigned shifts scheduled for today. The live board reads from today's published schedule." />
    );
  }

  return (
    <div className="max-w-[1040px] space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {zones.map((zone) => (
          <Card
            key={zone.zoneId}
            className={
              zone.status === "deficient" ? "border-l-4 border-l-[#C0392B]" : ""
            }
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-brand text-base font-bold text-navy">
                {zone.zoneName}
              </h2>
              <Badge tone={zone.status === "deficient" ? "deficiency" : "compliant"}>
                {zone.status === "deficient" ? "Deficient now" : "Compliant now"}
              </Badge>
            </div>

            <div className="mb-4 flex items-end gap-6">
              <div>
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
                  Pharmacists
                </p>
                <p className="font-brand text-[32px] font-bold text-navy">
                  {zone.pharmacists.length}
                </p>
              </div>
              <div>
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
                  Techs counting
                </p>
                <p
                  className={`font-brand text-[32px] font-bold ${zone.status === "deficient" ? "text-[#C0392B]" : "text-navy"}`}
                >
                  {zone.techsCounting.length}
                </p>
              </div>
              <p className="mb-2 font-body text-xs text-steel">
                limit {zone.pharmacists.length * zone.maxTechs} (
                {zone.maxTechs}/pharmacist)
              </p>
            </div>

            {zone.reason && (
              <p className="mb-3 rounded bg-[#FEF0EF] p-2.5 font-body text-[13px] text-[#C0392B]">
                {zone.reason}
              </p>
            )}

            <div className="space-y-1 font-body text-[13px] text-navy">
              {zone.pharmacists.map((p) => (
                <p key={p.staffId}>
                  <span className="font-medium">{p.name}</span>{" "}
                  <span className="text-steel">RPh · {STATUS_LABELS[p.live]}</span>
                </p>
              ))}
              {zone.techsCounting.map((t) => (
                <p key={t.staffId}>
                  <span className="font-medium">{t.name}</span>{" "}
                  <span className="text-steel">Tech · counting</span>
                </p>
              ))}
              {zone.techsNotCounting.map((t) => (
                <p key={t.staffId} className="text-steel">
                  {t.name} · {t.reason} (not counting)
                </p>
              ))}
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
              className="flex items-center justify-between gap-2 rounded-lg border border-line p-2.5"
            >
              <span className="truncate font-body text-[13px] font-medium text-navy">
                {s.name}
              </span>
              <Select
                value={s.live}
                disabled={busy || !isManager}
                onChange={(e) => changeStatus(s.id, e.target.value)}
                className="!w-40 !py-1.5 text-xs"
              >
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

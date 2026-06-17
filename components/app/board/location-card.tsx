import Badge from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { LocationCard as LocationCardData } from "@/lib/board-data";

function GroupHead({
  children,
  big,
  span,
}: {
  children: React.ReactNode;
  big?: boolean;
  span?: boolean;
}) {
  return (
    <p
      className={`mt-2 font-brand font-bold uppercase tracking-[1px] text-steel first:mt-0 ${
        big ? "text-[11px]" : "text-[9px]"
      } ${span ? "col-span-full" : ""}`}
    >
      {children}
    </p>
  );
}

// A small work-type color dot before a person's name on the board.
function Dot({ color, big }: { color: string | null; big?: boolean }) {
  if (!color) return null;
  return (
    <span
      className={`mr-1.5 inline-block rounded-full align-middle ${
        big ? "h-3 w-3" : "h-2.5 w-2.5"
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

// One per-location summary card: headline pharmacist/tech counts + compliance
// badge + the grouped roster of who's on now. Shared by the in-shell Live Board
// and the chrome-free wall display (size="large" scales the type for a monitor).
export default function LocationCard({
  loc,
  size = "default",
}: {
  loc: LocationCardData;
  size?: "default" | "large";
}) {
  const big = size === "large";
  // On the wall display (large), let the roster flow into as many columns as the
  // width allows so a dense location fills the screen instead of one tall column
  // that would need scrolling. Each row truncates to keep the columns clean.
  const rosterClass = big
    ? "grid items-start gap-x-8 gap-y-1 font-body text-[15px] text-navy [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]"
    : "space-y-1 font-body text-[13px] text-navy";
  const rowClass = big ? "truncate" : "";
  return (
    <Card
      className={loc.status === "deficient" ? "border-l-4 border-l-deficiency" : ""}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2
          className={`min-w-0 font-brand font-bold text-navy ${big ? "text-2xl" : "text-base"}`}
        >
          {loc.locationName}
        </h2>
        <span className="shrink-0 whitespace-nowrap">
          <Badge tone={loc.status === "deficient" ? "deficiency" : "compliant"}>
            {loc.status === "deficient" ? "Deficient now" : "Compliant now"}
          </Badge>
        </span>
      </div>

      <div className="mb-4 flex items-end gap-6">
        <div>
          <p
            className={`font-brand font-bold uppercase tracking-[1px] text-steel ${big ? "text-xs" : "text-[10px]"}`}
          >
            Pharmacists counting
          </p>
          <p
            className={`font-brand font-bold text-navy ${big ? "text-[56px] leading-none" : "text-[32px]"}`}
          >
            {loc.pharmacistsCounting.length}
          </p>
        </div>
        <div>
          <p
            className={`font-brand font-bold uppercase tracking-[1px] text-steel ${big ? "text-xs" : "text-[10px]"}`}
          >
            Techs counting
          </p>
          <p
            className={`font-brand font-bold ${big ? "text-[56px] leading-none" : "text-[32px]"} ${loc.status === "deficient" ? "text-deficiency" : "text-navy"}`}
          >
            {loc.techsCounting.length}
          </p>
        </div>
        <p className={`mb-2 font-body text-steel ${big ? "text-sm" : "text-xs"}`}>
          limit {loc.techLimit} ({loc.limitLabel})
        </p>
      </div>

      {loc.reason && (
        <p
          className={`mb-3 rounded bg-deficiency-bg p-2.5 font-body text-deficiency ${big ? "text-sm" : "text-[13px]"}`}
        >
          {loc.reason}
        </p>
      )}

      <div className={rosterClass}>
        <GroupHead big={big} span={big}>
          Pharmacists
        </GroupHead>
        {loc.pharmacistsCounting.map((p) => (
          <p key={p.staffId} className={rowClass}>
            <Dot color={p.color} big={big} />
            <span className="font-medium">{p.name}</span>{" "}
            <span className="text-steel">
              RPh{p.workType ? ` · ${p.workType}` : " · counting"}
            </span>
          </p>
        ))}
        <GroupHead big={big} span={big}>
          Techs — counting
        </GroupHead>
        {loc.techsCounting.map((t) => (
          <p key={t.staffId} className={rowClass}>
            <Dot color={t.color} big={big} />
            <span className="font-medium">{t.name}</span>{" "}
            <span className="text-steel">
              Tech{t.workType ? ` · ${t.workType}` : " · counting"}
            </span>
          </p>
        ))}
        {loc.othersOnNow.length > 0 && (
          <>
            <GroupHead big={big} span={big}>
              Other staff
            </GroupHead>
            {loc.othersOnNow.map((o) => (
              <p key={o.staffId} className={rowClass}>
                <Dot color={o.color} big={big} />
                <span className="font-medium">{o.name}</span>{" "}
                <span className="text-steel">{o.workType ?? "non-counting"}</span>
              </p>
            ))}
          </>
        )}
        {(loc.pharmacistsNotCounting.length > 0 ||
          loc.techsNotCounting.length > 0) && (
          <>
            <GroupHead big={big} span={big}>
              Not counting right now
            </GroupHead>
            {loc.pharmacistsNotCounting.map((p) => (
              <p key={p.staffId} className={`text-steel ${rowClass}`}>
                <Dot color={p.color} big={big} />
                {p.name} · RPh · {p.reason}
              </p>
            ))}
            {loc.techsNotCounting.map((t) => (
              <p key={t.staffId} className={`text-steel ${rowClass}`}>
                <Dot color={t.color} big={big} />
                {t.name} · {t.reason}
              </p>
            ))}
          </>
        )}
      </div>
    </Card>
  );
}

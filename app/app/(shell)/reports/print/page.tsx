import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/app/reports/print-button";
import { loadAllLocationsBundle } from "@/lib/schedule-data";
import { eachDate, fmtDay, fmtRange } from "@/lib/dates";
import { fmtTime } from "@/lib/scheduling-rules-display";
import type { Location, RatioType, Shift, ShiftSegment, Staff } from "@/lib/types";

// Print-optimized schedule: a clean weekly grid, ONE location per page, staff
// grouped by role, work type as a short label. Reuses the global @media print
// rules (chrome hidden) + Tailwind print: utilities. Optum prints their schedules.

interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

const BANDS: { label: string; type: RatioType }[] = [
  { label: "Pharmacists", type: "pharmacist" },
  { label: "Technicians", type: "technician" },
  { label: "Other staff", type: "non_counting" },
];

function chunkWeeks(dates: string[]): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < dates.length; i += 7) out.push(dates.slice(i, i + 7));
  return out;
}

export default async function SchedulePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; locations?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const role = session?.appUser?.role ?? null;
  if (!role || !["owner_admin", "scheduler", "supervisor", "read_only"].includes(role)) {
    redirect("/app/me");
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const from = params.from && dateRe.test(params.from) ? params.from : "";
  const to = params.to && dateRe.test(params.to) ? params.to : "";
  if (!from || !to || from > to) {
    return (
      <div className="flex-1 p-8 font-body text-sm text-deficiency">
        Invalid date range. <Link href="/app/reports" className="underline">Back to Reports</Link>
      </div>
    );
  }

  const bundle = await loadAllLocationsBundle(from, to);
  const locParam = params.locations ?? "all";
  const selectedIds =
    locParam === "all" || !locParam
      ? bundle.locations.map((l) => l.id)
      : locParam.split(",").filter(Boolean);
  const selectedLocs = (bundle.locations as Location[]).filter((l) =>
    selectedIds.includes(l.id)
  );
  const weeks = chunkWeeks(eachDate(from, to));
  const wtById = new Map(bundle.workTypes.map((w) => [w.id, w]));

  // shifts indexed by location → `${staff}|${date}`
  const byLocCell = new Map<string, Map<string, ShiftWithSegments[]>>();
  for (const s of bundle.shifts as ShiftWithSegments[]) {
    if (s.segments.length === 0) continue;
    const cellMap = byLocCell.get(s.location_id) ?? new Map();
    const key = `${s.staff_id}|${s.date}`;
    const list = cellMap.get(key) ?? [];
    list.push(s);
    cellMap.set(key, list);
    byLocCell.set(s.location_id, cellMap);
  }

  function cellText(shifts: ShiftWithSegments[]): React.ReactNode {
    return shifts.map((sh) => {
      const starts = sh.segments.map((g) => String(g.start_time).slice(0, 5));
      const ends = sh.segments.map((g) => String(g.end_time).slice(0, 5));
      const earliest = starts.reduce((a, b) => (b < a ? b : a));
      const latest = ends.reduce((a, b) => (b > a ? b : a));
      const wts = [
        ...new Set(
          sh.segments
            .map((g) => (g.work_type_id ? wtById.get(g.work_type_id)?.name : null))
            .filter((x): x is string => !!x)
        ),
      ].join(", ");
      return (
        <div key={sh.id} className="leading-tight">
          {fmtTime(earliest)}–{fmtTime(latest)}
          {wts ? <span className="block text-[9px] text-steel">{wts}</span> : null}
        </div>
      );
    });
  }

  return (
    <div className="flex-1 p-8 print:p-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="font-brand text-lg font-bold text-navy">
            Schedule — print view
          </h1>
          <p className="font-body text-sm text-steel">{fmtRange(from, to)}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/app/reports"
            className="rounded-md border border-line bg-surface px-4 py-2 font-body text-sm text-navy hover:border-steel/40"
          >
            Back
          </Link>
          <PrintButton />
        </div>
      </div>

      {selectedLocs.length === 0 && (
        <p className="font-body text-sm text-steel">No locations selected.</p>
      )}

      {selectedLocs.map((loc, li) => {
        const cellMap = byLocCell.get(loc.id) ?? new Map();
        const scheduledStaffIds = new Set(
          [...cellMap.keys()].map((k) => k.split("|")[0])
        );
        const staffHere = (bundle.staff as Staff[]).filter((s) =>
          scheduledStaffIds.has(s.id)
        );
        return (
          <section
            key={loc.id}
            className={li < selectedLocs.length - 1 ? "print:break-after-page" : ""}
          >
            <h2 className="mb-2 mt-6 font-brand text-base font-bold text-navy print:mt-0">
              {loc.name}
            </h2>
            {staffHere.length === 0 ? (
              <p className="font-body text-sm text-steel">
                No shifts scheduled here in this range.
              </p>
            ) : (
              weeks.map((week, wi) => (
                <table
                  key={wi}
                  className="mb-4 w-full border-collapse text-left"
                >
                  <thead>
                    <tr>
                      <th className="border border-line bg-cloud px-2 py-1 font-brand text-[10px] font-bold uppercase tracking-[0.5px] text-steel">
                        Staff
                      </th>
                      {week.map((d) => {
                        const day = fmtDay(d);
                        return (
                          <th
                            key={d}
                            className="border border-line bg-cloud px-2 py-1 text-center font-brand text-[10px] font-bold uppercase tracking-[0.5px] text-steel"
                          >
                            {day.dow}
                            <br />
                            <span className="font-body text-[9px] normal-case">
                              {day.label}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {BANDS.flatMap((band) => {
                      const people = staffHere.filter(
                        (s) => s.ratio_type === band.type
                      );
                      if (people.length === 0) return [];
                      return [
                        <tr key={`${band.label}-${wi}`}>
                          <td
                            colSpan={week.length + 1}
                            className="border border-line bg-cloud/60 px-2 py-0.5 font-brand text-[9px] font-bold uppercase tracking-[1px] text-steel"
                          >
                            {band.label}
                          </td>
                        </tr>,
                        ...people.map((p) => (
                          <tr key={`${p.id}-${wi}`}>
                            <td className="border border-line px-2 py-1 font-body text-[11px] font-medium text-navy">
                              {p.full_name}
                              {p.certified ? (
                                <span className="ml-1 text-[9px] text-steel">
                                  CPhT
                                </span>
                              ) : null}
                            </td>
                            {week.map((d) => {
                              const shifts = cellMap.get(`${p.id}|${d}`) ?? [];
                              return (
                                <td
                                  key={d}
                                  className="border border-line px-1.5 py-1 text-center align-top font-body text-[10px] text-navy"
                                >
                                  {shifts.length > 0 ? cellText(shifts) : ""}
                                </td>
                              );
                            })}
                          </tr>
                        )),
                      ];
                    })}
                  </tbody>
                </table>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}

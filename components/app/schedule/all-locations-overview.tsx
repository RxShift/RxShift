// Read-only weekly overview across every location. Editing still happens in
// the per-location builder; this is the "see the whole pharmacy at a glance"
// view. Reuses the same colored ShiftBlock + role banding as the grid.

import { eachDate, fmtDay, fmtRange } from "@/lib/dates";
import ShiftBlock, { WorkTypeLegend } from "./shift-block";
import type { Location, Staff, WorkType } from "@/lib/types";
import type { PeriodBundle, ValidationOut } from "@/lib/schedule-data";

export interface OverviewSection {
  location: Location;
  bundle: PeriodBundle | null; // null = no schedule covering this week
  validation: ValidationOut | null;
}

function bandStaff(staff: Staff[]) {
  const band = (rt: Staff["ratio_type"]) =>
    staff.filter((s) => s.ratio_type === rt);
  return [
    { label: "Pharmacists", staff: band("pharmacist") },
    { label: "Technicians", staff: band("technician") },
    { label: "Other staff", staff: band("non_counting") },
  ].filter((b) => b.staff.length > 0);
}

function LocationSection({
  location,
  bundle,
  validation,
  workTypeById,
}: {
  location: Location;
  bundle: PeriodBundle | null;
  validation: ValidationOut | null;
  workTypeById: Map<string, WorkType>;
}) {
  if (!bundle) {
    return (
      <div>
        <h3 className="font-brand text-base font-bold text-navy">
          {location.name}
        </h3>
        <p className="mt-1 font-body text-sm text-steel">
          No schedule covering this week.
        </p>
      </div>
    );
  }

  const dates = eachDate(bundle.period.start_date, bundle.period.end_date);
  const activeStaff = bundle.staff.filter((s) => s.active);
  const bands = bandStaff(activeStaff);

  const shiftsByCell = new Map<string, (typeof bundle.shifts)[number][]>();
  for (const s of bundle.shifts) {
    const key = `${s.staff_id}|${s.date}`;
    const list = shiftsByCell.get(key) ?? [];
    list.push(s);
    shiftsByCell.set(key, list);
  }

  const ptoByCell = new Set<string>();
  for (const t of bundle.approvedTimeOff)
    for (const d of eachDate(t.start_date, t.end_date))
      ptoByCell.add(`${t.staff_id}|${d}`);

  const deficientShiftIds = new Set<string>();
  for (const s of bundle.shifts) {
    if (!s.ratio_zone_id || !validation) continue;
    if (validation.deficientCells[s.ratio_zone_id]?.includes(s.date))
      deficientShiftIds.add(s.id);
  }

  const usedWorkTypeIds = new Set<string>();
  for (const s of bundle.shifts)
    for (const seg of s.segments)
      usedWorkTypeIds.add(seg.work_type_id ?? "__none__");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-brand text-base font-bold text-navy">
          {location.name}
        </h3>
        <span className="font-body text-xs text-steel">
          {bundle.period.status === "published" ? "Published" : "Draft"} ·{" "}
          {fmtRange(bundle.period.start_date, bundle.period.end_date)}
        </span>
      </div>
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface shadow-[var(--shadow-card)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 min-w-[160px] border-b border-r border-line bg-cloud px-3 py-2 text-left font-brand text-[9.5px] font-bold uppercase tracking-[1px] text-steel">
                Staff
              </th>
              {dates.map((d) => {
                const day = fmtDay(d);
                const weekend = day.dow === "Sat" || day.dow === "Sun";
                return (
                  <th
                    key={d}
                    className={`min-w-[88px] border-b border-line px-2 py-2 text-center font-brand text-[9.5px] font-bold uppercase tracking-[0.5px] ${
                      weekend ? "bg-cloud/60 text-steel/70" : "bg-cloud text-steel"
                    }`}
                  >
                    {day.dow}
                    <br />
                    <span className="font-body text-[10px] font-medium normal-case tracking-normal">
                      {day.label}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {bands.flatMap((band) => [
              <tr key={`h-${band.label}`}>
                <td className="sticky left-0 z-10 border-r border-t border-line bg-cloud px-3 py-1 font-brand text-[9px] font-bold uppercase tracking-[1.2px] text-steel">
                  {band.label} ({band.staff.length})
                </td>
                <td
                  colSpan={dates.length}
                  className="border-t border-line bg-cloud"
                />
              </tr>,
              ...band.staff.map((person) => (
                <tr key={person.id}>
                  <td className="sticky left-0 z-10 border-r border-t border-line bg-surface px-3 py-1.5">
                    <span className="font-body text-[13px] font-medium text-navy">
                      {person.full_name}
                    </span>
                    {person.ratio_type === "technician" && person.certified && (
                      <span className="ml-1.5 font-body text-[10px] text-steel">
                        CPhT
                      </span>
                    )}
                  </td>
                  {dates.map((d) => {
                    const key = `${person.id}|${d}`;
                    const shift = (shiftsByCell.get(key) ?? [])[0] ?? null;
                    const hasPto = ptoByCell.has(key);
                    return (
                      <td
                        key={d}
                        className={`border-t border-line px-1.5 py-1.5 text-center align-top ${
                          hasPto ? "bg-cloud" : ""
                        }`}
                      >
                        {hasPto && (
                          <span className="block font-brand text-[9px] font-bold uppercase tracking-[0.5px] text-steel">
                            PTO
                          </span>
                        )}
                        {shift && (
                          <ShiftBlock
                            segments={shift.segments}
                            workTypeById={workTypeById}
                            deficient={deficientShiftIds.has(shift.id)}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <WorkTypeLegend
          workTypes={bundle.workTypes}
          usedIds={usedWorkTypeIds}
        />
      </div>
    </div>
  );
}

export default function AllLocationsOverview({
  sections,
  workTypes,
}: {
  sections: OverviewSection[];
  workTypes: WorkType[];
}) {
  const workTypeById = new Map(workTypes.map((w) => [w.id, w]));
  return (
    <div className="space-y-8">
      {sections.map((s) => (
        <LocationSection
          key={s.location.id}
          location={s.location}
          bundle={s.bundle}
          validation={s.validation}
          workTypeById={workTypeById}
        />
      ))}
    </div>
  );
}

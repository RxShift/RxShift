import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ScheduleMatrix from "@/components/app/schedule/schedule-matrix";
import AiCommandBar from "@/components/app/schedule/ai-command-bar";
import BuildModeToggle from "@/components/app/schedule/build-mode-toggle";
import {
  loadAllLocationsBundle,
  validateRangeBundle,
} from "@/lib/schedule-data";
import { signedAvatarUrls } from "@/lib/avatars";
import {
  addDaysStr,
  fmtRange,
  mondayOf,
  monthStart,
  nowInTimeZone,
  periodEnd,
} from "@/lib/dates";
import type { Department, Location, ScheduleCycle } from "@/lib/types";

// Build Schedule = the manager/scheduler surface, LOCKED to the org's build
// cadence. The window IS one cadence period (week / 2-week / month per
// tenant.schedule_cycle) — there's no span picker here, because building is
// always one period at a time. (Reviewing in any span lives on View Schedule.)
function cadenceWindow(
  cycle: ScheduleCycle,
  anchor: string
): { start: string; end: string } {
  if (cycle === "monthly") {
    const start = monthStart(anchor);
    return { start, end: periodEnd(start, "monthly") };
  }
  const start = mondayOf(anchor);
  return { start, end: periodEnd(start, cycle) };
}

function periodLabel(cycle: ScheduleCycle, start: string, end: string): string {
  if (cycle === "monthly") {
    return new Date(`${start}T00:00:00Z`).toLocaleString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return fmtRange(start, end);
}

const pillBase =
  "whitespace-nowrap rounded-full border font-brand font-semibold transition-colors";
function pillCls(active: boolean) {
  return `${pillBase} px-3.5 py-1.5 text-[13px] ${
    active
      ? "border-[#1C2F5E] bg-[#1C2F5E] text-white"
      : "border-line bg-surface text-steel hover:text-navy"
  }`;
}

function LocationNav({
  locations,
  activeLocationId,
  anchor,
}: {
  locations: Location[];
  activeLocationId: string | null;
  anchor: string;
}) {
  const href = (loc?: string) =>
    `/app/schedule?${loc ? `location=${loc}&` : ""}anchor=${anchor}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {locations.length > 1 && (
        <Link href={href()} className={pillCls(!activeLocationId)}>
          All locations
        </Link>
      )}
      {locations.map((l) => (
        <Link
          key={l.id}
          href={href(l.id)}
          className={pillCls(l.id === activeLocationId)}
        >
          {l.name}
        </Link>
      ))}
    </div>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; anchor?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const tenant = session!.tenant!;

  // Build is for managers/schedulers. A read-only or staff user who lands here
  // (e.g. an old link) goes to the read-only View Schedule instead.
  const role = session?.appUser?.role ?? null;
  const canBuild =
    role === "owner_admin" || role === "scheduler" || role === "supervisor";
  if (role && !canBuild) redirect("/app/view-schedule");

  const supabase = await createClient();

  const [{ data: locations }, { data: departments }] = await Promise.all([
    supabase.from("location").select("*").order("name"),
    supabase.from("department").select("*").order("name"),
  ]);
  const locs = (locations ?? []) as Location[];
  const depts = (departments ?? []) as Department[];

  if (locs.length === 0) {
    return (
      <>
        <PageHeader title="Build Schedule" />
        <div className="flex-1 p-8">
          <EmptyState
            message="Add a location before building a schedule — every shift belongs to one, and the ratio is calculated per location."
            action={
              <Link
                href="/app/settings/locations"
                className="rounded-md bg-amber px-5 py-2.5 font-brand text-sm font-bold text-white hover:bg-amber-dark"
              >
                Add a location
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const cycle = tenant.schedule_cycle;
  const today = nowInTimeZone(tenant.timezone).date;
  const anchor =
    params.anchor && /^\d{4}-\d{2}-\d{2}$/.test(params.anchor)
      ? params.anchor
      : today;
  const { start, end } = cadenceWindow(cycle, anchor);
  const label = periodLabel(cycle, start, end);
  const locationFilter =
    params.location && locs.some((l) => l.id === params.location)
      ? params.location
      : null;

  const allBundle = await loadAllLocationsBundle(start, end);
  const validation = validateRangeBundle(allBundle, tenant);
  const avatarUrls = await signedAvatarUrls(supabase, allBundle.staff);

  // Holidays for the window — tenant-wide, purely visual (column tint + label).
  const { data: holidayRows } = await supabase
    .from("holiday")
    .select("date, name")
    .gte("date", start)
    .lte("date", end);
  const holidaysByDate: Record<string, string> = {};
  for (const h of (holidayRows ?? []) as { date: string; name: string }[])
    holidaysByDate[h.date] = h.name;

  // Steppers move one cadence PERIOD at a time (the day just outside the window
  // lands in the neighbouring period).
  const prevAnchor = addDaysStr(start, -1);
  const nextAnchor = addDaysStr(end, 1);
  const stepHref = (a: string) =>
    `/app/schedule?${locationFilter ? `location=${locationFilter}&` : ""}anchor=${a}`;
  const stepLink =
    "rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy hover:border-steel/40";

  const title = locationFilter
    ? `Build Schedule — ${locs.find((l) => l.id === locationFilter)?.name ?? ""}`
    : "Build Schedule — All locations";

  // Ask AI works on the cadence period for the WORKING location (selected, or
  // the first). Switching the location pill changes the AI's scope.
  const workingLocationId = locationFilter ?? locs[0]?.id ?? null;
  const refDate = today >= start && today <= end ? today : start;
  const aiPeriod = workingLocationId
    ? allBundle.periods.find(
        (p) =>
          p.location_id === workingLocationId &&
          p.start_date <= refDate &&
          p.end_date >= refDate
      )
    : undefined;
  const aiLocName = locs.find((l) => l.id === workingLocationId)?.name ?? "";
  const aiContextNote = aiPeriod
    ? `Working in ${aiLocName} · ${fmtRange(aiPeriod.start_date, aiPeriod.end_date)}`
    : `Working in ${aiLocName} · ${fmtRange(start, end)} (no shifts yet)`;

  return (
    <>
      <PageHeader title={title} />
      <div className="schedule-content flex-1 min-w-0 space-y-4 p-8">
        <div className="schedule-chrome">
          <LocationNav
            locations={locs}
            activeLocationId={locationFilter}
            anchor={anchor}
          />
        </div>
        <div className="schedule-chrome flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-brand text-[14px] font-bold text-navy">
              Building: <span className="text-amber">{label}</span>
            </span>
            <BuildModeToggle />
          </div>
          <div className="flex items-center gap-3">
            <Link href={stepHref(prevAnchor)} className={stepLink}>
              ← Prev
            </Link>
            <Link
              href={stepHref(today)}
              className="font-body text-sm font-medium text-steel hover:text-navy"
            >
              Today
            </Link>
            <Link href={stepHref(nextAnchor)} className={stepLink}>
              Next →
            </Link>
          </div>
        </div>
        {workingLocationId && (
          <div className="schedule-chrome">
            <AiCommandBar
              periodId={aiPeriod?.id ?? null}
              locationId={workingLocationId}
              refDate={refDate}
              contextNote={aiContextNote}
            />
          </div>
        )}
        <ScheduleMatrix
          tenant={tenant}
          today={today}
          viewStart={start}
          viewEnd={end}
          periods={allBundle.periods}
          shifts={allBundle.shifts}
          staff={allBundle.staff}
          workTypes={allBundle.workTypes}
          locations={allBundle.locations}
          departments={depts}
          approvedTimeOff={allBundle.approvedTimeOff}
          ptoDays={allBundle.ptoDays}
          holidaysByDate={holidaysByDate}
          validation={validation}
          locationFilter={locationFilter}
          avatarUrls={avatarUrls}
          anchor={anchor}
          periodLabel={label}
          aiPeriodId={aiPeriod?.id ?? null}
          aiLocationId={workingLocationId}
          aiRefDate={refDate}
        />
      </div>
    </>
  );
}

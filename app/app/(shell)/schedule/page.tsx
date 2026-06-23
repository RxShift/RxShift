import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ScheduleMatrix from "@/components/app/schedule/schedule-matrix";
import AiCommandBar from "@/components/app/schedule/ai-command-bar";
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
import type { Department, Location } from "@/lib/types";

// The schedule is ONE person-centric matrix. You build under All Locations
// (a person, a day, pick the location); selecting a location is just a view
// filter. The window selector (week / 2-week / month) sets the span; periods
// are created/published behind the scenes.
const VIEW_MODES = ["week", "2week", "month"] as const;
type ViewMode = (typeof VIEW_MODES)[number];

function viewWindow(
  view: ViewMode,
  anchor: string
): { start: string; end: string } {
  if (view === "month") {
    const start = monthStart(anchor);
    return { start, end: periodEnd(start, "monthly") };
  }
  const start = mondayOf(anchor);
  return { start, end: addDaysStr(start, view === "2week" ? 13 : 6) };
}

const pillBase =
  "whitespace-nowrap rounded-full border font-brand font-semibold transition-colors";
function pillCls(active: boolean, small = false) {
  return `${pillBase} ${small ? "px-3 py-1 text-[12px]" : "px-3.5 py-1.5 text-[13px]"} ${
    active
      ? "border-[#1C2F5E] bg-[#1C2F5E] text-white"
      : "border-line bg-surface text-steel hover:text-navy"
  }`;
}

function LocationNav({
  locations,
  activeLocationId,
  view,
}: {
  locations: Location[];
  activeLocationId: string | null;
  view: ViewMode;
}) {
  const href = (loc?: string) =>
    `/app/schedule?view=${view}${loc ? `&location=${loc}` : ""}`;
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

function WindowNav({
  activeView,
  locationId,
}: {
  activeView: ViewMode;
  locationId: string | null;
}) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "2week", label: "2 weeks" },
    { key: "month", label: "Month" },
  ];
  const href = (v: ViewMode) =>
    `/app/schedule?view=${v}${locationId ? `&location=${locationId}` : ""}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {modes.map((m) => (
        <Link
          key={m.key}
          href={href(m.key)}
          className={pillCls(activeView === m.key, true)}
        >
          {m.label}
        </Link>
      ))}
    </div>
  );
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{
    location?: string;
    view?: string;
    anchor?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const tenant = session!.tenant!;
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
        <PageHeader title="Schedule" />
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

  const today = nowInTimeZone(tenant.timezone).date;
  const view: ViewMode = (VIEW_MODES as readonly string[]).includes(
    params.view ?? ""
  )
    ? (params.view as ViewMode)
    : "week";
  const anchor =
    params.anchor && /^\d{4}-\d{2}-\d{2}$/.test(params.anchor)
      ? params.anchor
      : today;
  const { start, end } = viewWindow(view, anchor);
  const locationFilter =
    params.location && locs.some((l) => l.id === params.location)
      ? params.location
      : null;

  const allBundle = await loadAllLocationsBundle(start, end);
  const validation = validateRangeBundle(allBundle, tenant);
  const avatarUrls = await signedAvatarUrls(supabase, allBundle.staff);

  const stepLen = view === "2week" ? 14 : 7;
  const prevAnchor =
    view === "month" ? addDaysStr(start, -1) : addDaysStr(start, -stepLen);
  const nextAnchor =
    view === "month" ? addDaysStr(end, 1) : addDaysStr(start, stepLen);
  const stepHref = (a: string) =>
    `/app/schedule?view=${view}${locationFilter ? `&location=${locationFilter}` : ""}&anchor=${a}`;
  const stepLink =
    "rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy hover:border-steel/40";

  const title = locationFilter
    ? `Schedule — ${locs.find((l) => l.id === locationFilter)?.name ?? ""}`
    : "Schedule — All locations";

  // Ask AI works on the period covering the current week for the WORKING
  // location (the selected one, or the first). Resolved from the data already
  // loaded — switching the location pill changes the AI's scope.
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

  return (
    <>
      <PageHeader title={title} />
      <div className="flex-1 min-w-0 space-y-4 p-8">
        <LocationNav
          locations={locs}
          activeLocationId={locationFilter}
          view={view}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WindowNav activeView={view} locationId={locationFilter} />
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
          <AiCommandBar
            periodId={aiPeriod?.id ?? null}
            locationId={workingLocationId}
            refDate={refDate}
            contextNote={
              aiPeriod
                ? `Working in ${aiLocName} · ${fmtRange(aiPeriod.start_date, aiPeriod.end_date)}`
                : `Working in ${aiLocName} · ${fmtRange(start, end)} (no shifts yet)`
            }
          />
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
          validation={validation}
          locationFilter={locationFilter}
          avatarUrls={avatarUrls}
        />
      </div>
    </>
  );
}

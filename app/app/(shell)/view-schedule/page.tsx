import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ScheduleView from "@/components/app/schedule/schedule-view";
import { loadAllLocationsBundle } from "@/lib/schedule-data";
import { signedAvatarUrls } from "@/lib/avatars";
import {
  addDaysStr,
  mondayOf,
  monthStart,
  nowInTimeZone,
  periodEnd,
} from "@/lib/dates";
import type { Department, Location } from "@/lib/types";

// View Schedule = the read-only, PUBLISHED-only schedule everyone can see. The
// week / 2-week / month control here is a *viewing* zoom (Build is locked to the
// org's cadence). Editing happens only on Build Schedule.
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
  anchor,
}: {
  locations: Location[];
  activeLocationId: string | null;
  view: ViewMode;
  anchor: string;
}) {
  const href = (loc?: string) =>
    `/app/view-schedule?view=${view}${loc ? `&location=${loc}` : ""}&anchor=${anchor}`;
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
  anchor,
}: {
  activeView: ViewMode;
  locationId: string | null;
  anchor: string;
}) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: "week", label: "Week" },
    { key: "2week", label: "2 weeks" },
    { key: "month", label: "Month" },
  ];
  const href = (v: ViewMode) =>
    `/app/view-schedule?view=${v}${locationId ? `&location=${locationId}` : ""}&anchor=${anchor}`;
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

export default async function ViewSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; view?: string; anchor?: string }>;
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
          <EmptyState message="No schedule yet — once a manager builds and publishes one, it shows here." />
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

  const bundle = await loadAllLocationsBundle(start, end);
  const avatarUrls = await signedAvatarUrls(supabase, bundle.staff);

  const { data: holidayRows } = await supabase
    .from("holiday")
    .select("date, name")
    .gte("date", start)
    .lte("date", end);
  const holidaysByDate: Record<string, string> = {};
  for (const h of (holidayRows ?? []) as { date: string; name: string }[])
    holidaysByDate[h.date] = h.name;

  const stepLen = view === "2week" ? 14 : 7;
  const prevAnchor =
    view === "month" ? addDaysStr(start, -1) : addDaysStr(start, -stepLen);
  const nextAnchor =
    view === "month" ? addDaysStr(end, 1) : addDaysStr(start, stepLen);
  const stepHref = (a: string) =>
    `/app/view-schedule?view=${view}${locationFilter ? `&location=${locationFilter}` : ""}&anchor=${a}`;
  const stepLink =
    "rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy hover:border-steel/40";

  const title = locationFilter
    ? `View Schedule — ${locs.find((l) => l.id === locationFilter)?.name ?? ""}`
    : "View Schedule — All locations";

  return (
    <>
      <PageHeader title={title} />
      <div className="schedule-content flex-1 min-w-0 space-y-4 p-8">
        <LocationNav
          locations={locs}
          activeLocationId={locationFilter}
          view={view}
          anchor={anchor}
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <WindowNav
            activeView={view}
            locationId={locationFilter}
            anchor={anchor}
          />
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
        <ScheduleView
          today={today}
          viewStart={start}
          viewEnd={end}
          shifts={bundle.shifts}
          staff={bundle.staff}
          workTypes={bundle.workTypes}
          locations={bundle.locations}
          departments={depts}
          approvedTimeOff={bundle.approvedTimeOff}
          ptoDays={bundle.ptoDays}
          holidaysByDate={holidaysByDate}
          avatarUrls={avatarUrls}
          locationFilter={locationFilter}
        />
      </div>
    </>
  );
}

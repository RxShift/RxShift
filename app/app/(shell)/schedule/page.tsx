import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ScheduleBuilder from "@/components/app/schedule/schedule-builder";
import NewPeriodButton from "@/components/app/schedule/new-period-button";
import AiCommandBar from "@/components/app/schedule/ai-command-bar";
import AllLocationsOverview, {
  type OverviewSection,
} from "@/components/app/schedule/all-locations-overview";
import { loadPeriodBundle, validateBundle } from "@/lib/schedule-data";
import { addDaysStr, fmtRange, nowInTimeZone } from "@/lib/dates";
import type { Location, SchedulePeriod } from "@/lib/types";

// Location switcher: "All locations" overview + one pill per location.
function ViewNav({
  locations,
  activeLocationId,
  isAll,
}: {
  locations: Location[];
  activeLocationId: string | null;
  isAll: boolean;
}) {
  const pill = (active: boolean) =>
    `whitespace-nowrap rounded-full border px-3.5 py-1.5 font-brand text-[13px] font-semibold transition-colors ${
      active
        ? "border-navy bg-navy text-white"
        : "border-line bg-surface text-steel hover:text-navy"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {locations.length > 1 && (
        <Link href="/app/schedule?view=all" className={pill(isAll)}>
          All locations
        </Link>
      )}
      {locations.map((l) => (
        <Link
          key={l.id}
          href={`/app/schedule?location=${l.id}`}
          className={pill(!isAll && l.id === activeLocationId)}
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
  searchParams: Promise<{
    location?: string;
    period?: string;
    view?: string;
    week?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const { data: locations } = await supabase
    .from("location")
    .select("*")
    .order("name");
  const locs = (locations ?? []) as Location[];

  if (locs.length === 0) {
    return (
      <>
        <PageHeader title="Schedule" />
        <div className="flex-1 p-8">
          <EmptyState
            message="Add a location before building a schedule — every schedule belongs to one."
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

  // Default location: prefer one with a PUBLISHED schedule — landing on an
  // empty draft (e.g. a location that hasn't opened yet) reads as broken.
  const { data: allPeriods } = await supabase
    .from("schedule_period")
    .select("*")
    .order("start_date", { ascending: false });
  const everyPeriod = (allPeriods ?? []) as SchedulePeriod[];

  // ── All-locations read-only overview ──────────────────────────────────
  if (params.view === "all" && locs.length > 1) {
    const today = nowInTimeZone(tenant.timezone).date;
    const target = params.week ?? today;

    // For each location, the period covering the target week (prefer
    // published), then load its bundle + validation read-only.
    const sections: OverviewSection[] = await Promise.all(
      locs.map(async (l) => {
        const covering = everyPeriod
          .filter(
            (p) =>
              p.location_id === l.id &&
              p.start_date <= target &&
              p.end_date >= target
          )
          .sort((a, b) =>
            a.status === b.status ? 0 : a.status === "published" ? -1 : 1
          );
        const period = covering[0] ?? null;
        if (!period)
          return { location: l, bundle: null, validation: null };
        const bundle = await loadPeriodBundle(period.id);
        return {
          location: l,
          bundle,
          validation: bundle ? validateBundle(bundle, tenant) : null,
        };
      })
    );

    return (
      <>
        <PageHeader title="Schedule — All locations" />
        <div className="flex-1 space-y-5 p-8">
          <ViewNav locations={locs} activeLocationId={null} isAll />
          <div className="flex items-center gap-3">
            <Link
              href={`/app/schedule?view=all&week=${addDaysStr(target, -7)}`}
              className="rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy hover:border-steel/40"
            >
              ← Prev week
            </Link>
            <span className="font-body text-sm font-medium text-steel">
              Week of {target}
            </span>
            <Link
              href={`/app/schedule?view=all&week=${addDaysStr(target, 7)}`}
              className="rounded-md border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy hover:border-steel/40"
            >
              Next week →
            </Link>
          </div>
          <AllLocationsOverview
            sections={sections}
            workTypes={
              sections.find((s) => s.bundle)?.bundle?.workTypes ?? []
            }
          />
        </div>
      </>
    );
  }

  const defaultLocationId =
    locs.find((l) =>
      everyPeriod.some(
        (p) => p.location_id === l.id && p.status === "published"
      )
    )?.id ?? locs[0].id;
  const locationId = params.location ?? defaultLocationId;

  const periodList = everyPeriod.filter((p) => p.location_id === locationId);

  // Default period: published first (newest), then newest of any status
  const periodId =
    params.period ??
    (periodList.find((p) => p.status === "published") ?? periodList[0])?.id;

  const locName = locs.find((l) => l.id === locationId)?.name ?? "";

  if (!periodId) {
    return (
      <>
        <PageHeader title={`Schedule — ${locName}`} />
        <div className="flex-1 space-y-5 p-8">
          <ViewNav
            locations={locs}
            activeLocationId={locationId}
            isAll={false}
          />
          <EmptyState
            message={`No schedule periods yet for ${locName}. Create the first ${tenant.schedule_cycle} period to start scheduling.`}
            action={<NewPeriodButton locationId={locationId} />}
          />
        </div>
      </>
    );
  }

  const bundle = await loadPeriodBundle(periodId);
  if (!bundle) {
    return (
      <>
        <PageHeader title="Schedule" />
        <div className="p-8 font-body text-sm text-steel">
          That period wasn&rsquo;t found.
        </div>
      </>
    );
  }

  const validation = validateBundle(bundle, tenant);

  return (
    <>
      <PageHeader
        title={`Schedule — ${locName} — ${fmtRange(bundle.period.start_date, bundle.period.end_date)}`}
      />
      <div className="flex-1 space-y-5 p-8">
        <ViewNav locations={locs} activeLocationId={locationId} isAll={false} />
        <AiCommandBar periodId={bundle.period.id} />
        <ScheduleBuilder
          tenant={tenant}
          locationId={locationId}
          periods={periodList}
          bundle={{
            period: bundle.period,
            shifts: bundle.shifts,
            staff: bundle.staff.filter((s) => s.active),
            workTypes: bundle.workTypes,
            zones: bundle.zones,
            approvedTimeOff: bundle.approvedTimeOff,
          }}
          validation={validation}
        />
      </div>
    </>
  );
}

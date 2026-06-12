import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ScheduleBuilder from "@/components/app/schedule/schedule-builder";
import NewPeriodButton from "@/components/app/schedule/new-period-button";
import AiCommandBar from "@/components/app/schedule/ai-command-bar";
import { loadPeriodBundle, validateBundle } from "@/lib/schedule-data";
import { fmtRange } from "@/lib/dates";
import type { Location, SchedulePeriod } from "@/lib/types";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; period?: string }>;
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

  const locationId = params.location ?? locs[0].id;
  const { data: periods } = await supabase
    .from("schedule_period")
    .select("*")
    .eq("location_id", locationId)
    .order("start_date", { ascending: false });
  const periodList = (periods ?? []) as SchedulePeriod[];

  const periodId = params.period ?? periodList[0]?.id;

  if (!periodId) {
    return (
      <>
        <PageHeader title="Schedule" />
        <div className="flex-1 p-8">
          <EmptyState
            message={`No schedule periods yet for ${locs.find((l) => l.id === locationId)?.name}. Create the first ${tenant.schedule_cycle} period to start scheduling.`}
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
        title={`Schedule — ${fmtRange(bundle.period.start_date, bundle.period.end_date)}`}
      />
      <div className="flex-1 space-y-5 p-8">
        <AiCommandBar periodId={bundle.period.id} />
        <ScheduleBuilder
          tenant={tenant}
          locations={locs}
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

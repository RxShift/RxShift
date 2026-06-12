import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ComplianceView from "@/components/app/log/compliance-view";
import {
  buildComplianceRecords,
  loadPeriodBundle,
  validateBundle,
} from "@/lib/schedule-data";
import { deficiencyStreaks } from "@/lib/engine/compliance";
import { fmtRange, todayStr } from "@/lib/dates";
import type { Location, SchedulePeriod } from "@/lib/types";

export default async function ComplianceLogPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const { data: periods } = await supabase
    .from("schedule_period")
    .select("*")
    .eq("status", "published")
    .order("start_date", { ascending: false });
  const published = (periods ?? []) as SchedulePeriod[];

  if (published.length === 0) {
    return (
      <>
        <PageHeader title="Compliance Record" />
        <div className="flex-1 p-8">
          <EmptyState
            message="The hourly compliance record generates automatically when you publish a schedule. No schedule has been published yet."
            action={
              <Link
                href="/app/schedule"
                className="rounded-md bg-amber px-5 py-2.5 font-brand text-sm font-bold text-white hover:bg-amber-dark"
              >
                Go to Schedule
              </Link>
            }
          />
        </div>
      </>
    );
  }

  // Default to the CURRENT week's record, not the newest period — with
  // future weeks already published, "newest" would show an empty future log
  const today = todayStr();
  const defaultPeriod =
    published.find((p) => p.start_date <= today && p.end_date >= today) ??
    published.find((p) => p.start_date <= today) ??
    published[0];
  const periodId = params.period ?? defaultPeriod.id;
  const bundle = await loadPeriodBundle(periodId);
  const { data: locations } = await supabase.from("location").select("*");
  const locs = (locations ?? []) as Location[];

  if (!bundle) {
    return (
      <>
        <PageHeader title="Compliance Record" />
        <div className="p-8 font-body text-sm text-steel">Period not found.</div>
      </>
    );
  }

  // Live regeneration from the current schedule — the publish-time snapshot
  // is retained separately in compliance_snapshot
  const records = buildComplianceRecords(bundle, tenant);
  const allRows = records.flatMap((r) => r.rows);
  const streaks = deficiencyStreaks(allRows);
  const validation = validateBundle(bundle, tenant);

  return (
    <>
      <PageHeader
        title={`Compliance Record — ${fmtRange(bundle.period.start_date, bundle.period.end_date)}`}
      />
      <div className="flex-1 p-8">
        <ComplianceView
          periods={published.map((p) => ({
            id: p.id,
            label: `${locs.find((l) => l.id === p.location_id)?.name ?? ""} ${fmtRange(p.start_date, p.end_date)}`,
          }))}
          periodId={periodId}
          records={records.map((r) => ({
            zoneId: r.zone.id,
            zoneName: r.zone.name,
            rows: r.rows,
          }))}
          streaks={streaks}
          constraintFlags={validation.constraintFlags}
          hasRatio={tenant.has_ratio}
        />
      </div>
    </>
  );
}

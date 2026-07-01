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
import type { Location, OverrideLog, SchedulePeriod } from "@/lib/types";

// Coverage Forecast — the projected hour-by-hour coverage IMPLIED BY THE
// PUBLISHED SCHEDULE ("are we scheduled to be in ratio?"). A planning aid,
// regenerated on read from the current schedule (the publish-time snapshot is
// kept in compliance_snapshot). It is NOT the audit — that's the immutable
// Compliance Record at /app/log, which reflects what ACTUALLY happened.
export default async function CoverageForecastPage({
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
        <PageHeader title="Coverage Forecast" />
        <div className="flex-1 p-8">
          <EmptyState
            message="The coverage forecast projects your hourly ratio from the published schedule. No schedule has been published yet."
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
        <PageHeader title="Coverage Forecast" />
        <div className="p-8 font-body text-sm text-steel">Period not found.</div>
      </>
    );
  }

  // Regenerated from the current published schedule (the plan).
  const records = buildComplianceRecords(bundle, tenant);
  const allRows = records.flatMap((r) => r.rows);
  const streaks = deficiencyStreaks(allRows);
  const validation = validateBundle(bundle, tenant);

  // Overrides logged when this period was published past a warning — the
  // acknowledged exceptions on the plan.
  const [{ data: overrideRows }, { data: users }, { data: staffRows }] =
    await Promise.all([
      supabase
        .from("override_log")
        .select("*")
        .eq("target_id", periodId)
        .order("created_at", { ascending: false }),
      supabase.from("app_user").select("supabase_user_id, staff_id, role, display_name"),
      supabase.from("staff").select("id, full_name"),
    ]);
  const staffNameById = new Map(
    ((staffRows ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ])
  );
  const actorName = new Map<string, string>();
  for (const u of (users ?? []) as {
    supabase_user_id: string;
    staff_id: string | null;
    role: string;
    display_name: string | null;
  }[]) {
    actorName.set(
      u.supabase_user_id,
      (u.staff_id && staffNameById.get(u.staff_id)) || u.display_name || u.role || "User"
    );
  }
  const overrides = ((overrideRows ?? []) as OverrideLog[]).map((o) => ({
    id: o.id,
    when: o.created_at,
    warning_type: o.warning_type,
    reason: o.reason,
    actor: actorName.get(o.actor_user_id) ?? "User",
  }));

  return (
    <>
      <PageHeader
        title={`Coverage Forecast — ${fmtRange(bundle.period.start_date, bundle.period.end_date)}`}
      />
      <div className="flex-1 p-8">
        <ComplianceView
          periods={published.map((p) => ({
            id: p.id,
            label: `${locs.find((l) => l.id === p.location_id)?.name ?? ""} ${fmtRange(p.start_date, p.end_date)}`,
          }))}
          periodId={periodId}
          records={records.map((r) => ({
            locationId: r.location.id,
            locationName: r.location.name,
            rows: r.rows,
          }))}
          streaks={streaks}
          constraintFlags={validation.constraintFlags}
          hasRatio={tenant.has_ratio}
          overrides={overrides}
          tenantName={tenant.name}
          periodLabel={fmtRange(bundle.period.start_date, bundle.period.end_date)}
          timeFormat={tenant.time_format}
          timezone={tenant.timezone}
        />
      </div>
    </>
  );
}

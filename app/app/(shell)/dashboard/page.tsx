import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import Badge from "@/components/ui/badge";
import { Card, StatCard } from "@/components/ui/card";
import { loadPeriodBundle, validateBundle } from "@/lib/schedule-data";
import { computeInsights, type Insight } from "@/lib/insights";
import { fmtRange, todayStr } from "@/lib/dates";
import type { Location, SchedulePeriod } from "@/lib/types";

export default async function DashboardPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const today = todayStr();
  const [
    { data: locations },
    { data: periods },
    { count: pendingTimeOff },
    { count: pendingSwaps },
    { count: staffCount },
  ] = await Promise.all([
    supabase.from("location").select("*").order("name"),
    supabase
      .from("schedule_period")
      .select("*")
      .order("start_date", { ascending: false })
      .limit(10),
    supabase
      .from("time_off_request")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("swap_request")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_manager"),
    supabase
      .from("staff")
      .select("*", { count: "exact", head: true })
      .eq("active", true),
  ]);

  const locs = (locations ?? []) as Location[];
  const allPeriods = (periods ?? []) as SchedulePeriod[];
  // The period covering today, else the most recent
  const current =
    allPeriods.find((p) => p.start_date <= today && p.end_date >= today) ??
    allPeriods[0] ??
    null;

  let insights: Insight[] = [];
  let deficientSlots = 0;
  let openFlags = 0;
  if (current) {
    const bundle = await loadPeriodBundle(current.id);
    if (bundle) {
      const validation = validateBundle(bundle, tenant);
      insights = computeInsights(bundle, validation);
      deficientSlots = validation.ratioFlags.length;
      openFlags = validation.constraintFlags.length;
    }
  }

  if (locs.length === 0) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <div className="flex-1 p-8">
          <EmptyState
            message="Welcome to RxShift. Start by adding your first location, then build a schedule."
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

  return (
    <>
      <PageHeader title="Dashboard" />
      <div className="flex-1 space-y-6 p-8">
        <div className="grid max-w-[1040px] gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Current period"
            value={current ? fmtRange(current.start_date, current.end_date) : "—"}
            sub={current?.status === "published" ? "Published" : current ? "Draft" : "No periods yet"}
          />
          {tenant.has_ratio && (
            <StatCard
              label="Deficient slots"
              value={deficientSlots}
              tone={deficientSlots > 0 ? "deficiency" : "compliant"}
              sub={deficientSlots > 0 ? "Needs attention" : "Fully compliant"}
            />
          )}
          <StatCard
            label="Open flags"
            value={openFlags}
            tone={openFlags > 0 ? "alert" : "compliant"}
            sub="Hours & availability"
          />
          <StatCard
            label="Pending requests"
            value={(pendingTimeOff ?? 0) + (pendingSwaps ?? 0)}
            tone={(pendingTimeOff ?? 0) + (pendingSwaps ?? 0) > 0 ? "alert" : "default"}
            sub={`${pendingTimeOff ?? 0} time off · ${pendingSwaps ?? 0} swaps`}
          />
        </div>

        <div className="grid max-w-[1040px] gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-brand text-base font-bold text-navy">
              Insights
            </h2>
            <ul className="space-y-3">
              {insights.map((insight, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      insight.tone === "deficiency"
                        ? "bg-[#C0392B]"
                        : insight.tone === "alert"
                          ? "bg-[#D4860A]"
                          : "bg-[#2E7D5E]"
                    }`}
                  />
                  <span className="font-body text-sm leading-relaxed text-navy">
                    {insight.text}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-3 font-brand text-base font-bold text-navy">
              Quick actions
            </h2>
            <div className="space-y-2.5">
              {[
                { href: "/app/schedule", label: "Open the schedule", sub: "Build, validate, publish" },
                { href: "/app/requests", label: "Review requests", sub: `${(pendingTimeOff ?? 0) + (pendingSwaps ?? 0)} pending` },
                { href: "/app/log", label: "Compliance record", sub: "Hourly documentation & exports" },
                { href: "/app/staff", label: "Manage staff", sub: `${staffCount ?? 0} active people` },
              ].map((a) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className="flex items-center justify-between rounded-lg border border-line p-3.5 transition-colors hover:border-amber"
                >
                  <div>
                    <p className="font-brand text-sm font-semibold text-navy">
                      {a.label}
                    </p>
                    <p className="font-body text-xs text-steel">{a.sub}</p>
                  </div>
                  <span className="text-amber">→</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        {locs.length > 1 && (
          <div className="max-w-[1040px]">
            <h2 className="mb-3 font-brand text-base font-bold text-navy">
              Locations
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {locs.map((l) => (
                <Card key={l.id}>
                  <p className="font-brand text-sm font-bold text-navy">{l.name}</p>
                  <p className="mt-1 font-body text-xs text-steel">
                    {l.address ?? "No address on file"}
                  </p>
                  <div className="mt-3">
                    <Link
                      href={`/app/schedule?location=${l.id}`}
                      className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      View schedule →
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {tenant.has_ratio && deficientSlots === 0 && current?.status === "published" && (
          <Badge tone="compliant">All zones compliant for the current period</Badge>
        )}
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import ReportCards from "@/components/app/reports/report-cards";
import { addDaysStr, fmtRange, todayStr } from "@/lib/dates";
import type { Location, SchedulePeriod } from "@/lib/types";

export default async function ReportsPage() {
  const session = await getSession();
  const role = session!.appUser!.role;
  if (!["owner_admin", "scheduler", "supervisor", "read_only"].includes(role)) {
    redirect("/app/me");
  }

  const supabase = await createClient();
  const [{ data: locations }, { data: periods }] = await Promise.all([
    supabase.from("location").select("id, name").order("name"),
    supabase
      .from("schedule_period")
      .select("*")
      .order("start_date", { ascending: false })
      .limit(40),
  ]);

  const locs = (locations ?? []) as Pick<Location, "id" | "name">[];
  const periodOptions = ((periods ?? []) as SchedulePeriod[]).map((p) => ({
    id: p.id,
    label: `${locs.find((l) => l.id === p.location_id)?.name ?? "Location"} · ${fmtRange(p.start_date, p.end_date)}${p.status === "draft" ? " (draft)" : ""}`,
  }));

  const today = todayStr();

  return (
    <>
      <PageHeader title="Reports" />
      <div className="flex-1 p-8">
        <ReportCards
          locations={locs}
          periods={periodOptions}
          isOwner={role === "owner_admin"}
          defaultFrom={addDaysStr(today, -27)}
          defaultTo={today}
        />
      </div>
    </>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import ReportCards from "@/components/app/reports/report-cards";
import { addDaysStr, todayStr } from "@/lib/dates";
import type { Location } from "@/lib/types";

export default async function ReportsPage() {
  const session = await getSession();
  const role = session!.appUser!.role;
  if (!["owner_admin", "scheduler", "supervisor", "read_only"].includes(role)) {
    redirect("/app/me");
  }

  const supabase = await createClient();
  const { data: locations } = await supabase
    .from("location")
    .select("id, name")
    .order("name");
  const locs = (locations ?? []) as Pick<Location, "id" | "name">[];

  const today = todayStr();

  return (
    <>
      <PageHeader title="Reports" />
      <div className="flex-1 p-8">
        <ReportCards
          locations={locs}
          isOwner={role === "owner_admin"}
          defaultFrom={addDaysStr(today, -27)}
          defaultTo={today}
        />
      </div>
    </>
  );
}

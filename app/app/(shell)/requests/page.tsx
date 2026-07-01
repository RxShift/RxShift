import { createClient } from "@/lib/supabase/server";
import { getSession, canManage } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import RequestsView from "@/components/app/requests/requests-view";
import { todayStr } from "@/lib/dates";
import type {
  Callout,
  Shift,
  Staff,
  SwapRequest,
  TimeOffRequest,
} from "@/lib/types";

export default async function RequestsPage() {
  const session = await getSession();
  const appUser = session!.appUser!;
  const tenant = session!.tenant!;
  const manager = canManage(appUser);
  const supabase = await createClient();

  const [
    { data: timeOff },
    { data: callouts },
    { data: swaps },
    { data: staff },
    { data: upcomingShifts },
  ] = await Promise.all([
    supabase
      .from("time_off_request")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("callout")
      .select("*")
      .order("logged_at", { ascending: false })
      .limit(50),
    supabase
      .from("swap_request")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("staff").select("*").eq("active", true).order("full_name"),
    supabase
      .from("shift")
      .select("*")
      .gte("date", todayStr())
      .order("date")
      .limit(300),
  ]);

  return (
    <>
      <PageHeader title="Requests" />
      <div className="flex-1 p-8">
        <RequestsView
          isManager={manager}
          myStaffId={appUser.staff_id}
          timeOff={(timeOff ?? []) as TimeOffRequest[]}
          callouts={(callouts ?? []) as Callout[]}
          swaps={(swaps ?? []) as SwapRequest[]}
          staff={(staff ?? []) as Staff[]}
          upcomingShifts={(upcomingShifts ?? []) as Shift[]}
          timeFormat={tenant.time_format}
          timezone={tenant.timezone}
        />
      </div>
    </>
  );
}

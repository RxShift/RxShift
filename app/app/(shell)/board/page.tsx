import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import LiveBoard from "@/components/app/board/live-board";
import { buildBoardView } from "@/lib/board-data";

export const dynamic = "force-dynamic";

// The live real-time ratio board — gated: only exists when the tenant has
// a ratio requirement (scoping §2.2: power-user compliance is opt-in).
export default async function LiveBoardPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  if (!tenant.has_ratio) redirect("/app/dashboard");

  const supabase = await createClient();
  const view = await buildBoardView(supabase, tenant);

  if (view.noPeriodToday) {
    return (
      <>
        <PageHeader title="Live Board" />
        <div className="flex-1 p-8">
          <EmptyState message="No schedule period covers today, so there's nothing to monitor live. Publish a schedule that includes today first." />
        </div>
      </>
    );
  }

  const isManager = ["owner_admin", "scheduler", "supervisor"].includes(
    session!.appUser!.role
  );

  return (
    <>
      <PageHeader
        title="Live Board"
        actions={
          <a
            href="/app/display"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-line px-3 py-1.5 font-brand text-xs font-semibold text-navy transition-colors hover:bg-cloud"
            title="Open the read-only wall display in a new tab"
          >
            Open display ↗
          </a>
        }
      />
      <div className="flex-1 p-8">
        <LiveBoard
          locations={view.locationCards}
          staff={view.statusList}
          isManager={isManager}
          statusOptions={view.statusOptions}
          labels={view.labels}
        />
      </div>
    </>
  );
}

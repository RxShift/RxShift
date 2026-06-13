import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import LiveStatusesManager from "@/components/app/settings/live-statuses-manager";
import { resolveStatuses } from "@/lib/live-status-config";
import type { LiveStatusConfig } from "@/lib/types";

export default async function StatusesSettingsPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  const { data: cfg } = await supabase.from("live_status_config").select("*");
  const resolved = resolveStatuses((cfg ?? []) as LiveStatusConfig[]);

  return (
    <div className="max-w-[840px] space-y-6">
      {!tenant.has_ratio && (
        <div className="rounded-lg border-l-[3px] border-l-[#D4860A] bg-[#FEF7ED] p-4 font-body text-sm text-[#8a5a06]">
          Statuses drive the live ratio board, which is only active when your
          organization has a ratio requirement. Enable it in Settings →
          Organization to use the live board.
        </div>
      )}

      <LiveStatusesManager initial={resolved} />
    </div>
  );
}

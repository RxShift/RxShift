import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/page-header";
import FeedbackList from "@/components/app/admin/feedback-list";
import type { Feedback } from "@/lib/types";

const STATUSES = ["new", "triaged", "in_progress", "done", "wont_do"];
const KINDS = ["bug", "feature", "feedback"];
const SOURCES = ["user", "system"];

// Platform-admin feedback inbox: user-submitted feedback/bugs/features AND
// system-detected issues (source='system'). feedback is service-role only.
export default async function FeedbackPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; source?: string; kind?: string }>;
}) {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");
  const { status, source, kind } = await searchParams;

  const service = createServiceClient();
  let query = service
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (status && STATUSES.includes(status)) query = query.eq("status", status);
  if (source && SOURCES.includes(source)) query = query.eq("source", source);
  if (kind && KINDS.includes(kind)) query = query.eq("kind", kind);
  const { data } = await query;
  const rows = (data ?? []) as Feedback[];

  // Signed URLs for screenshots (private 'feedback' bucket, service-role read).
  const paths = rows
    .map((r) => r.screenshot_path)
    .filter((p): p is string => Boolean(p));
  const screenshotUrls: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await service.storage
      .from("feedback")
      .createSignedUrls(paths, 3600);
    const byPath = new Map(
      (signed ?? [])
        .filter((s) => s.signedUrl && s.path)
        .map((s) => [s.path as string, s.signedUrl])
    );
    for (const r of rows) {
      if (r.screenshot_path) {
        const u = byPath.get(r.screenshot_path);
        if (u) screenshotUrls[r.id] = u;
      }
    }
  }

  const select = (
    name: string,
    value: string | undefined,
    opts: string[]
  ) => (
    <label className="font-body text-xs text-steel">
      {name[0].toUpperCase() + name.slice(1)}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="ml-2 rounded border border-line bg-surface px-2 py-1 text-sm text-navy"
      >
        <option value="">All</option>
        {opts.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title="Feedback" />
      <div className="flex-1 p-8">
        <p className="mb-4 max-w-[760px] font-body text-sm text-steel">
          One inbox for everything users report — bugs, feature requests, and
          general feedback — plus problems the system detects on its own (marked
          <span className="font-bold"> system</span>, e.g. a failed or bounced
          email).
        </p>

        <form
          method="get"
          className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3"
        >
          {select("status", status, STATUSES)}
          {select("source", source, SOURCES)}
          {select("kind", kind, KINDS)}
          <button
            type="submit"
            className="rounded-md bg-navy px-3 py-1.5 font-brand text-sm font-bold text-white"
          >
            Filter
          </button>
        </form>

        <div className="max-w-[820px]">
          <FeedbackList items={rows} screenshotUrls={screenshotUrls} />
        </div>
      </div>
    </>
  );
}

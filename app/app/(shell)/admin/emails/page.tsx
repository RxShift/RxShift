import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/page-header";
import type { EmailLog } from "@/lib/types";

const KINDS = ["notification", "auth", "demo_request", "feedback", "system"];
const STATUSES = [
  "sent",
  "delivered",
  "redirected",
  "suppressed",
  "failed",
  "bounced",
  "complained",
];

function statusTone(status: string): string {
  if (["failed", "bounced", "complained"].includes(status))
    return "bg-deficiency-bg text-deficiency";
  if (status === "suppressed") return "bg-cloud text-steel";
  if (status === "redirected") return "bg-alert-bg text-alert";
  return "bg-compliant-bg text-compliant"; // sent / delivered
}

// Platform-admin email log. email_log is service-role only (RLS, no policies),
// so all reads happen here on the server behind the platform-admin gate.
export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");
  const { kind, status, q } = await searchParams;

  const service = createServiceClient();
  let query = service
    .from("email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (kind && KINDS.includes(kind)) query = query.eq("kind", kind);
  if (status && STATUSES.includes(status)) query = query.eq("status", status);
  if (q && q.trim())
    query = query.or(`to_email.ilike.%${q.trim()}%,subject.ilike.%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as EmailLog[];

  const exportQs = new URLSearchParams();
  if (kind) exportQs.set("kind", kind);
  if (status) exportQs.set("status", status);
  if (q) exportQs.set("q", q);

  return (
    <>
      <PageHeader title="Email log" />
      <div className="flex-1 p-8">
        <p className="mb-4 max-w-[760px] font-body text-sm text-steel">
          Every email RxShift sends — notifications, sign-in links, the website
          demo form, feedback, and system alerts — recorded here through the
          single send path. Open one to see the exact email that went out.
        </p>

        <form
          method="get"
          className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface p-3"
        >
          <label className="font-body text-xs text-steel">
            Type
            <select
              name="kind"
              defaultValue={kind ?? ""}
              className="ml-2 rounded border border-line bg-surface px-2 py-1 text-sm text-navy"
            >
              <option value="">All</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label className="font-body text-xs text-steel">
            Status
            <select
              name="status"
              defaultValue={status ?? ""}
              className="ml-2 rounded border border-line bg-surface px-2 py-1 text-sm text-navy"
            >
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search to / subject"
            className="rounded border border-line bg-surface px-3 py-1.5 font-body text-sm text-navy"
          />
          <button
            type="submit"
            className="rounded-md bg-navy px-3 py-1.5 font-brand text-sm font-bold text-white"
          >
            Filter
          </button>
          <Link
            href={`/api/admin/emails?${exportQs.toString()}`}
            className="rounded-md border border-line px-3 py-1.5 font-brand text-sm font-medium text-navy"
          >
            Export
          </Link>
        </form>

        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-cloud/50 font-brand text-[11px] uppercase tracking-wide text-steel">
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center font-body text-sm text-steel">
                    No emails match.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line/60 hover:bg-cloud/40">
                  <td className="whitespace-nowrap px-3 py-2 font-body text-xs text-steel">
                    {r.created_at.replace("T", " ").slice(0, 16)}
                  </td>
                  <td className="px-3 py-2 font-body text-xs text-navy">{r.kind}</td>
                  <td className="px-3 py-2 font-body text-xs text-navy">
                    {r.to_email}
                    {r.redirected_to && (
                      <span className="text-steel"> → {r.redirected_to}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-body text-sm">
                    <Link
                      href={`/app/admin/emails/${r.id}`}
                      className="text-navy underline-offset-2 hover:underline"
                    >
                      {r.subject}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-0.5 font-brand text-[11px] font-bold ${statusTone(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-body text-[11px] text-steel">
          Showing up to 200 most recent. Use filters or Export for more.
        </p>
      </div>
    </>
  );
}

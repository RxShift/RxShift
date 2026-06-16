import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/page-header";
import type { EmailLog } from "@/lib/types";

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");
  const { id } = await params;

  const service = createServiceClient();
  const { data } = await service
    .from("email_log")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const row = data as EmailLog;

  const meta: [string, string | null][] = [
    ["Sent", row.created_at.replace("T", " ").slice(0, 19) + " UTC"],
    ["Type", row.kind],
    ["Status", row.status],
    ["To", row.to_email],
    ["Redirected to", row.redirected_to],
    ["From", row.from_email],
    ["Subject", row.subject],
    ["Provider id", row.provider_message_id],
    ["Related", row.related_type ? `${row.related_type}:${row.related_id}` : null],
    ["Error", row.error],
  ];

  return (
    <>
      <PageHeader title="Email detail" />
      <div className="flex-1 p-8">
        <div className="max-w-[760px]">
          <Link
            href="/app/admin/emails"
            className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
          >
            ← Email log
          </Link>

          <dl className="mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 rounded-lg border border-line bg-surface p-4 font-body text-sm">
            {meta
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="font-brand text-xs font-semibold text-steel">
                    {label}
                  </dt>
                  <dd className="break-words text-navy">{value}</dd>
                </div>
              ))}
          </dl>

          {row.related_type === "lead" && row.related_id && (
            <Link
              href={`/app/admin/leads/${row.related_id}`}
              className="mt-3 inline-block font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
            >
              View related lead →
            </Link>
          )}

          <h2 className="mb-2 mt-6 font-brand text-sm font-bold text-navy">
            The email as sent
          </h2>
          {row.body_html ? (
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={row.body_html}
              className="h-[640px] w-full rounded-lg border border-line bg-white"
            />
          ) : (
            <p className="font-body text-sm text-steel">
              No body stored — this send was suppressed by the safety gate before
              the email was rendered.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/ui/page-header";
import LeadForm from "@/components/app/admin/lead-form";
import LeadNotes from "@/components/app/admin/lead-notes";
import type { Lead, LeadNote } from "@/lib/types";

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");
  const { id } = await params;

  const service = createServiceClient();
  const [{ data: lead }, { data: notes }, { data: emails }] = await Promise.all([
    service.from("leads").select("*").eq("id", id).maybeSingle(),
    service
      .from("lead_notes")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: true }),
    service
      .from("email_log")
      .select("id, created_at, subject, status")
      .eq("related_type", "lead")
      .eq("related_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (!lead) notFound();

  const sentEmails = (emails ?? []) as {
    id: string;
    created_at: string;
    subject: string;
    status: string;
  }[];

  return (
    <>
      <PageHeader title={(lead as Lead).pharmacy_name} />
      <div className="flex-1 p-8">
        <div className="max-w-[760px]">
          <Link
            href="/app/admin/leads"
            className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
          >
            ← All leads
          </Link>
          <div className="mt-3">
            <LeadForm initial={lead as Lead} />
          </div>
          <LeadNotes leadId={id} notes={(notes ?? []) as LeadNote[]} />

          {sentEmails.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 font-brand text-sm font-bold text-navy">
                Emails sent
              </h2>
              <div className="rounded-lg border border-line">
                {sentEmails.map((e) => (
                  <Link
                    key={e.id}
                    href={`/app/admin/emails/${e.id}`}
                    className="flex items-center justify-between border-b border-line/60 px-3 py-2 last:border-0 hover:bg-cloud/40"
                  >
                    <span className="font-body text-sm text-navy">
                      {e.subject}
                    </span>
                    <span className="font-body text-xs text-steel">
                      {e.created_at.slice(0, 10)} · {e.status}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

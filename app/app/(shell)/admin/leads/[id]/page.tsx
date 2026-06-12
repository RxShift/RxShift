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
  const [{ data: lead }, { data: notes }] = await Promise.all([
    service.from("leads").select("*").eq("id", id).maybeSingle(),
    service
      .from("lead_notes")
      .select("*")
      .eq("lead_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!lead) notFound();

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
        </div>
      </div>
    </>
  );
}

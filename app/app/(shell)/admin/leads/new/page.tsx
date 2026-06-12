import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import PageHeader from "@/components/ui/page-header";
import LeadForm from "@/components/app/admin/lead-form";

export default async function NewLeadPage() {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) redirect("/app/dashboard");

  return (
    <>
      <PageHeader title="Add Lead" />
      <div className="flex-1 p-8">
        <div className="max-w-[760px]">
          <Link
            href="/app/admin/leads"
            className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
          >
            ← All leads
          </Link>
          <div className="mt-3">
            <LeadForm initial={null} />
          </div>
        </div>
      </div>
    </>
  );
}

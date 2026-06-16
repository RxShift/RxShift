import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { xlsxResponse } from "@/lib/reports";
import type { EmailLog } from "@/lib/types";

// Platform-admin export of the email log (xlsx). Separate from the tenant-gated
// /api/reports/[type] route, which is scoped to a single tenant's data.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) {
    return new Response("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const status = searchParams.get("status");
  const q = searchParams.get("q");

  const service = createServiceClient();
  let query = service
    .from("email_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  if (kind) query = query.eq("kind", kind);
  if (status) query = query.eq("status", status);
  if (q && q.trim())
    query = query.or(`to_email.ilike.%${q.trim()}%,subject.ilike.%${q.trim()}%`);
  const { data } = await query;
  const rows = (data ?? []) as EmailLog[];

  const out = rows.map((r) => ({
    Sent: r.created_at.replace("T", " ").slice(0, 19),
    Type: r.kind,
    Status: r.status,
    To: r.to_email,
    "Redirected To": r.redirected_to ?? "",
    From: r.from_email,
    Subject: r.subject,
    "Provider Id": r.provider_message_id ?? "",
    Related: r.related_type ? `${r.related_type}:${r.related_id}` : "",
    Error: r.error ?? "",
  }));

  return xlsxResponse(
    out,
    "Email log",
    `email-log-${new Date().toISOString().slice(0, 10)}.xlsx`
  );
}

import "server-only";
import { createServiceClient } from "./supabase/admin";
import { sendEmail } from "./email";
import type { FeedbackKind } from "./types";

const PLATFORM_ADMIN_EMAIL =
  process.env.PLATFORM_ADMIN_EMAIL || "jamison@jamisonwest.com";

export interface SystemIssueInput {
  kind?: FeedbackKind; // default 'bug'
  subject: string;
  body: string;
  tenantId?: string | null;
  related?: { type: string; id: string } | null;
}

/**
 * File a system-detected problem into the SAME feedback inbox users post to
 * (source='system'), then alert platform admins. Best-effort and loop-safe: the
 * alert email uses kind='system', whose own send failure will NOT recurse back
 * here (see sendEmail's failure branch). Light de-dupe: an open system issue with
 * the same subject in the last 24h is reused (freshness bumped) instead of
 * duplicated, so a bounce storm can't flood the inbox.
 */
export async function reportSystemIssue(input: SystemIssueInput): Promise<void> {
  const subject = input.subject.slice(0, 200);

  // 1. Record it as a system feedback row (the durable capture).
  try {
    const service = createServiceClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: dupes } = await service
      .from("feedback")
      .select("id")
      .eq("source", "system")
      .eq("subject", subject)
      .in("status", ["new", "triaged", "in_progress"])
      .gte("created_at", since)
      .limit(1);

    if (dupes && dupes.length > 0) {
      await service
        .from("feedback")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", dupes[0].id);
      return; // already open; don't duplicate or re-alert
    }

    await service.from("feedback").insert({
      tenant_id: input.tenantId ?? null,
      source: "system",
      kind: input.kind ?? "bug",
      subject,
      body: input.body,
      page_url: input.related ? `${input.related.type}:${input.related.id}` : null,
      status: "new",
    });
  } catch (e) {
    console.error("[system-report] failed to record system issue:", e);
    // fall through — still try to alert
  }

  // 2. Alert platform admins by email (loop-safe: kind='system').
  try {
    await sendEmail({
      kind: "system",
      to: PLATFORM_ADMIN_EMAIL,
      bypassGate: true,
      subject: `[RxShift system] ${subject}`,
      lines: [
        input.body,
        "This was logged to the platform Feedback inbox (source: system).",
      ],
      cta: {
        label: "Open Feedback",
        url: "https://app.rxshift.io/app/admin/feedback",
      },
    });
  } catch (e) {
    console.error("[system-report] admin alert email failed:", e);
  }

  // 3. Best-effort in-app notification to platform admins (needs a tenant_id —
  // notification.tenant_id is NOT NULL, so tenant-less issues alert by email only).
  if (input.tenantId) {
    try {
      const service = createServiceClient();
      const { data: admins } = await service
        .from("platform_admin")
        .select("supabase_user_id");
      if (admins && admins.length > 0) {
        await service.from("notification").insert(
          admins.map((a) => ({
            tenant_id: input.tenantId,
            user_id: a.supabase_user_id,
            type: "system_issue",
            payload: { subject },
            channel: "in_app",
          }))
        );
      }
    } catch (e) {
      console.error("[system-report] in-app notify failed:", e);
    }
  }
}

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import { reportSystemIssue } from "@/lib/system-report";
import type { EmailStatus } from "@/lib/types";

export const runtime = "nodejs";

// Resend delivery webhook. Resend signs events with Svix; we verify the
// signature with RESEND_WEBHOOK_SECRET, then update the matching email_log row
// by provider_message_id and file a system issue on bounce/complaint/failure.

function verifySvixSignature(
  secret: string,
  headers: Headers,
  rawBody: string
): boolean {
  try {
    const id = headers.get("svix-id");
    const ts = headers.get("svix-timestamp");
    const sigHeader = headers.get("svix-signature");
    if (!id || !ts || !sigHeader) return false;
    // Replay protection: reject events whose signed timestamp (unix seconds) is
    // more than 5 minutes off, so a captured valid event can't be replayed later.
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
      return false;
    }
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const signed = `${id}.${ts}.${rawBody}`;
    const expected = crypto
      .createHmac("sha256", key)
      .update(signed)
      .digest("base64");
    const exp = Buffer.from(expected);
    return sigHeader.split(" ").some((part) => {
      const sig = part.split(",")[1];
      if (!sig) return false;
      const got = Buffer.from(sig);
      return got.length === exp.length && crypto.timingSafeEqual(got, exp);
    });
  } catch {
    return false;
  }
}

const STATUS_BY_EVENT: Record<string, EmailStatus> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
};

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    // Not configured yet — acknowledge so Resend doesn't retry-storm, but do nothing.
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — event ignored");
    return NextResponse.json({ ok: true, configured: false });
  }
  if (!verifySvixSignature(secret, req.headers, rawBody)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const type = event.type ?? "";
  const emailId = event.data?.email_id;
  const status = STATUS_BY_EVENT[type];
  if (!status || !emailId) return NextResponse.json({ ok: true }); // ignore others

  const service = createServiceClient();
  const { data: rows } = await service
    .from("email_log")
    .select("id, tenant_id, to_email, subject, related_type, related_id")
    .eq("provider_message_id", emailId)
    .limit(1);
  const row = rows?.[0] as
    | {
        id: string;
        tenant_id: string | null;
        to_email: string;
        subject: string;
        related_type: string | null;
        related_id: string | null;
      }
    | undefined;

  if (row) {
    await service.from("email_log").update({ status }).eq("id", row.id);
  }

  if (status === "bounced" || status === "complained" || status === "failed") {
    await reportSystemIssue({
      kind: "bug",
      subject: `Email ${status}: ${row?.to_email ?? emailId}`,
      body: row
        ? `Resend reported "${type}" for "${row.subject}" sent to ${row.to_email}.`
        : `Resend reported "${type}" for message ${emailId} (no matching log row).`,
      tenantId: row?.tenant_id ?? null,
      related:
        row?.related_type && row?.related_id
          ? { type: row.related_type, id: row.related_id }
          : null,
    });
  }

  return NextResponse.json({ ok: true });
}

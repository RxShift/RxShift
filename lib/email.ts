import "server-only";
import { Resend } from "resend";
import { createServiceClient } from "./supabase/admin";
import {
  isRecipientAllowed,
  resolveEmailDelivery,
  type EmailTenant,
} from "./email-policy";
import { brandedEmailHtml, emailFields, emailLines } from "./email-template";
import type { EmailKind, EmailStatus } from "./types";

export { isRecipientAllowed, resolveEmailDelivery, type EmailTenant };
// Re-export the pure template helpers so existing call sites keep importing from
// "@/lib/email"; the implementations live in the side-effect-free email-template.
export { brandedEmailHtml, emailFields, emailLines };

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "hello@rxshift.io";

// ─── THE single send path ────────────────────────────────────────────────────
// Every email RxShift sends — notifications, sign-in links, the website demo
// form, feedback, system alerts — goes through sendEmail(). It applies branding,
// runs the safety gate (unless bypassed), sends via Resend, and writes one
// email_log row (best-effort). There is deliberately no other door to Resend.

export interface SendEmailInput {
  kind: EmailKind;
  to: string;
  subject: string;
  /** Prebuilt HTML, OR provide `lines` (+ optional `cta`) to wrap in the brand layout. */
  html?: string;
  lines?: string[];
  cta?: { label: string; url: string };
  afterCtaHtml?: string;
  /** Drives the safety gate. Omit/null for auth + self-addressed (to-ourselves) mail. */
  tenant?: EmailTenant | null;
  /** Skip the gate (sign-in links; mail we address to ourselves, e.g. the demo form). */
  bypassGate?: boolean;
  fromName?: string;
  replyTo?: string;
  related?: { type: string; id: string } | null;
  actorUserId?: string | null;
  /** Throw on Resend error (auth + contact) instead of best-effort logging. */
  throwOnError?: boolean;
}

export interface SendEmailResult {
  status: EmailStatus;
  providerMessageId: string | null;
}

interface EmailLogRow {
  tenant_id: string | null;
  kind: string;
  to_email: string;
  from_email: string;
  subject: string;
  body_html: string | null;
  status: EmailStatus;
  redirected_to: string | null;
  provider_message_id: string | null;
  error: string | null;
  related_type: string | null;
  related_id: string | null;
  actor_user_id: string | null;
}

/** Append a row to email_log. Best-effort — must never break a send. */
async function writeEmailLog(row: EmailLogRow): Promise<void> {
  try {
    const service = createServiceClient();
    await service.from("email_log").insert(row);
  } catch (e) {
    console.error("[email] email_log write failed (send unaffected):", e);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = `${input.fromName ?? "RxShift"} <${FROM_EMAIL}>`;
  const related_type = input.related?.type ?? null;
  const related_id = input.related?.id ?? null;
  const actor_user_id = input.actorUserId ?? null;

  // 1. Safety gate (unless bypassed or there is no tenant context).
  let deliverTo = input.to;
  let redirected = false;
  let redirectedTo: string | null = null;
  if (!input.bypassGate && input.tenant) {
    const delivery = resolveEmailDelivery(input.tenant, input.to);
    if (!delivery.send) {
      await writeEmailLog({
        tenant_id: input.tenant.id ?? null,
        kind: input.kind,
        to_email: input.to,
        from_email: FROM_EMAIL,
        subject: input.subject,
        body_html: null,
        status: "suppressed",
        redirected_to: null,
        provider_message_id: null,
        error: null,
        related_type,
        related_id,
        actor_user_id,
      });
      return { status: "suppressed", providerMessageId: null };
    }
    deliverTo = delivery.to;
    redirected = delivery.redirected;
    redirectedTo = redirected ? delivery.to : null;
  }

  // 2. Build HTML (with a demo-redirect annotation when applicable).
  const subject = redirected ? `[Demo] ${input.subject}` : input.subject;
  let html: string;
  const redirectNote = redirected
    ? `Demo redirect — this email was originally addressed to ${input.to}.`
    : null;
  if (input.html) {
    html = redirectNote
      ? brandedEmailHtml({ bodyHtml: emailLines([redirectNote]) }) + input.html
      : input.html;
  } else {
    const lines = redirectNote
      ? [redirectNote, ...(input.lines ?? [])]
      : input.lines ?? [];
    html = brandedEmailHtml({
      bodyHtml: emailLines(lines),
      cta: input.cta,
      afterCtaHtml: input.afterCtaHtml,
    });
  }

  // 3. Send via Resend.
  let status: EmailStatus = redirected ? "redirected" : "sent";
  let providerMessageId: string | null = null;
  let errorMsg: string | null = null;
  try {
    const { data, error } = await resend.emails.send({
      from,
      to: deliverTo,
      replyTo: input.replyTo,
      subject,
      html,
    });
    if (error) {
      status = "failed";
      errorMsg = (error as { message?: string }).message ?? JSON.stringify(error);
    } else {
      providerMessageId = data?.id ?? null;
    }
  } catch (e) {
    status = "failed";
    errorMsg = e instanceof Error ? e.message : String(e);
  }

  // 4. Log (best-effort).
  await writeEmailLog({
    tenant_id: input.tenant?.id ?? null,
    kind: input.kind,
    to_email: deliverTo,
    from_email: FROM_EMAIL,
    subject,
    body_html: html,
    status,
    redirected_to: redirectedTo,
    provider_message_id: providerMessageId,
    error: errorMsg,
    related_type,
    related_id,
    actor_user_id,
  });

  // 5. On failure: file a system issue (but never let a *system* email's own
  // failure recurse into another system report — that would loop).
  if (status === "failed") {
    if (input.kind !== "system") {
      try {
        const { reportSystemIssue } = await import("./system-report");
        await reportSystemIssue({
          kind: "bug",
          subject: `Email send failed: ${input.subject}`,
          body: `A "${input.kind}" email to ${deliverTo} failed to send.\n\nError: ${errorMsg ?? "unknown"}`,
          tenantId: input.tenant?.id ?? null,
          related: input.related ?? null,
        });
      } catch (e) {
        console.error("[email] reportSystemIssue failed:", e);
      }
    }
    if (input.throwOnError) {
      throw new Error(`Email send failed: ${errorMsg ?? "unknown"}`);
    }
  }

  return { status, providerMessageId };
}

/**
 * Branded sign-in link email. AUTH email — user-initiated, delivered to the
 * address the user typed — so it bypasses the tenant notification gate, exactly
 * like Supabase's own magic-link emails. Throws on failure so the login endpoint
 * can surface an error.
 */
export async function sendLoginLinkEmail(
  to: string,
  confirmUrl: string
): Promise<void> {
  await sendEmail({
    kind: "auth",
    to,
    bypassGate: true,
    throwOnError: true,
    subject: "Your RxShift sign-in link",
    lines: [
      "Click the button below to sign in to RxShift. The link expires in an hour and can be used once.",
    ],
    cta: { label: "Sign in to RxShift", url: confirmUrl },
    afterCtaHtml: emailLines([
      "If you didn't request this, you can safely ignore this email.",
    ]),
  });
}

/**
 * Branded notification email. Body lines are plain text (escaped). Best-effort:
 * failures are logged (to email_log + a system issue), never thrown — the in-app
 * notification row is the source of truth. The safety gate runs unconditionally.
 */
export async function sendNotificationEmail(
  tenant: EmailTenant,
  to: string,
  subject: string,
  lines: string[]
): Promise<void> {
  await sendEmail({
    kind: "notification",
    tenant,
    to,
    subject,
    lines,
    cta: { label: "Open RxShift", url: "https://app.rxshift.io" },
  });
}

import "server-only";
import { Resend } from "resend";
import {
  isRecipientAllowed,
  resolveEmailDelivery,
  type EmailTenant,
} from "./email-policy";

export { isRecipientAllowed, resolveEmailDelivery, type EmailTenant };

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = `RxShift <${process.env.RESEND_FROM_EMAIL || "hello@rxshift.io"}>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * THE branded email layout — every email RxShift sends uses this shell:
 * wordmark header, body content, optional amber CTA button, steel footer.
 * `bodyHtml` is trusted HTML (escape user values BEFORE building it);
 * the lines/cta helpers below escape for you.
 */
export function brandedEmailHtml(opts: {
  bodyHtml: string;
  cta?: { label: string; url: string };
  afterCtaHtml?: string;
}): string {
  const button = opts.cta
    ? `<p style="margin: 20px 0;">
        <a href="${escapeHtml(opts.cta.url)}" style="display: inline-block; background: #F07C30; color: #ffffff; font-family: -apple-system, 'Helvetica Neue', sans-serif; font-size: 14px; font-weight: bold; padding: 12px 26px; border-radius: 6px; text-decoration: none;">${escapeHtml(opts.cta.label)}</a>
      </p>`
    : "";
  return `
    <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
      <div style="padding: 18px 0; border-bottom: 2px solid #F07C30;">
        <span style="color: #1C2F5E; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Rx<span style="color:#F07C30; font-weight: 700;"> · </span><span style="font-weight: 500;">Shift</span></span>
      </div>
      <div style="padding: 22px 0; color: #4A5B7A; font-size: 15px; line-height: 1.65;">
        ${opts.bodyHtml}
        ${button}
        ${opts.afterCtaHtml ?? ""}
      </div>
      <p style="color: #9BAABB; font-size: 12px; border-top: 1px solid #DDE5EF; padding-top: 14px; margin: 0;">
        Sent by RxShift — compliance-ready pharmacy scheduling · rxshift.io
      </p>
    </div>
  `;
}

/** Escaped paragraph rows from plain-text lines. */
export function emailLines(lines: string[]): string {
  return lines
    .map((l) => `<p style="margin: 0 0 12px;">${escapeHtml(l)}</p>`)
    .join("");
}

/** Escaped label/value rows (for lead notifications and the like). */
export function emailFields(fields: [string, string][]): string {
  return fields
    .map(
      ([label, value]) =>
        `<p style="margin: 0 0 8px;"><strong style="color: #1C2F5E;">${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
    )
    .join("");
}

/**
 * Branded sign-in link email. This is an AUTH email — user-initiated,
 * delivered to the address the user typed (their own, or a registered
 * alias) — so it deliberately bypasses the tenant notification gate,
 * exactly like Supabase's own magic-link emails. Throws on failure so
 * the login endpoint can surface an error.
 */
export async function sendLoginLinkEmail(
  to: string,
  confirmUrl: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your RxShift sign-in link",
    html: brandedEmailHtml({
      bodyHtml: emailLines([
        "Click the button below to sign in to RxShift. The link expires in an hour and can be used once.",
      ]),
      cta: { label: "Sign in to RxShift", url: confirmUrl },
      afterCtaHtml: emailLines([
        "If you didn't request this, you can safely ignore this email.",
      ]),
    }),
  });
  if (error) throw new Error(`Login link email failed: ${error.message}`);
}

/**
 * Branded notification email. Body lines are plain text (escaped here).
 * Best-effort: notification email failures are logged, never thrown —
 * the in-app notification row is the source of truth.
 *
 * Requires the tenant so the safety gate runs unconditionally; suppressed
 * sends are logged WITHOUT the recipient address (roster emails are PII).
 */
export async function sendNotificationEmail(
  tenant: EmailTenant,
  to: string,
  subject: string,
  lines: string[]
): Promise<void> {
  const delivery = resolveEmailDelivery(tenant, to);
  if (!delivery.send) {
    console.warn("[email-safety] suppressed", {
      tenantId: tenant.id,
      status: tenant.status,
      isDemo: tenant.is_demo === true,
      killSwitch: tenant.outbound_email_enabled === false,
    });
    return;
  }
  // Demo redirect: one inbox sees everything the tenant would have sent
  const finalSubject = delivery.redirected ? `[Demo] ${subject}` : subject;
  const finalLines = delivery.redirected
    ? [`Demo redirect — this email was originally addressed to ${to}.`, ...lines]
    : lines;
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: delivery.to,
      subject: finalSubject,
      html: brandedEmailHtml({
        bodyHtml: emailLines(finalLines),
        cta: { label: "Open RxShift", url: "https://app.rxshift.io" },
      }),
    });
    if (error) console.error("Notification email failed:", error);
  } catch (e) {
    console.error("Notification email failed:", e);
  }
}

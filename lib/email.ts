import "server-only";
import { Resend } from "resend";
import { isRecipientAllowed, type EmailTenant } from "./email-policy";

export { isRecipientAllowed, type EmailTenant };

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
 * Branded sign-in link email for login ALIASES. This is an AUTH email —
 * user-initiated, delivered to an admin-registered address that already
 * has sign-in power over the account — so it deliberately bypasses the
 * tenant notification gate, exactly like Supabase's own magic-link emails.
 * Throws on failure so the login endpoint can surface an error.
 */
export async function sendLoginLinkEmail(
  to: string,
  confirmUrl: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    subject: "Your RxShift sign-in link",
    html: `
      <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 520px; margin: 0 auto;">
        <div style="padding: 16px 0; border-bottom: 2px solid #F07C30;">
          <strong style="color: #1C2F5E; font-size: 18px;">Rx<span style="color:#F07C30">·</span>Shift</strong>
        </div>
        <div style="padding: 20px 0; color: #4A5B7A; font-size: 15px; line-height: 1.65;">
          <p style="margin: 0 0 16px;">Click the button below to sign in to RxShift. The link expires in an hour and can be used once.</p>
          <p style="margin: 0 0 16px;">
            <a href="${escapeHtml(confirmUrl)}" style="display: inline-block; background: #F07C30; color: #ffffff; font-weight: bold; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Sign in to RxShift</a>
          </p>
          <p style="margin: 0;">If you didn't request this, you can safely ignore this email.</p>
        </div>
        <p style="color: #9BAABB; font-size: 12px; border-top: 1px solid #DDE5EF; padding-top: 12px;">
          Sent by RxShift — compliance-ready pharmacy scheduling.
        </p>
      </div>
    `,
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
  if (!isRecipientAllowed(tenant, to)) {
    console.warn("[email-safety] suppressed", {
      tenantId: tenant.id,
      status: tenant.status,
      killSwitch: tenant.outbound_email_enabled === false,
    });
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject,
      html: `
        <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 520px; margin: 0 auto;">
          <div style="padding: 16px 0; border-bottom: 2px solid #F07C30;">
            <strong style="color: #1C2F5E; font-size: 18px;">Rx<span style="color:#F07C30">·</span>Shift</strong>
          </div>
          <div style="padding: 20px 0; color: #4A5B7A; font-size: 15px; line-height: 1.65;">
            ${lines.map((l) => `<p style="margin: 0 0 12px;">${escapeHtml(l)}</p>`).join("")}
          </div>
          <p style="color: #9BAABB; font-size: 12px; border-top: 1px solid #DDE5EF; padding-top: 12px;">
            Sent by RxShift — compliance-ready pharmacy scheduling.
          </p>
        </div>
      `,
    });
    if (error) console.error("Notification email failed:", error);
  } catch (e) {
    console.error("Notification email failed:", e);
  }
}

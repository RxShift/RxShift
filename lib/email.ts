import "server-only";
import { Resend } from "resend";

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
 * Branded notification email. Body lines are plain text (escaped here).
 * Best-effort: notification email failures are logged, never thrown —
 * the in-app notification row is the source of truth.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  lines: string[]
): Promise<void> {
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

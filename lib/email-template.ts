// Pure email-template helpers — NO side effects (no "server-only", no Resend
// client). Split out from lib/email.ts so they can be imported by tsx scripts /
// the demo seed (lib/demo/mesa-vista.ts) without dragging in the server-only
// send path. lib/email.ts re-exports these so existing call sites are unchanged.

export function escapeHtml(value: string): string {
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

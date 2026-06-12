// Pure email-safety policy — no server-only imports so it is unit-testable.
// The mailer (lib/email.ts) enforces this on every send.

/** The tenant fields the email-safety gate needs (subset of Tenant). */
export interface EmailTenant {
  id: string;
  outbound_email_enabled: boolean;
  status: "setup" | "trial" | "live";
  email_allowlist: string[] | null;
}

/**
 * The single email-safety gate. Every app email passes through this —
 * there is deliberately no way to reach Resend without it.
 *
 * 1. Kill switch off → never send.
 * 2. Allowlist set → send ONLY to listed addresses (case-insensitive).
 * 3. No allowlist + tenant not live (setup/trial) → never send.
 * 4. No allowlist + live → send normally (production behavior).
 */
export function isRecipientAllowed(tenant: EmailTenant, to: string): boolean {
  if (tenant.outbound_email_enabled === false) return false;
  const norm = to.trim().toLowerCase();
  const list = (tenant.email_allowlist ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0) return list.includes(norm);
  return tenant.status === "live";
}

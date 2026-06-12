// Pure email-safety policy — no server-only imports so it is unit-testable.
// The mailer (lib/email.ts) enforces this on every send.

/** The tenant fields the email-safety gate needs (subset of Tenant). */
export interface EmailTenant {
  id: string;
  outbound_email_enabled: boolean;
  status: "setup" | "trial" | "live";
  email_allowlist: string[] | null;
  /** Demo tenant: fictional data, email redirected or suppressed */
  is_demo?: boolean;
  /** Demo tenants only: rewrite every send to this one address */
  demo_redirect_email?: string | null;
}

export type EmailDelivery =
  | { send: false }
  | { send: true; to: string; redirected: boolean };

/**
 * The single email-safety gate. Every app email passes through this —
 * there is deliberately no way to reach Resend without it.
 *
 * 1. Kill switch off → never send.
 * 2. Demo tenant → rewrite to demo_redirect_email; if unset, never send.
 *    (Demo rosters hold fictional addresses that must never be contacted;
 *    the redirect lets a live demo show real email flow into one inbox.)
 * 3. Allowlist set → send ONLY to listed addresses (case-insensitive).
 * 4. No allowlist + tenant not live (setup/trial) → never send.
 * 5. No allowlist + live → send normally (production behavior).
 */
export function resolveEmailDelivery(
  tenant: EmailTenant,
  to: string
): EmailDelivery {
  if (tenant.outbound_email_enabled === false) return { send: false };

  if (tenant.is_demo) {
    const redirect = tenant.demo_redirect_email?.trim().toLowerCase();
    return redirect
      ? { send: true, to: redirect, redirected: true }
      : { send: false };
  }

  const norm = to.trim().toLowerCase();
  const list = (tenant.email_allowlist ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length > 0)
    return list.includes(norm)
      ? { send: true, to: norm, redirected: false }
      : { send: false };

  return tenant.status === "live"
    ? { send: true, to: norm, redirected: false }
    : { send: false };
}

/** Convenience predicate kept for existing callers/tests. */
export function isRecipientAllowed(tenant: EmailTenant, to: string): boolean {
  return resolveEmailDelivery(tenant, to).send;
}

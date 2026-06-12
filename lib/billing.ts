// Billing scaffold — pure helpers over the tenant billing columns
// (migration 0011). 'manual' means Jamison invoices by hand; a Stripe
// integration later implements the SAME fields (provider, external_id,
// status webhooks) without schema changes.

import { getPricing } from "./pricing";
import type { Tenant } from "./types";

export interface BillingSummary {
  active: boolean;
  label: string; // e.g. "manual · 3 loc · $507/mo" or "—"
}

export function describeTenantBilling(tenant: Tenant): BillingSummary {
  if (tenant.is_demo) return { active: false, label: "demo — never billed" };
  if (tenant.billing_status === "none" || !tenant.billed_locations) {
    return { active: false, label: "—" };
  }
  const p = getPricing(tenant.billed_locations);
  const price =
    tenant.billing_interval === "annual"
      ? `$${p.annualTotal.toLocaleString("en-US")}/yr`
      : `$${p.monthlyTotal.toLocaleString("en-US")}/mo`;
  return {
    active: tenant.billing_status === "active",
    label: `${tenant.billing_provider ?? "manual"} · ${tenant.billed_locations} loc · ${price} · ${tenant.billing_status}`,
  };
}

/**
 * The entitlement gate. Deliberately permissive today — every tenant is
 * entitled while we sell high-touch. When Stripe lands, flip the marked
 * branch and past_due/canceled tenants get the dunning treatment.
 */
export function isTenantEntitled(tenant: Tenant): boolean {
  if (tenant.is_demo) return true;
  // TODO(stripe): return tenant.status !== "live" || tenant.billing_status === "active" | "trial";
  return true;
}

-- Billing scaffolding: enough structure to run manual subscriptions today
-- and wire Stripe/Chargebee later WITHOUT a schema change. No payment
-- processing exists yet — 'manual' means Jamison invoices by hand.

alter table tenant
  add column billing_status text not null default 'none'
    check (billing_status in ('none', 'trial', 'active', 'past_due', 'canceled')),
  add column billing_provider text
    check (billing_provider in ('manual', 'stripe', 'chargebee')),
  add column billing_external_id text,
  add column billed_locations int check (billed_locations between 1 and 99),
  add column billing_interval text
    check (billing_interval in ('monthly', 'annual')),
  add column billing_started_at timestamptz;

-- Demo tenant mode. A demo tenant holds entirely fictional data (fake
-- staff emails that must never be contacted). Email behavior:
--   demo_redirect_email set   -> every app email the tenant would send is
--                                rewritten to that one address (lets a
--                                live demo show real email flow)
--   demo_redirect_email empty -> all app email suppressed
-- Demo tenants never go live and are labeled in the admin console.

alter table tenant
  add column is_demo boolean not null default false,
  add column demo_redirect_email text;

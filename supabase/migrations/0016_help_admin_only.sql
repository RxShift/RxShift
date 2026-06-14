-- Admin-only help articles.
--
-- Add a visibility flag and gate it at the RLS layer so platform-admin docs
-- (admin console, Leads CRM, impersonation, cross-tenant email) are readable
-- ONLY by platform admins. Because both the help page and the AI help assistant
-- query with the auth-scoped client, this single policy keeps admin docs out of
-- a tenant user's help index AND out of the assistant's corpus — no app-code
-- gating to forget.

alter table help_article add column admin_only boolean not null default false;

drop policy help_select on help_article;
create policy help_select on help_article for select
  using (
    published = true
    and auth.uid() is not null
    and (
      admin_only = false
      or exists (
        select 1 from platform_admin pa
        where pa.supabase_user_id = auth.uid()
      )
    )
  );

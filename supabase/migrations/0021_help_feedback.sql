-- 0021: Help content for the new feedback feature (tenant-facing) and the
-- platform email log + feedback triage (admin-only). admin_only rows are hidden
-- from tenants and the help assistant via RLS (migration 0016).

insert into help_article (slug, title, category, sort_order, body_markdown, published, admin_only) values

('giving-feedback', 'Giving feedback and reporting a bug', 'Basics', 90,
'## Tell us what you think

See something off, want a feature, or hit a bug? Use the **Feedback / report a bug** button at the bottom of the left sidebar.

1. Pick a type — **Bug**, **Feature**, or **Feedback**.
2. Add a short subject and a description.
3. Optionally attach a screenshot.
4. Send.

Your note goes straight to the RxShift team. We read every one.', true, false),

('platform-email-log-and-feedback', 'Email log and feedback (platform admin)', 'Platform Admin', 50,
'## Email log

**Platform -> Emails** lists every email RxShift has sent — notifications, sign-in links, the website demo form, feedback, and system alerts — recorded through the single send path. Filter by type/status or search by recipient/subject, and open any row to see the exact email that went out. Statuses: sent, delivered, redirected (demo), suppressed (gate), failed, bounced, complained. Export to xlsx.

App-sent emails are linked to their lead and listed on the lead detail page.

## Feedback inbox

**Platform -> Feedback** is one inbox for both user-submitted feedback/bugs/features and system-detected problems (marked *system* — for example a failed or bounced email). Filter by status, source, or kind; set a status; and add an internal note.', true, true);

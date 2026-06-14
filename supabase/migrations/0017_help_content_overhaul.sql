-- Help content overhaul.
--
-- 1) Rewrite "Building a schedule" — the old copy told people to "pick the
--    period," which was misleading once the create-next-period flow shipped.
-- 2) Add tenant articles for the new navigation, view selector, statuses,
--    alerts, flags, and branding.
-- 3) Add platform-admin-only articles (admin_only = true) for the console,
--    Leads CRM, impersonation, and cross-tenant email.
--
-- Inserts use ON CONFLICT (slug) DO NOTHING so re-running is safe.

update help_article set
  body_markdown =
'# Building a schedule

Open **Schedule**. If no period exists yet for the location, click **Create next period** to start one — RxShift sizes it to your schedule cycle (weekly, biweekly, or monthly, set in Settings → Organization).

**Moving between periods.** Use the **◀ / ▶** arrows or the period dropdown in the toolbar. **Create next period** is always available, so you can build next month even while this month is full.

**Adding shifts.** Click any empty cell to add a shift for that person and day. Set the start and end times and the work type. A shift can be split into segments — for example, 8am–12pm dispensing (counts toward ratio) and 12pm–2pm inventory (does not count).

**Copy last period.** On a brand-new empty period, click **Copy last period''s weekday pattern** to carry every shift forward on the same weekdays (break times included), then adjust.

**Flags.** A red ⚠ badge marks a shift in a deficient ratio slot; an amber ring marks a constraint flag (hour cap, availability conflict). Flags are advisory — RxShift never blocks you. Publishing past them asks for a reason, which is logged.

**Draft vs published.** Drafts are visible to managers only. Publishing makes the schedule visible to staff and generates the compliance record. Edits after publishing re-check compliance.',
  updated_at = now()
where slug = 'building-a-schedule';

insert into help_article (slug, title, category, sort_order, body_markdown, published, admin_only) values

('creating-and-viewing-periods', 'Creating periods and moving around the schedule', 'Scheduling', 4,
'## Creating the next period

Open **Schedule** and click **Create next period** in the toolbar. It always works — even when the current period is full — so you can build July while June is still up. RxShift sizes each period to your schedule cycle (Settings → Organization).

## Moving around

- **◀ / ▶** step to the previous or next period; the dropdown jumps to any period.
- The grid opens on the period that contains today and scrolls to today''s column.
- Staff names stay fixed as you scroll sideways; the date row stays fixed as you scroll down — like a spreadsheet.

## Viewing by week, 2 weeks, or month

Use **Edit period / Week / 2 weeks / Month** at the top. Viewing is separate from how you build: you can browse a whole month even if you build weekly. Columns are shaded to show the cutoff — **published** (staff can see it), **draft** (not visible yet), and **no period** (create one to schedule there). You can still click a cell inside any built period to edit it.

## All locations

With more than one location, **All locations** shows every location for one week side by side (read-only).', true, false),

('live-board-statuses', 'The live board and statuses', 'Compliance', 6,
'## The live board

**Live Board** shows, right now, who is working in each ratio zone and whether you are within your pharmacist-to-technician ratio. It refreshes on its own about once a minute. A zone turns red the moment counting technicians exceed what the on-duty pharmacists allow.

## Statuses

Each person has a current status — by default **Working** (counts toward ratio), plus **Lunch**, **Meeting**, **Off floor**, and **Non-tech**. Tapping a status on the board, or on **My Schedule**, updates the ratio instantly: someone at lunch stops counting.

## Customizing statuses

Managers can tailor statuses in **Settings → Statuses** — hide ones you do not use, rename them to match how your pharmacy talks, and choose whether each one counts toward the ratio. **Working** is always shown and always counts.', true, false),

('out-of-ratio-alerts', 'Out-of-ratio alerts', 'Compliance', 7,
'## Staying ahead of a deficiency

The live board shows a red zone the instant you are out of ratio. RxShift can also alert your managers so a gap on the floor does not go unnoticed.

## How alerts work

- When a zone stays deficient for a few minutes, RxShift notifies your pharmacy''s managers — in the app, and by email once the pharmacy is live.
- A short grace period means an accidental tap that is fixed right away never triggers an alert.
- An ongoing deficiency is not re-sent over and over.

RxShift never contacts a board of pharmacy. Whether and how to report is always your pharmacy''s decision.', true, false),

('understanding-flags', 'Red and amber flags on the schedule', 'Compliance', 8,
'## What the marks mean

- **Red ⚠ badge** on a shift — that shift falls in a slot that is out of ratio (a deficiency). The badge sits in the corner so it shows on any work-type color.
- **Amber ring** around a shift — a constraint flag, such as an hour cap or an availability conflict.
- **Grey cell** — approved time off.

## Fixing or accepting them

Click the flag summary above the grid for a plain-language reason. Flags are advisory — RxShift never blocks you. If you publish with open flags, you are asked for a short reason, which is saved to the override log.', true, false),

('branding-your-workspace', 'Adding your pharmacy logo and color', 'Workspace', 46,
'## Make it yours

Owners can add light branding in **Settings → Branding**:

- **Accent color** — applies to buttons, active navigation, and highlights, in both light and dark mode.
- **Logo URL** — a hosted image (PNG or SVG) shown in the sidebar.

The RxShift mark always stays in the sidebar, so it is never unclear which product you are in, and the change is scoped so your colors cannot make the app hard to read. Uploading a logo from your computer is coming later — for now, paste a link to a hosted image.', true, false),

-- ── Platform-admin only (hidden from tenant users and the AI assistant) ──

('admin-console-overview', 'The platform admin console', 'Platform Admin', 90,
'## The admin console

**Platform → Admin Console** is the RxShift-staff view across all pharmacies. From here you can see every tenant, switch into one to help, and manage platform-wide controls. It is visible only to platform admins — never to pharmacy users.', true, true),

('admin-leads-crm', 'Using the Leads CRM', 'Platform Admin', 91,
'## Leads

**Platform → Leads** is the internal sales CRM. Website demo requests land here automatically, tagged with the page they came from. Move a lead through stages (Lead → Demo → Trial → Active → Churned) and add notes. It is platform-admin only and completely separate from any pharmacy''s data.', true, true),

('admin-impersonation-and-safety', 'Switching into a tenant safely', 'Platform Admin', 92,
'## Switching into a tenant

A platform admin can switch into a pharmacy to see exactly what they see and help directly. A banner always shows while you are viewing or emulating someone, so you never forget you are acting inside their workspace, and everything you do is logged. Switch back from the same banner.', true, true),

('admin-email-and-go-live', 'Email safety across tenants', 'Platform Admin', 93,
'## Email safety across tenants

Every pharmacy starts in trial and sends no staff email until an owner goes live. Demo pharmacies never email real people — their mail is redirected or suppressed. Platform admins can see each tenant''s status and allowlist. When helping a pharmacy go live, confirm their roster emails are correct first.', true, true)

on conflict (slug) do nothing;

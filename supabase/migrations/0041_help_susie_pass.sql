-- 0041: help content for the July 1 "Susie's pass" features — call-outs are now
-- real + reversible, managers can set anyone's live status, the tenant-wide time
-- format, unpublish, and multi-day PTO entry. Updates existing articles in place.

update help_article set updated_at = now(), body_markdown = $md$# Logging callouts

When someone can't make a scheduled shift, log a callout: Requests → Log callout. Staff can log their own; **managers can log one on someone's behalf** — useful when a person is too sick to do it from their phone.

Logging a callout is not just a note. For that day it **removes the person from the live ratio board and the Compliance Record**, so any resulting gap shows up right away, and their shift is flagged **"Called out"** on Build Schedule so you know to backfill. Before you log it, the callout preview shows the ratio impact.

If the person ends up coming in after all, **reverse the callout**: on Requests → Callouts, a manager *or the person themselves* can click **"Reverse — I'm back."** That restores them to the schedule and the ratio count immediately.

RxShift does not auto-find coverage — the manager decides how to fill a gap. The callout record and any deficient hours are documented automatically in the Compliance Record.$md$
where slug = 'callouts';

update help_article set updated_at = now(), body_markdown = $md$## The live board

**Live Board** shows, right now, who is working at each location and whether you are within your pharmacist-to-technician ratio. It refreshes on its own about once a minute. A location turns red the moment counting technicians exceed what the on-duty pharmacists allow.

## Statuses

Each person has a current status — by default **Working** (counts toward ratio), plus **Lunch**, **Meeting**, **Off floor**, and **Non-tech**. Tapping a status on the board, or on **My Schedule**, updates the ratio instantly: someone at lunch stops counting.

**Managers can change anyone's status from the board's Status board** — handy when a person steps away and forgets to update it themselves. Staff can set their own.

## Customizing statuses

Managers can tailor statuses in **Settings → Statuses** — hide ones you do not use, rename them to match how your pharmacy talks, and choose whether each one counts toward the ratio. **Working** is always shown and always counts.$md$
where slug = 'live-board-statuses';

update help_article set updated_at = now(), body_markdown = $md$# Settings

Settings is organized by what it controls (Owner/Admin only):

- **Organization** — name, timezone, schedule cycle (weekly, biweekly, monthly), ratio slot length, **time format (12-hour AM/PM or 24-hour / military — applies across the whole app)**, branding.
- **Locations** — addresses and per-day operating hours. Each location can hold departments, and carries its own type (retail / telepharmacy / institutional), drive-through flag, and expected Rx volumes.
- **Ratio** — your state rule (max technicians per pharmacist, trainee sublimits). The Nevada R072-25 toggle lives in Organization.
- **Work types** — the activity list that drives ratio counting. Each type counts as pharmacist, technician, or none, with a counting default the scheduler can override per shift segment.
- **Constraint rules** — per-person or per-role rules: hour caps, overtime thresholds, availability windows, hard stops, recurring unavailability, always-off days. All advisory; all carry effective dates.
- **Team & roles** — who can sign in and what they can do: Owner/Admin, Scheduler (optionally scoped to departments), Approver/Supervisor, Read-only, Staff. PTO approver pool lives here too.
- **Import staff** — CSV import with column mapping.

Changing a rule re-checks every published schedule and flags any new conflicts — compliance monitoring is continuous, not just at build time.$md$
where slug = 'settings';

update help_article set updated_at = now(), body_markdown = $md$## Copy the previous period

On an **empty** period, a "Copy previous period" button copies every shift (including breaks) from the most recent earlier period at the same location. Build one good week, then copy it forward and adjust.

## Copy one shift through a date

From the shift editor you can repeat a shift on the following days **through a date you pick** — one move instead of re-entering it each day. Days the person already works or has off are skipped.

## Marking time off — a single day or a whole block

On the shift editor, tick **PTO / time off** to mark someone off. Leave the "through" date on that day for a single day, or pick a later date to black out a **continuous block in one step** — a week's vacation no longer means entering seven days one at a time. Any shifts in the range are removed. PTO is a person-level record: it shows blacked out on the schedule and isn't tied to a published period.

## Unpublishing a schedule

Published a week by mistake? On **Build Schedule**, when a window is published an **Unpublish** button appears next to Publish. It returns the window to draft so staff stop seeing it immediately — the shifts are kept, so you can edit and re-publish.

## Plain-English commands

The command bar at the top of the Schedule page understands instructions like:

- "Marcus works 8 to 5 Monday through Friday for the next three weeks"
- "Give Maria Fridays off this month"
- "Who is short on Thursday?"

It proposes the change, the compliance engine validates it (you'll see exactly how many deficient slots it adds or removes), and **nothing happens until you confirm**. Days where the person already works or has approved time off are skipped automatically.$md$
where slug = 'fast-scheduling';

-- Help refresh: articles for everything built since the original nine
-- (breaks, offboarding, trial/go-live, sign-in, live board, fast
-- scheduling, reports) + updates to two existing articles. The AI help
-- assistant reads all published articles automatically.

insert into help_article (slug, title, category, sort_order, body_markdown, published) values
('unpaid-breaks', 'Unpaid breaks and paid hours', 'Scheduling', 25,
'## How breaks work

Shifts are scheduled as wall-clock spans that usually INCLUDE an unpaid lunch — an 8:00–4:30 shift with a 30-minute lunch is 8 paid hours, not 8.5.

- Every shift has an **Unpaid break (min)** field in the shift editor. New shifts of 6+ hours pre-fill your pharmacy''s default (Settings → Organization).
- Paid-hours math (40-hour overtime flags, hour caps) subtracts the break automatically.
- **Ratio coverage does NOT subtract the break** — the person is still on site. Lunches show on the Live Board when someone taps Lunch.

If your weekly-hours flags look too high, check that shifts carry the right break minutes.', true),

('offboarding', 'When someone leaves the pharmacy', 'Workspace', 45,
'## Offboarding

Open **Staff**, edit the person, and use **Offboard…** (Owner/Admin only).

- They disappear from scheduling, the Live Board, and sign-in — immediately.
- Every past schedule, log, and compliance record **keeps their name**. History is never rewritten.
- It''s reversible: re-check Active on their record to bring them back (sign-in is restored too).

Use the Active checkbox alone for temporary leave; use Offboard when someone is gone for good.', true),

('trial-and-go-live', 'Trial mode and going live', 'Basics', 15,
'## Trial mode

New pharmacies start in **trial**: everything works — schedules, requests, the compliance record — but RxShift sends **no email to your staff**. Load your roster, build schedules, and check everything with zero risk of stray notifications.

## Going live

When the roster''s emails are verified and you''re ready, an Owner/Admin opens **Settings → Organization** and clicks **Go live**. From that moment, staff receive email for time-off decisions, swap requests, and callout alerts. A banner shows whenever you''re still in trial.', true),

('signing-in', 'Signing in — and using more than one email', 'Basics', 12,
'## How sign-in works

RxShift has no passwords. Enter your email on the sign-in page and click the link we send — then press the **Sign in to RxShift** button on the page that opens (that extra press protects the link from corporate email scanners).

## More than one email

Some people can only open their work inbox at work and their personal inbox at home. An account can have **multiple sign-in addresses** — type whichever email you can open right now, and the link arrives there, signing you into the same account. Ask your administrator to set up an additional address.

## First sign-in

If your login email is on your pharmacy''s staff roster, your account is created and attached automatically the first time you sign in.', true),

('live-board', 'The live ratio board', 'Compliance', 32,
'## What it shows

The **Live Board** (ratio pharmacies only) shows right now, this minute: pharmacists counting, technicians counting, the limit your rule allows, and a Compliant/Deficient badge per zone.

## Statuses

A person scheduled now counts toward ratio unless their live status says otherwise — Lunch, Meeting, Off floor, and Non-tech work all stop counting while active.

- Staff set their own status with one tap on **My Schedule**.
- Managers can set anyone''s status from the board itself.

The board refreshes every minute and the ratio recalculates instantly when a status changes.', true),

('fast-scheduling', 'Faster scheduling: copy forward and plain English', 'Scheduling', 22,
'## Copy the previous period

On an **empty** period, a "Copy previous period" button copies every shift (including breaks) from the most recent earlier period at the same location. Build one good week, then copy it forward and adjust.

## Plain-English commands

The command bar at the top of the Schedule page understands instructions like:

- "Marcus works 8 to 5 Monday through Friday for the next three weeks"
- "Give Maria Fridays off this month"
- "Who is short on Thursday?"

It proposes the change, the compliance engine validates it (you''ll see exactly how many deficient slots it adds or removes), and **nothing happens until you confirm**. Days where the person already works or has approved time off are skipped automatically.', true),

('running-reports', 'Running reports', 'Compliance', 35,
'## Reports

**Compliance → Reports** exports your structured data as Excel files:

- **Compliance log** — the board-ready hourly record for any date range and location: pharmacists, technicians (CPhT flagged), required ratio, status, and deficiency notes.
- **Staff roster** — everyone with role, certification, employment, location, and status.
- **Schedule export** — any period as a who-works-when spreadsheet with times and breaks.
- **Audit report** (Owner/Admin) — the append-only activity trail: who did what, when.

Pick the filters, click Download, open in Excel. The compliance record can also be printed or exported as CSV from its own page.', true)
on conflict (slug) do nothing;

-- Updates to existing articles
update help_article set body_markdown = body_markdown ||
'

## Breaks, copy forward, and plain English

Every shift carries an **unpaid break** (subtracted from paid hours, not from ratio coverage). To build faster: copy the previous period onto an empty one, or type instructions like "Marcus works 8 to 5 Monday through Friday" into the command bar — proposals are engine-validated and applied only when you confirm. See "Faster scheduling" and "Unpaid breaks" for details.'
where slug = 'building-a-schedule';

update help_article set body_markdown = body_markdown ||
'

## Certification and offboarding

Mark CPhT-certified technicians with the **Certified** checkbox — certification shows on rosters and compliance exports. When someone leaves for good, use **Offboard…** on their record: scheduling and sign-in stop, history is preserved. See "When someone leaves the pharmacy."'
where slug = 'managing-staff';

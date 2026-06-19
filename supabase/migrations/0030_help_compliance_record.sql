-- Help content for the Compliance Record (as-worked) vs the Coverage Forecast.
--
-- The product now distinguishes three artifacts; the help corpus must teach the
-- vocabulary consistently. Adds one explainer article and surgically updates the
-- two existing articles that conflated "publish the schedule" with "the record".

insert into help_article (slug, title, category, sort_order, body_markdown, published, admin_only) values
('compliance-record-vs-forecast', 'Compliance Record vs Coverage Forecast', 'Compliance', 1,
'# The Compliance Record vs the Coverage Forecast

RxShift keeps these distinct on purpose — they answer different questions.

## Compliance Record (what actually happened)

The **Compliance Record** (Compliance → Compliance Record) is the immutable,
hour-by-hour record of what **actually** happened at each location: who was on
and counting, and whether your pharmacist-to-technician ratio was met. RxShift
finalizes each hour after it passes — reconstructed from the published schedule
adjusted by your team''s live statuses — and then **freezes** it. This is the
board-defensible artifact, retained for two years.

- It is **never edited.** To explain an hour (for example, a documented coverage
  gap), a manager **adds a note** — the determination stands, the note adds
  context. Notes are attributed and time-stamped.
- Save it as a PDF (official record) or export the data as CSV.

## Coverage Forecast (what you are scheduled to do)

The **Coverage Forecast** (Compliance → Coverage Forecast) projects the same
hour-by-hour ratio from your **published schedule** — "are we scheduled to be in
ratio?" Use it while planning. It is a forecast, not the audit: it shows the
plan, not what actually happened on the floor.

## Activity Log and Override Log

The **Activity Log** is the append-only history of every change (schedule edits,
approvals, role changes, live-status changes) — who did what, when. The
**Override Log** records the reason whenever a manager publishes past a
compliance flag.',
true, false)
on conflict (slug) do nothing;

-- Building a schedule: publishing creates the forecast; the record fills hourly.
update help_article set
  body_markdown = replace(
    body_markdown,
    'Publishing makes the schedule visible to staff and generates the compliance record. Edits after publishing re-check compliance.',
    'Publishing makes the schedule visible to staff and drives the Coverage Forecast immediately; the immutable Compliance Record then fills hour by hour as the day passes. Edits after publishing re-check the forecast.'
  ),
  updated_at = now()
where slug = 'building-a-schedule';

-- Reports: name the artifact correctly (the actual record vs the forecast).
update help_article set
  body_markdown = replace(
    body_markdown,
    '**Compliance log** — the board-ready hourly record for any date range and location',
    '**Compliance Record** — the immutable, board-ready record of what actually happened, hour by hour, for any date range and location'
  ),
  updated_at = now()
where slug = 'running-reports';

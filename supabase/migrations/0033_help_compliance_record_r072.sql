-- Refresh the legacy "compliance-record" help article. It predated the
-- as-worked Compliance Record rebuild and the R072-25 work, so it still said
-- "ratio zone" (zones were removed in 0018) and described a board-report flag
-- "matching proposed R113-24" (R113-24 was superseded by R072-25, and RxShift
-- never contacts a board). Rewritten to the current, accurate framing:
-- per-location, as-worked, ceiling vs floor, sustained-deficiency heads-up.

update help_article set
  body_markdown =
'# The Compliance Record

The Compliance Record is the immutable, hour-by-hour record of what **actually happened** at each location — reconstructed from the published schedule and your team''s live statuses as each hour passes, then frozen. It is your inspection-ready artifact, retained for two years.

For each hour it lists:

- The pharmacist(s) on duty, by name
- Each technician counting toward ratio, by name
- Each technician **present but not counting**, annotated with their assigned non-technician function (cleaning, procurement, clerical) — this documented exception is your audit defense
- Compliant or deficient status, with the reason — and, when deficient, whether the hour was over the ceiling (too many technicians for the pharmacists on duty) or under the floor (a solo pharmacist without enough support staff)

The record tracks **consecutive deficient days** and flags a sustained deficiency after several in a row — a heads-up to your own managers. RxShift never contacts a board; whether to act on it is your pharmacy''s decision.

The record is **never edited.** To explain an hour (for example, a documented coverage gap), a manager **adds a note** — the determination stands, the note adds context. Records are retained for two years and exportable to spreadsheet or saved as a print-ready PDF. Any acknowledged warning (an override) is cross-referenced in the Override Log with who, when, and the required reason.

Looking ahead instead of back? The **Coverage Forecast** projects the same hour-by-hour ratio from your published schedule — the plan, not what happened on the floor.',
  updated_at = now()
where slug = 'compliance-record';

-- Drift cleanup (unrelated to R072-25, but these are user-facing and the demo
-- help center is being validated): "ratio zone" was removed in 0018 — ratio is
-- now computed per LOCATION. Bring three legacy help articles in line.
update help_article set
  body_markdown = replace(
    replace(
      body_markdown,
      'who is working in each ratio zone',
      'who is working at each location'
    ),
    'A zone turns red the moment counting technicians exceed what the on-duty pharmacists allow.',
    'A location turns red the moment counting technicians exceed what the on-duty pharmacists allow.'
  ),
  updated_at = now()
where slug = 'live-board-statuses';

update help_article set
  body_markdown = replace(
    body_markdown,
    '**Zones.** A ratio zone is an independent compliance boundary. Most pharmacies have one zone per location. If you have an isolated room — a sterile compounding room with its own staff, for example — make it its own zone so its counts don''t mix with the main floor.',
    '**Per location.** Ratio is computed per location: everyone counting at a location counts toward one ratio. If a site needs two independent ratio pools — an isolated sterile compounding room with its own staff, for example — set it up as its own location so the counts don''t mix.'
  ),
  updated_at = now()
where slug = 'ratio-setup';

update help_article set
  body_markdown = replace(
    replace(
      body_markdown,
      'Each location can hold departments and ratio zones.',
      'Each location can hold departments, and carries its own type (retail / telepharmacy / institutional), drive-through flag, and expected Rx volumes.'
    ),
    '**Ratio** — your state rule (max technicians per pharmacist, trainee sublimits) and zones, including isolated rooms.',
    '**Ratio** — your state rule (max technicians per pharmacist, trainee sublimits). The Nevada R072-25 toggle lives in Organization.'
  ),
  updated_at = now()
where slug = 'settings';

update help_article set
  body_markdown = replace(
    body_markdown,
    'a Compliant/Deficient badge per zone.',
    'a Compliant/Deficient badge per location.'
  ),
  updated_at = now()
where slug = 'live-board';

update help_article set
  body_markdown = replace(
    replace(
      body_markdown,
      'The live board shows a red zone the instant you are out of ratio.',
      'The live board turns a location red the instant you are out of ratio.'
    ),
    '- When a zone stays deficient for a few minutes,',
    '- When a location stays deficient for a few minutes,'
  ),
  updated_at = now()
where slug = 'out-of-ratio-alerts';

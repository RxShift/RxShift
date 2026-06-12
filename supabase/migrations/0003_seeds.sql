-- Global seeds: Nevada ratio rule (Appendix E) and the help center corpus.
-- Work-type seeds are per-tenant and created by the onboarding wizard.

-- ─── Nevada ratio seed ──────────────────────────────────────────────────────
-- Current law from verified primary sources (NAC 639.250, NRS 639.1371).
-- R113-24 is proposed, NOT adopted (June 2026) — not enforced here.
insert into ratio_rule
  (tenant_id, state, max_techs_per_pharmacist, trainee_sublimits, composition_rules, source_citation, notes)
values
  (
    null,
    'NV',
    3,
    '{"max_trainees": 2, "alternative": "1 technician plus 2 trainees"}',
    '{"options": [{"technicians": 3, "trainees": 0}, {"technicians": 1, "trainees": 2}]}',
    'NAC 639.250; NRS 639.1371',
    'Non-institutional retail default: one pharmacist may supervise up to three technicians, or one technician plus two trainees. Base statutory default is 1:1 unless expanded by regulation. R113-24 (proposed, not adopted as of June 2026) would add volume-based minimums and hourly documentation; RxShift builds the documentation record regardless but does not enforce non-final rules. Verify exact language before relying on this for a new state.'
  );

-- ─── Help center articles ───────────────────────────────────────────────────

insert into help_article (slug, title, category, sort_order, body_markdown) values

('getting-started', 'Getting started with RxShift', 'Basics', 1,
'# Getting started with RxShift

RxShift is pharmacy scheduling with compliance built in. The first person from your pharmacy to sign in walks through the setup wizard: business name, locations, your ratio requirement (if any), schedule cycle, work types, and your staff list.

After setup, the typical flow is:

1. **Build a schedule** on the Schedule page for the current period.
2. RxShift **flags anything that breaks a rule** — ratio gaps, hour caps, availability conflicts — before you publish.
3. **Publish.** Staff can see their shifts from any phone at the My Schedule page, and the hourly compliance record generates automatically.

Staff sign in with their login email (magic link, no passwords). They can view schedules, request time off, and log callouts. Managers approve requests and adjust the schedule.

If something looks wrong, the Help assistant on this page can answer questions, or use the contact link in Settings.'),

('building-a-schedule', 'Building a schedule', 'Scheduling', 2,
'# Building a schedule

Open **Schedule** and pick the period. RxShift creates periods that match your schedule cycle (weekly, biweekly, or monthly — set in Settings).

**Adding shifts.** Click any empty cell in the grid to add a shift for that person and day. Set the start and end times and the work type. A shift can be split into segments — for example, 8am–12pm on dispensing (counts toward ratio) and 12pm–2pm on inventory (does not count).

**Copy forward.** Use *Copy previous period* to start from last period''s pattern and adjust, instead of building from scratch.

**Flags.** Cells turn red or amber when something breaks a rule: a ratio gap, an hour cap, an availability conflict. Hover or click the flag for a plain-language explanation. Flags are advisory — RxShift never blocks you. If you proceed anyway, you''ll be asked for a reason, which is logged.

**Draft vs published.** Drafts are only visible to managers. Publishing makes the schedule visible to staff and generates the compliance record. Edits after publishing re-check compliance and update the record.'),

('ratio-setup', 'Setting up your ratio rules', 'Compliance', 3,
'# Setting up your ratio rules

If your state regulates how many technicians a pharmacist may supervise, RxShift tracks it for every slot of every shift.

**The rule.** Set your state''s maximum in Settings → Ratio. RxShift seeds known state defaults (you confirm or override them — always verify against your board''s current language).

**Zones.** A ratio zone is an independent compliance boundary. Most pharmacies have one zone per location. If you have an isolated room — a sterile compounding room with its own staff, for example — make it its own zone so its counts don''t mix with the main floor.

**Who counts.** Counting is driven by *work type*, not job title:

- A **pharmacist** present in the building counts by default (your policy may differ — it''s configurable).
- A **technician** counts when assigned to a counting work type (production, dispensing). On inventory, cleaning, or clerical work they do not count, and the compliance record documents that explicitly.
- **Non-counting staff** (cashiers, drivers, clerks) never count.

**Slot length.** Ratio is evaluated per slot — 15, 30, or 60 minutes, chosen in Settings. The compliance record always rolls up to hourly.'),

('pto-requests', 'Requesting and approving time off', 'Requests', 4,
'# Requesting and approving time off

**Requesting (staff).** Go to Requests → New request. Pick the dates, add a note if you like, and submit. You''ll be notified when it''s decided.

**Approving (managers).** Pending requests appear in the Requests queue with anything they''d conflict with. Approve or deny; the staff member is notified by email automatically.

**Approver pool.** Your pharmacy designates a primary PTO approver plus backups, so requests clear even when the primary is out. Any designated approver can act on any request.

**On the schedule.** Approved time off overlays the schedule grid, so you can''t accidentally schedule someone who''s out. If a rule change or new shift conflicts with approved time off, it''s flagged.'),

('callouts', 'Logging callouts', 'Requests', 5,
'# Logging callouts

When someone can''t make a scheduled shift, log a callout: Requests → Log callout (staff can log their own; managers can log for anyone).

The callout notifies the manager and shows the resulting gap — including what it does to your ratio for those hours, so you immediately know whether you''re still compliant or need coverage.

RxShift does not auto-find coverage in v1. The manager decides how to fill the gap; the callout record and any resulting deficient hours are documented automatically in the compliance record.'),

('shift-swaps', 'Shift swaps', 'Requests', 6,
'# Shift swaps

Two staff members can swap shifts with manager approval:

1. **Propose.** A staff member proposes a swap with a colleague from My Schedule.
2. **Peer accepts.** The colleague accepts or declines.
3. **Manager approves.** A manager reviews the swap with its effects shown — ratio impact, hour caps, and any specialized coverage involved (IV room, hospice, home infusion) — and approves or denies.

Both parties are notified at each step. The swap only takes effect when the manager approves, and the schedule and compliance record update automatically.

RxShift shows the manager the effects; matching specialized qualifications remains the manager''s judgment in v1.'),

('managing-staff', 'Managing staff', 'Workspace', 7,
'# Managing staff

The Staff page lists everyone. Each person has:

- **Ratio type** — counts as pharmacist, counts as technician, or never counts. This is what the compliance engine reasons about.
- **Job title** — a free-text label. Titles don''t affect counting; ratio type and work type do.
- **Login email and work email** — separate fields. The login email is how they sign in; the work email is where notifications go.
- **Employment type** — full-time, part-time, per-diem, or 1099 contractor. Hour-cap rules (like a per-diem annual cap) key off this.
- **Home location** — plus any other locations they float to.

**Importing.** Settings → Import staff accepts a CSV file. Map your columns to RxShift fields once and import the roster in one step.

**Deactivating.** Deactivated staff keep their history but can''t be scheduled and can''t sign in.'),

('compliance-record', 'The compliance record', 'Compliance', 8,
'# The compliance record

Every published schedule automatically generates an hourly staffing record per ratio zone. For each hour it lists:

- The pharmacist(s) on duty, by name
- Each technician counting toward ratio, by name
- Each technician **present but not counting**, annotated with their assigned non-technician function (cleaning, procurement, clerical) — this documented exception is your audit defense
- Compliant or deficient status, with the reason when deficient

The record tracks **consecutive deficient days** and surfaces a board-report flag after three — matching the structure of Nevada''s proposed R113-24, and useful defensibility everywhere.

Records are retained for two years and exportable to spreadsheet or a print-ready report. Any acknowledged warning (an override) is cross-referenced in the Override Log with who, when, and the required reason.

Edits to a published schedule regenerate the affected record; the publish-time snapshot is retained.'),

('settings', 'Settings', 'Workspace', 9,
'# Settings

Settings is organized by what it controls (Owner/Admin only):

- **Organization** — name, timezone, schedule cycle (weekly, biweekly, monthly), ratio slot length, branding.
- **Locations** — addresses and per-day operating hours. Each location can hold departments and ratio zones.
- **Ratio** — your state rule (max technicians per pharmacist, trainee sublimits) and zones, including isolated rooms.
- **Work types** — the activity list that drives ratio counting. Each type counts as pharmacist, technician, or none, with a counting default the scheduler can override per shift segment.
- **Constraint rules** — per-person or per-role rules: hour caps, overtime thresholds, availability windows, hard stops, recurring unavailability, always-off days. All advisory; all carry effective dates.
- **Team & roles** — who can sign in and what they can do: Owner/Admin, Scheduler (optionally scoped to departments), Approver/Supervisor, Read-only, Staff. PTO approver pool lives here too.
- **Import staff** — CSV import with column mapping.

Changing a rule re-checks every published schedule and flags any new conflicts — compliance monitoring is continuous, not just at build time.');

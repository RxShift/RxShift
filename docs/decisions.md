# RxShift — Decision Log

Durable product/scope decisions. Newest first. Code and CLAUDE.md are the
source of truth for *what exists*; this file records *why*.

## July 1, 2026 — Susie's pass: time format, unpublish, real call-outs

**Context:** Susie reviewed the app and flagged four items. Decisions made during the build:

**Decision — military time is a tenant-wide setting, default 12-hour.** One `tenant.time_format` applies to
every surface (the shared wall board would be ambiguous with a per-user preference). Default `'12h'` (US retail
norm) also unifies a pre-existing inconsistency: the main schedule grid rendered 24h while rules + My Schedule
rendered 12h. Military is now the opt-in. All time-of-day rendering goes through one `lib/time-format.ts` so it
can't drift again. Audit/compliance *timestamps* were also moved off the browser locale onto the tenant timezone
+ chosen hour format (they read the same for every viewer now). The CSV export keeps 24h `HH:00` hour labels — a
data-file convention, not a UI element.

**Decision — unpublish keeps the publish-time compliance snapshot.** Unpublishing returns a period + its shifts
to draft (staff visibility is gated on `shift.status`, so it hides instantly). It does NOT delete the
`compliance_snapshot` written at publish — that's an append-only audit artifact; hiding a schedule shouldn't
erase that it was briefly published. RBAC mirrors publish (managers only). No migration — the enum + columns
already existed.

**Decision — call-outs are "real" (an absence overlay), reversible, and settle on the daily cron.** A call-out
now removes the person from the live ratio board and the as-worked Compliance Record for `callout_date` (before,
it was a logged note that left them counting — masking the gap the product exists to surface). The shift is kept
(flagged "Called out") so a manager can backfill and so a reverse restores coverage — we did NOT delete the shift
like PTO does. A manager OR the person can reverse ("I'm back"). Because the finalize cron runs daily (after the
day is over), a same-day call-out that's reversed is no longer active at finalize time, so a mistake never writes
a false deficiency; on a future hourly cadence (Vercel Pro) an already-finalized hour would stand, consistent
with the record's immutability. v1 treats a call-out as a whole-day absence anchored on `callout_date` (the live
board matches by date; the schedule marker matches by the logged shift id) — partial-day precision is a
follow-up if needed.

**Decision — manager status changes stay on the Live Board only.** The capability already existed
(`setLiveStatus(staffId,…)` + the manager-gated Status board). We surfaced/verified it rather than adding a
second entry point on My Schedule, to avoid two ways to do the same thing.

## June 23, 2026 — Staff scheduling logic: advisory rules, week-start, coverage-as-text

**Context:** Susie/Lucy working session produced Lucy's scheduling-logic doc. Three scope choices Jamison
made during the build (the interview answers).

**Decision — rules are advisory + propose-and-accept, never auto-scheduling.** Scheduling rules expand into
candidate shifts the scheduler must Accept (reusing Ask AI's propose → engine-validate → confirm pattern).
We deliberately did NOT auto-populate the schedule: pharmacy scheduling has too much human judgment
(coverage, fairness, last-minute changes) to trust a rule engine to commit shifts. The resolver is
deterministic (no LLM) so proposals are predictable. Unmet rules that can't become one unambiguous shift
(monthly quota, quarterly project days, day-specific reminders, "don't assign" violations) surface as
dismissible warnings; a dismiss is logged to `override_log` (`warning_type='rule'`).

**Decision — `excluded_from_ratio` is orthogonal to `ratio_type='non_counting'`.** `non_counting` strips a
person's RPh/tech role and drops them to the "Other staff" band. The flag instead keeps a supervisor *as a
pharmacist/technician* (right band, schedulable) while the engine skips them entirely — including the
R072-25 solo-pharmacist floor count (the spec's "any ratio slot"). Both mechanisms coexist; the work-type
counting default handles activity-based exclusion (Inventory, Meeting).

**Decision — coverage targets are free-text only (this build).** Lucy's per-day coverage demands ("1 CCC RPh
every weekday", "2.6 homeside daily") are a different shape from per-staff rules. Captured as
`location.coverage_notes` (shown in the builder, never enforced). A structured coverage-demand model +
detection is a deliberate fast-follow once she's using the per-staff rules.

**Decision — `week_start_day` defaults to Monday (1), changeable but discouraged mid-stream.** The app was
hardcoded Monday; the pasted spec wrongly assumed Sunday. Default Monday = zero behavior change for anyone
live. Configurable per tenant. **Caveat:** periods are auto-created + cycle-aligned, so changing week-start
after periods exist only affects periods built from then on — old periods keep their Monday boundaries and a
back-navigation could create an overlapping period. Best set once at onboarding.

## June 23, 2026 — Subprocessors locked; AI provider interim decision; legal doc status

**Context:** Pre-commercial subprocessor audit ahead of first enterprise customer (Optum/Susie demo active).
Three decisions locked here; one deferred action per decision.

**Decision 1 — AI provider: OpenAI gpt-4o-mini, interim only**

Current state: `lib/ai.ts` uses OpenAI gpt-4o-mini, server-side only (staff names + schedule context sent for
processing; never for advertising; model training prohibited by OpenAI's API terms of service). **No formal DPA
is in place** and no zero-retention add-on has been negotiated — OpenAI's standard API terms are what we rely on.

This is acceptable for the demo phase. It is NOT acceptable before a first enterprise customer hands us real
staff data.

**Intended direction:** Migrate `lib/ai.ts` to **AWS Bedrock running Claude** before first enterprise customer.
AWS Bedrock is HIPAA-eligible, FedRAMP High authorized, and already in most enterprise approved-vendor lists.
Model invocations stay within your AWS account; data is never used for model training and never leaves the
account. Subprocessor list simplifies to: AWS (AI inference + hosting infrastructure). OpenAI removed entirely.

The code change is ~one session once AWS credentials are in hand. No AWS account is provisioned yet — that is
the blocking action.

**Blocker (Jamison):** Provision AWS account + enable Bedrock access; hand credentials to Claude Code for a
one-session migration of `lib/ai.ts`.

---

**Decision 2 — Supabase DPA: execute formally, not by implication**

Supabase holds ALL app data (tenants, staff, rosters, schedules, compliance records) — it is the
highest-risk subprocessor. A DPA is available from Supabase; clicking through terms acceptance is NOT
sufficient for enterprise disclosures.

**Blocker (Jamison):** Log in to supabase.com under supabase@rxshift.io → Settings → Legal → Data
Processing Agreement → sign it. Log the date here once done.

---

**Decision 3 — Legal docs: not finalized; no customer should see them as final**

`/terms` and `/privacy` were attorney-reviewed (Phil, June 12, 2026) and "Draft" banners removed. But
two items remain unresolved:

1. Terms §14 contains a placeholder: *"[Governing law and venue to be confirmed by counsel.]"* — governing
   law, jurisdiction, and venue are not set.
2. The privacy policy subprocessor table reflects the current stack accurately AS OF June 23, 2026 (with
   the OpenAI interim decision above acknowledged).

**Blocker (Jamison):** Send Terms §14 to Phil for the governing-law / venue clause. The docs should not be
presented to any customer as final until that placeholder is replaced.

---

## June 22, 2026 — Cadence: Model B (locked build cadence), NOT per-day publish

**Decision (Jamison signed off):** keep ONE build cadence per tenant (`tenant.schedule_cycle`).
You build and publish in that cadence; the period stays the unit of publish/override/compliance
snapshot. Viewing in any span (week / 2-week / month) stays available, and quick click-to-edit of a
single cell works in any view (it resolves/creates its own covering period — no straddle). We did **not**
adopt Model A (free building in any cadence with per-day publish tracking).

**Why Model B over Model A:**
- The app *already* decouples viewing from cadence (the week/2-week/month selector is a date-range view,
  not a publish unit), so Model A's main benefit was largely already available for *reading*.
- Keeping the period as the publish unit preserves publish/override-log/compliance-snapshot integrity —
  RxShift's core value. Per-day publish would fragment that audit trail for little gain.
- Lowest risk before the Brandy demo: no heavy schema change, no rework of the publish/validation core.

**The honesty fix (the real work):** the "partly published, shown as fully published" dishonesty was a
*display* gap, not a data-model gap. The grid already supported a per-day status (`DateStatus`) but the
matrix never computed/passed it. We now compute a per-day `dateStatus` (worst-wins across location-periods
for All Locations) and (a) tint/label each column truthfully, and (b) show an honest status pill
("N/M days published") instead of collapsing the window into one "Published ✓".

**Also fixed (Model B prerequisite):** clicking a cell in a not-yet-built future week used to hard-error
("create the period first"). It now opens the editor and `upsertShift` auto-creates the covering period on
save (periods are invisible plumbing). No-period cells are clickable; the header still honestly reads
"No period" until built.

**Open / deferred:** Model A remains possible later (it'd need per-day publish state) if a customer truly
needs to mix cadences. Not planned.

## June 19, 2026 — R072-25 supersedes R113-24; toggle-gated, floor enforced, volume NOT

**Finding:** the Nevada rule we'd been referencing changed. The current proposal is **R072-25** (LCB File No.
R072-25; public hearing June 4, 2026; **not adopted**), which supersedes R113-24. We read the regulation
(`docs/PublicHearingNotice.R072-25.pdf`), not a summary.

**Decisions:**
- **Gate it.** R072-25 is *proposed*, so all of it sits behind `tenant.nevada_r072_25` (default off). Current
  law (NAC 639.250) is always enforced; the toggle previews the proposed rules and flips on automatically once
  adopted. Applied per location via `location.location_type` (retail only).
- **Enforce the ceiling and the floor; do NOT enforce volume.** The 4-tech retail ceiling (or 2 techs + 2
  trainees) and the new solo-pharmacist *floor* (≥1 support, ≥2 with a drive-through) are real engine checks
  with a `flag_type` (`ceiling`/`floor`/`both`). The Sec 2.2 volume thresholds are **collect-only** — we store
  expected Rx per location/day and show it on the schedule, but never compute a violation. Enforcing
  unadopted, contradictory volume math would be wrong and over-claiming.
- **One mapper, no drift.** `buildEngineRule` (`lib/engine/rule.ts`) is the single place the state/location
  overlays live, shared by the server path and the tsx-safe finalizer. Default (off/retail/non-TN) is
  byte-identical to the prior rule, so existing tests stand.
- **Tennessee now.** Verified TN 1140-02-.02: 6 non-certified per pharmacist, certified (CPhT) uncapped.
  Implemented via `staff.certified` + `certified_uncapped` on the engine rule. **Rejected:** waiting (the rule
  is unambiguous, unlike the earlier contradictory research that blocked it).
- **Reframe the streak, drop "board."** R072-25 has no 3-day board-notification trigger (that was R113-24).
  The consecutive-deficient-day signal is now a generic, parameterized **sustained-deficiency** heads-up to
  the pharmacy's own managers. RxShift never contacts a board.
- **Marketing leads with current law.** `/nevada` leads with NAC 639.250 (enforced today); R072-25 is forward
  context only. No hourly-documentation mandate claim, no volume-enforcement claim, no scripts/hr. **Ships on
  push but flagged for Susie/attorney review** — only NAC 639.250 / CA BPC 4115 / TN 1140-02-.02 are claimed
  as current law.

## June 18, 2026 — Compliance Record (as-worked) BUILT + naming locked

Implements the decision below (the sequencing changed: Jamison chose to build now, including public copy,
rather than wait on regulatory validation). **Canonical names, used everywhere:** *Schedule* (plan),
*Coverage Forecast* (schedule-derived projection, planning aid), *Compliance Record* (immutable, hour-by-hour,
what-actually-happened audit; 2-year; annotatable), *Activity Log*, *Override Log*. The old `/app/log`
(as-scheduled) moved to `/app/coverage-forecast`; `/app/log` is now the Compliance Record.

**Architecture chosen:** reuse the existing schedule-agnostic engine (`evaluateZone`) — feed it *actual*
presence reconstructed from the published shift split by each person's `live_status` history — and persist
immutable hourly rows (`compliance_record`, migration 0029) via an idempotent finalizer
(`lib/compliance-record.ts`) run by a daily cron (hourly on Pro). Immutable = service-role writes only, no
user insert/update/delete policy; corrections are **append-only annotations** (`compliance_record_note`),
never edits — the same model as the audit log. **Rejected:** explicit clock-in/out for v1 (inferring presence
from schedule + live status is the lighter path; annotations + a future clock-in feature cover the gap);
hourly cron now (Hobby caps at daily; retrospective record makes daily defensible). **v1 limitations
(documented):** inferred (not punched) presence; 30-min slot granularity on sub-slot status changes; overnight
live-overlay. **Regulatory:** 2-year retention is grounded in NAC 639.744 (current law); the exact
required fields/retention should still be confirmed by Susie/counsel, and Terms/Privacy copy warrants
attorney review before the push publishes. (Superseded note: this entry originally cited proposed R113-24 —
see the June 19, 2026 decision; R072-25 is now the live proposal and it has no hourly-documentation mandate.)

## June 18, 2026 — Compliance must become "as-worked"; today it's "as-scheduled" (design only, build deferred)

Surfaced in the demo debrief with Susie (pharmacist co-founder). **Finding:** the compliance record at
`/app/log` is **schedule-derived** — regenerated on read from the *published* shifts, with a publish-time
`compliance_snapshot`; live status feeds only the board + alert cron, never the hourly record. That proves
*intent*, not *adherence* — not a defensible audit (a pharmacy could schedule compliant, send the pharmacist
home, and the record stays green). **Decision:** the defensible artifact is an **as-worked** record (actual
hour-by-hour staffing), and we will build it — but **not in this pass**. Sequencing (Jamison's call): ship the
six demo fixes now; write a design doc (`docs/specs/as-worked-compliance.md`) and validate the **regulatory
shape (required fields + retention)** with Susie / the Nevada Board **before** building. **Rejected** bolting a
half-version onto the demo-fix pass. **Honesty:** the DEMO-GUIDE + the demo script must stop implying the
publish-time record is the audit ("the second you publish, the compliance record exists" is retired); frame
`/app/log` as an as-scheduled forecast + documented exceptions, with as-worked on the roadmap. Confidence note:
the *direction* is certain; the *exact NV/CA recordkeeping form + retention* is medium-confidence and must be
confirmed by a pharmacist/the Board, not assumed.

## June 18, 2026 — Demo-fix pass: emulation name, empty-week Publish, Ask AI on empty weeks + edit_shift, step-away gating, seeded emails

Six fixes from the same debrief. **Emulation name:** `getSession`'s emulate path fell back to "unlinked user"
for an owner with no staff record; now falls back to `app_user.display_name` (Frank shows correctly). **Empty
week:** the Publish button read "Published ✓" when nothing was scheduled (it treated "no drafts" as
"published"); now neutral/disabled "Publish" unless a published period actually exists. **Ask AI on empty
weeks:** the bar was gated on an existing period and the action hard-required one; now it mounts whenever a
working location exists, simulates against an in-memory window bundle, and **creates the real period only at
apply** (`ensurePeriodForDate`) — chosen over auto-creating empty periods on navigation/questions (which would
litter drafts). **Ask AI accuracy:** added an `edit_shift` op (extend/shorten/move) and, critically, put the
**staff name + weekday on each shift row in the LLM prompt** — gpt-4o-mini was mis-mapping staff UUIDs across
two lists, which is why "extend Dr. Patel's Thursday shift" hallucinated wrong times; proposals now show a
**deterministic before→after line computed from the data** (not LLM prose) and require an ack checkbox if the
edit *adds* a deficiency. **Step-away:** the "can I step away?" line showed even after a pharmacist went
non-counting; now gated on the current status counting. **Seeded emails:** the email log was empty of current
mail; seeded 3 branded, current-week emails (schedule published, deficiency alert, PTO approved) — required
extracting the pure template into `lib/email-template.ts` so the tsx seed needn't import the `server-only`
`lib/email.ts`.

## June 17, 2026 — "Ask AI" restored, bound to the working-location week

Phase 7 (reverses the June 15 "deferred" note). The command bar is mounted on the schedule again, bound to
the period covering the current week for the **working location** (the selected pill, or the first),
resolved from the data the page already loads. **Rejected** a full all-locations/window refactor of the AI
engine (the period-scoped simulation + create-clamp is tested and correct; a faithful restore beats a risky
rewrite before the demo). Switching the location pill re-scopes the AI; the bar shows which location + week
it's working in. The propose → engine-validate → human-confirm contract is unchanged — AI never decides a ratio.

## June 17, 2026 — After-hours demos use a demo-only clock override (time-of-day, real date)

Phase 6. The demo broke after business hours because every presence surface reads the real wall clock, so at
9pm no shift covers "now" and the board / My Schedule go empty. Chosen fix: a per-tenant **`demo_clock`**
("HH:MM") that, on a **demo tenant only**, pins the *time of day* while keeping the *real date* — so today's
shifts still show, anchored to a business hour. Threaded as an optional arg to `nowInTimeZone`. **Rejected**
seeding 24/7 coverage (clutters the deficiency story) and a per-tenant "always daytime" hack baked into the
data (this keeps real tenants on the true clock and is one toggle in the admin console). Departments were
also added to Mesa Vista (tenant-level area tags on shifts) so the department filter is demoable; they
organize/filter and do not affect the ratio.

## June 17, 2026 — Work-type counting precedence confirmed; staff change their own work type by splitting at "now"

Phase 5. **Counting precedence** (confirmed + documented, no logic change): non_counting staff → segment
override → work_type.counting_default → role default. Because `adjustSegmentsForLive` only ever forces a
segment OFF, a **non-counting work type wins over a counting status** — the assumption was correct.

**Staff self-change is a live segment split, not a schedule overwrite.** When a tech/RPh changes their work
type from My Schedule, the segment covering the current minute is split at "now": the earlier part keeps the
old type (history preserved), the remainder takes the new one — exactly what a manager would do by hand, and
it makes the live ratio recompute from this moment. **Rejected** modeling it as a separate live overlay
(more moving parts) and overwriting the whole segment (loses history). Writes use the service client (shift
segments are manager-only under RLS) gated by an ownership check. Any tenant work type is self-selectable; a
curated subset was deferred as unnecessary for v1.

## June 17, 2026 — Audit log is append-only with notes; compliance PDF carries override context

Phase 4. Two durable choices:

**Audit entries are immutable; context is added by appending, never editing.** The `activity_log` is the
comprehensive action trail and an entry is never modified or removed (hard rule). Real life still needs
corrections ("the RPh forgot to clock back from lunch"), so an authorized manager **appends a note** in a
separate append-only table (`activity_log_note`, 0025 — select + insert policies only, no update/delete).
The original stands; the note is attributed and timestamped. The Audit Log view (`/app/log/audit`) makes
the distinction explicit: Audit Log = every action; Compliance Record = the auditor's hourly staffing record.

**The official compliance export is a print-to-PDF, not a server-generated file.** The record view already
prints cleanly; we made it an official document (header + an "Acknowledged exceptions" section listing the
period's override reasons) so "Save as PDF" yields a non-editable record that carries the *why* behind any
deficiency. **Rejected** server-side Chromium/Playwright PDF (fragile on Vercel serverless, heavy binary)
and a new PDF library (unneeded) — browser print-to-PDF is reliable and genuinely non-editable. The editable
xlsx/CSV remain as raw-data exports, not the official record.

## June 17, 2026 — Requests show compliance impact before acting; ratio-deficiency approvals require a logged reason

Post-demo hardening (Phase 3). PTO/swap approvals used to execute instantly with no warning; callouts
computed the gap but only after the fact. Now compliance impact is computed on the **real engine**
(simulate the change over the affected window, diff the validation flags) and surfaced *before* the
action: employees see it when submitting PTO / before logging a callout; managers see it before approving.

**Warn, never block — but a ratio deficiency must be justified.** Consistent with the board-containment
policy (RxShift never blocks or contacts a board), approval is always allowed. But when an approval
**creates a ratio deficiency**, the manager must enter a reason, which is written to `override_log`
(same table as publish-time overrides — `target_type` extended to `time_off`/`swap`/`callout` in 0024)
and the activity log, so the compliance record stays complete. Constraint-only impacts (hours/availability)
are shown as a warning but don't gate the approval. Enforcement is server-side (can't be bypassed from the
client). `swap_request.ratio_effect` (long unused) is now populated at peer-accept + decision.

## June 17, 2026 — Website uses only fictional demo data; Mesa Vista staffed up for the headroom story

**No real customer data ever appears on the marketing site.** OptumRx is a real prospect, so its names
(staff, "SMRX — Southwest Medical Pharmacy", any real tenant data) are off-limits for rxshift.io — the
leak risk isn't worth it. All website imagery/GIFs come from the fully fictional **Mesa Vista** demo
(made-up company, made-up @mesavistarx.com people). A real testimonial may come later, with permission.

**Mesa Vista was staffed up to demo ratio headroom.** Its locations were all small enough to sit right
at the ratio limit, so the new "who can step away?" feature could only show the warning, not the
positive "✓ you can step away." Added a third fictional Spring Valley pharmacist (Dr. Lena Park) so the
location carries real headroom — improving both the website visual and the live demo. Henderson's
deficiency story is untouched.

## June 17, 2026 — Mobile = a focused staff experience; pharmacist ratio-headroom indicator

**Mobile is a focused subset, not a full port.** Staff use a phone for **My Schedule** (status,
shifts) and **Requests**; the schedule builder and settings stay desktop-only (a `md:hidden` notice
points to a computer — we deliberately don't invest in making them mobile-friendly). Nav on phones is
a **bottom tab bar** (app-like, matches the add-to-home-screen goal); the desktop sidebar is
`hidden md:flex`. **Rejected** a hamburger drawer (less app-like). Installable via a web manifest
(standalone) + apple-touch-icon — chosen over an article-only approach so the home-screen icon opens
chrome-free. Offline / service worker deferred.

**Pharmacist "can I step away without breaking ratio?"** Pharmacists count toward ratio; a counting
pharmacist leaving can break it (techs never do). The engine already owns the math —
`pharmacistHeadroom` / `wouldBreakIfOneLeaves` (monotonic `maxTechsAllowed`). Surfaced on My Schedule
(the pharmacist's own view — primary), the Live Board, and the wall display. On My Schedule, tapping a
non-counting status that would break ratio **warns with a confirm but never blocks** (board-containment
policy: RxShift never blocks or contacts a board — the call is always the pharmacy's). Shown only for a
counting pharmacist on shift.

## June 17, 2026 — Live Board wall display (kiosk), collapsible sidebar, per-location status list

**Wall display is a dedicated chrome-free route (`/app/display`), not just a fullscreen toggle.**
Susie's pharmacies want the live ratio board on an always-on wall monitor next to their
prescription-queue screen. Chosen: a separate route group `app/app/(kiosk)/` with its own minimal,
auth-gated layout (no sidebar, no banners, **no status controls**) so a monitor's machine just leaves
the URL running. It reuses the same `buildBoardView` (`lib/board-data.ts`) + `LocationCard`
(`components/app/board/location-card.tsx`) as the in-shell board, so the two can never diverge.
`?location=<id>` pins one site per monitor; a native Full-screen button covers the across-the-room
glance. **Rejected** "fullscreen the current window only" (no URL to leave running on a dedicated
screen) — shipped the dedicated page (Jamison's pick).

**v1 limitation — the display requires a signed-in session.** The monitor's browser logs in once.
A no-login **signed display-token URL** (so a truly unattended screen needs no account) is deferred
until a customer asks — it adds a token issue/rotation surface we don't need for the demo.

**Status board groups by location only when multi-location.** A single flat alphabetical list hid
who's working where at a multi-site pharmacy. The change-status grid now groups under a per-location
heading (card order) + an Off-shift group; single-location tenants keep the original flat list (no
empty headers). Presentational only — no data-model change.

**Sidebar collapse hides completely (vs. an icon rail).** Jamison wanted maximum real estate for the
schedule and board. Persisted client-side (localStorage + no-flash script, mirroring dark mode) — no
server state; a left-edge tab reopens it.

## June 16, 2026 — Live presence is schedule-derived (off-shift), not manual

**A person counts toward the live ratio only if a PUBLISHED shift covers right now.** The
live board and "My status now" previously defaulted everyone to "Working" (counting) and
never checked the schedule — so someone not yet on shift showed "Working." Now presence is
derived from the published schedule (tenant tz): on shift → auto "Working" (you can still tap
Lunch/Off-floor); off shift → **"Off shift"**, not counted, no clock-in. Matches how a manager
actually thinks about coverage, and keeps the live ratio honest. Two correctness fixes rode
along: the board now considers **published shifts only** (drafts aren't real coverage), and a
`live_status` is honored only if set **today** (open rows with `effective_to = null` were
letting yesterday's "Lunch" linger). No clock-in model (rejected as too much friction; Jamison
chose schedule-derived auto). Shared logic in `lib/live-board.ts` so the board and the alert
cron stay in lockstep.

**Lead deletion is platform-admin only, append-safe.** `deleteLead` cascades notes but
deliberately **keeps** `email_log` rows (loose `related_id`) — an audit trail shouldn't lose
records because a CRM lead was removed.

**`?screenshot=true` is a client-side, URL-only banner suppressant** for marketing captures —
not persisted, gone on navigation. The platform "viewing as" banner is a safety signal, so
hiding it is deliberately transient and opt-in.

## June 16, 2026 — ASSESSED, deferred to Build 2: proactive compliance notifications + append-only reasons

Jamison wants (1) to **email a pharmacy before a scheduled deficiency happens** (give them time
to fix it; show the auditor we warned them), and (2) let the pharmacy **append a reason** to a
deficiency **without editing the immutable record**. Assessed against the codebase: both reuse
existing infra. (1) = a daily cron scanning published periods in a lookahead window
(`validateRangeBundle`/`buildComplianceRecords` → `sendEmail`, with dedupe state mirroring
`live_ratio_alert_state`) — today only a 3-day streak at publish + a live "now" alert fire, so
*future* scheduled deficiencies go unannounced. (2) = a new append-only `compliance_annotation`
table surfaced on `/app/log`; the `compliance_snapshot` stays immutable, so the auditor sees both
the deficiency and the pharmacy's explanation. Substantial enough to be its own pass — **build on
Jamison's greenlight.** (The full Squeeze/ProductBoard product remains a separate, later,
Jamison-directed effort.)

## June 16, 2026 — Brand email: M365 shared mailbox, and the two-stream model

**Send as `hello@rxshift.io` via a Microsoft 365 *shared mailbox*, not an alias.** An
alias + `SendFromAliasEnabled` was tried first and rejected: Outlook desktop never honors
it, and even in OWA the recipient still sees the user's primary address — so it can't give
RxShift a reliable branded From. A shared mailbox with **Send As** shows `hello@rxshift.io`
to recipients in every client, is free (≤50 GB, no license on the mailbox), and gives the
team shared Sent Items (`MessageCopyForSentAsEnabled $true`). Authenticated with SPF
(`spf.protection.outlook.com`) + M365 DKIM (`d=rxshift.io`) so it isn't junked and Gmail
drops the "via onmicrosoft.com". Full runbook in `INFRASTRUCTURE.md`.

**App email and human email are two separate streams — by design, not by neglect.**
Microsoft **prohibits** BCC-ing or transport-ruling app mail into a shared mailbox for
archiving, so there is no compliant "one inbox holds everything." App/transactional mail
stays on **Resend** (from `hello@`); human/brand mail lives in the **M365 shared mailbox**.
Reporting is therefore two surfaces: a planned in-app `email_log` for Resend sends, and
M365 Message Trace / Content Search for the mailbox. A true single store would require
moving app sending onto M365 Graph as `hello@` — deferred as a real project, not a toggle.

**Demo requests do not "fall out of the CRM."** A submitted demo form creates a permanent
CRM lead AND sends an alert email; the lead is the system of record, the email is a copy.
The only tracking gap is that follow-up email threads aren't auto-linked to the lead —
mitigated by working prospects from the CRM. Linking threads to leads is a later feature.

**Built June 16 (same day):** the in-app `email_log` (the single `sendEmail()` path +
platform-admin report), demo-alert routing to `hello@` (app side), deliverability
detection (Resend webhook), lean feedback, and demo-safe admin chrome. See below.

**System-detected problems file into the feedback inbox (`source='system'`).** Rather
than a separate error channel, a failed send or a bounce becomes a `feedback` row with
`source='system'` and alerts platform admins — one "issues" inbox for both user-reported
and system-detected problems. Jamison's idea; cleaner than parallel systems.

**Feedback is lean and native — a fuller Squeeze/ProductBoard product is deferred to a
Jamison-directed future build.** Jamison is comfortable reusing the Squeeze *concepts*
(he conceived them; IP across his own entities is a non-issue — see root C:\dev\CLAUDE.md);
we are NOT auto-implementing the full product. Per-tenant manager visibility of the email
log is likewise a future build (their audit needs).

**Done June 16:** the shared mailbox now *receives* `hello@` — a Cloudflare custom routing
rule forwards `hello@rxshift.io` → the mailbox's `…@jamisonwest.onmicrosoft.com` address
(overriding the catch-all for hello@ only). Verified: app demo-alerts and external mail to
hello@ both land in the shared mailbox.

**Still deferred:** (1) a full MX move to M365 (only if *all* rxshift.io mail should live in
M365 — the per-address Cloudflare forward is sufficient for now); (2) paid seats for
Susie/RT when they need mailbox access.

## June 15, 2026 — Per-location ratio + unified person-centric schedule

**Ratio is per LOCATION; the "ratio zone" concept is removed.** Everyone counting
toward ratio at a pharmacy location counts together, regardless of room — the
per-zone model (e.g. a separate "SPC Compounding" ratio pool) was a mistake that
matched no real pharmacy. Ratio now groups by `location_id`. If a site genuinely
needs two independent ratio pools (a fully isolated sterile suite), it becomes a
second **location**. Confirmed with Jamison; `ratio_zone` dropped in migration 0018.
The engine was already zone-agnostic, so this was a grouping-key change, not an
engine rewrite. SPC Compounding became a **department**.

**Departments are tenant-level, not location-bound.** "One department in two
locations" only works as a single shared record, so `department.location_id` was
dropped. A department is an optional tag on a shift, used for filtering — never for
ratio. A per-tenant **"require a department on every shift"** setting was added (some
operators want it mandatory, others not).

**Scheduling is person-centric across locations; one matrix is the home.** You
schedule a person and pick where each shift lands. **All Locations** is the single
build surface; selecting a location (or department / work type) is a **view filter**
showing only the matching scheduled staff. The per-location builder, the range view,
and the "Edit period" mode were removed — they fragmented a fundamentally
person-centric task. Chosen over the earlier "build per period, view by range" model
now that multi-location staff made the gap obvious.

**Periods become invisible plumbing; publish stays per-location.** Scheduling into a
week with no period auto-creates the cycle-aligned period for that location
(`ensurePeriodForDate`). There is no "create next period" button. Publishing and the
compliance record remain **per location** (the regulated unit): `publishWindow`
publishes every draft period overlapping the window (or just the filtered location),
reusing the per-period flag/override + snapshot logic. A toolbar status pill shows
Published vs Draft so the active/creation distinction is always clear.

**Per-location / multi-state ratio rules: DEFERRED.** Today one tenant-wide ratio rule
applies to every location. A chain crossing state lines would need per-location rules;
not pre-built (no such customer yet). Revisit when a real cross-state prospect appears.

**Staff avatars use a PRIVATE bucket + signed URLs.** Staff photos are mild PII in a
multi-tenant app; the `avatars` bucket stays private with tenant-scoped, manager-only
write RLS, and display goes through short-lived signed URLs. (A public bucket was
considered for simplicity and rejected — don't weaken access controls for convenience.)

**AI command bar removed from the schedule (temporarily).** It was bound to a single
period; it doesn't fit the all-locations/window model as-is. Re-add later, bound to the
window. Group-by (by person/location/department) is currently served by the filters
rather than a separate sectioning toggle.

## June 13, 2026 — Schedule UX, live board, branding & help

**View is decoupled from build; build cycle stays the publish unit.** You build and
publish one period at a time (weekly/biweekly/monthly), but a separate view selector
(week / 2-week / month) lets anyone browse any window — fetched by date range across
periods (`loadRangeBundle`), validated via a synthetic period so the engine is
unchanged. Editing a cell still resolves to the period that covers that date. Chosen
over making *building* flexible too, which would re-engineer the period/publish model
for little gain — exactly the complexity Jamison asked to avoid.

**Configurable live statuses decorate a fixed enum; they don't replace it.** The five
status *values* stay a Postgres enum (no risky type change). A new `live_status_config`
table holds per-tenant show/hide, label, and counts-toward-ratio; no row = built-in
default, so existing tenants are unchanged with zero backfill. Stored in its own table,
**not** a `tenant` JSONB column, because the `tenant` UPDATE policy is owner-only while
the settings action uses `requireManager()` — a manager write to `tenant` silently
no-ops under RLS today (latent, pre-existing; documented here, not fixed in this pass).
A dedicated table gets a manager-friendly policy.

**A status that counts is left to the engine; we never force-count.** On the board, a
non-counting live status forces `counts_override=false`; a counting status is left
untouched so the normal work-type/staff rule still applies (we never make a
non-counting work type count just because the person's status counts).

**Live out-of-ratio alerts are cron-driven with grace + cooldown.** One code path
(`evaluateLiveZones`, shared with the board so they can't disagree) evaluates the
current slot; a 5-minute grace absorbs accidental mis-clicks and a 60-minute cooldown
prevents re-nagging, both stored in `live_ratio_alert_state` so correctness is
independent of cron cadence. Per-minute delivery needs a paid Vercel plan; until then
it runs ~daily and the on-screen badge is the real-time signal. "About to be out of
ratio" (predictive) is **deferred** — mixing live "now" status with next-slot scheduled
assumptions risks false alarms.

**Compliance cue is a fill-independent corner badge (supersedes the June-12 ring).** A
deficient shift gets a red ⚠ badge with a surface-colored outline in the corner, so it
reads on any work-type fill including reddish ones — the ring alone could vanish. The
red ring stays as a backup; the amber constraint ring is unchanged.

**Branding is one accent color + a logo URL, owner-only, RxShift always visible.** Only
`--color-amber` is overridable (buttons/highlights), server-rendered and scoped to the
app shell, in both modes; text/background tokens stay fixed so a tenant can't make the
UI unreadable. The RxShift mark always shows in the sidebar (plus "powered by RxShift"
when a tenant logo is set). Logo is by hosted URL; in-app upload stays deferred pending
Supabase Storage. A second/third brand color is deferred (single accent is the 80/20).

**Admin-only help is gated in RLS on one page, not a separate route.** A single
`admin_only` flag + an `help_select` policy that checks `platform_admin` keeps admin
docs out of the tenant help index *and* the AI assistant's corpus (both query with the
caller's client), with no app-code gating to forget. The help page already groups
categories dynamically, so admins just see an extra "Platform Admin" section.

**Per-person "standard schedule" templates deferred; department filter deferred.**
Copy-forward ("same as last period") covers ~90% of templating with no new model. The
schedule has no department filter because onboarding skips departments, so there's no
data to filter on.

## June 12, 2026 (late) — Work-type colors + dark mode

**Work-type colors: two visual channels (Susie/Optum feedback):** Shift blocks use
work-type color as the fill — not compliance. Compliance status is a separate ring:
red ring + ⚠ for deficient, amber ring for constraint violations. The fill never
changes based on compliance — it stays the work-type color. This matches the When I
Work pattern Optum relies on. Red and amber are reserved for compliance across the
whole product; the color palette for work types deliberately excludes them.

**Work-type palette is curated, not free-form:** 16 mid-dark swatches in
`lib/work-type-colors.ts`, all rendering white text legibly in both light and dark
mode. A `readableTextColor()` WCAG-luminance util exists for future custom hex input.
Reds and ambers excluded. Curating the palette keeps the UI coherent and prevents
accidental compliance-signal collisions.

**Dark mode is app-only; marketing always renders light:** The no-flash script in
`app/layout.tsx` is gated: it only applies `.dark` when `hostname` starts with `app.`
or `pathname` starts with `/app`. Marketing pages never receive the `.dark` class.
Decided because: (a) navy-on-white is the brand identity for the marketing site;
(b) the initial dark mode implementation leaked `.dark` onto marketing via the root
layout, making navy text invisible on white cards.

## June 12, 2026

**Scope boundary (from the Phase 2 amendment; updated June 19, 2026 for R072-25):**
RxShift is a scheduling and ratio-enforcement tool with compliance
logging. Volume-based staffing minimums remain **collect-only** (Sec 2.2 of
R072-25) — never enforced. The proposed rule (now R072-25, was R113-24) is
forward context in marketing, not a current-law claim. Hourly Compliance
Record + ceiling/floor deficiency flagging + state ratio enforcement
(NAC 639.250 today, R072-25 behind a toggle, CA BPC 4115, TN cert-uncapped)
+ manager sustained-deficiency alerts = the product today.

**Board containment (Jamison, after Susie's reaction to "we notify the
board" in an early pitch deck):** RxShift NEVER contacts any board of
pharmacy or regulator. When deficient days run several in a row
(a "sustained deficiency"), it alerts the pharmacy's own managers
(in-app + email at publish) — nothing more. Whether and how to
report anything is always the pharmacy's decision. This is contractual
(Terms §6) and enforced in copy across the site and app. (Reframed
June 19, 2026 off the old R113-24 "board report may be required"
language; R072-25 has no board-notification trigger.)

**Tennessee enforcement — RESOLVED & CONFIRMED June 19, 2026 (was deferred for contradictory research):**
**Rule confirmed (high confidence): 6 non-certified technicians per pharmacist; certified
(CPhT / NHA ExCPT) technicians are uncapped (counted separately).** Confirmed against the primary
source — **Tenn. Comp. R. & Regs. 1140-02-.02** (LII Cornell + tnsosfiles.com) — and independently
corroborated by two secondary sources (rxtechexam.com, verified May 2026; pharmacytechscholar.com,
verified June 2026). The earlier blocker was a **wrong 1:2→1:4 framing** that caused confusion; that
framing is incorrect and has been removed.

- **Engine: already shipped** (not pending a spec). `buildEngineRule` sets `certified_uncapped` when
  `ratio_rule.state === 'TN'`, so only non-certified techs count against the cap; reuses `staff.certified`.
  This is *simpler* than Nevada — a single numeric cap on non-cert techs, CPhT counted separately. Tested in
  `lib/engine/__tests__/floor-and-r072.test.ts` (6 compliant, 7 deficient, 10 certified compliant).
- **Marketing corrected June 19, 2026:** `app/(marketing)/states/tennessee/page.tsx` rewrote the wrong
  1:2→1:4 bullets/hero to the confirmed 6-non-cert / certified-uncapped framing; the `/vs/when-i-work` row
  matches. (The page was publicly understating what TN pharmacies are allowed — a trust risk with informed
  TN prospects.)
- Per the standing "verify before relying" rule, a TN customer should still confirm current board language.

**California shipped as additive formula:** BPC 4115 (max techs =
2 × pharmacists − 1) is enforced by the engine (`formula='additive'`,
first=1, additional=2), tested, and marketed in present tense.

**Honest-marketing rule (standing):** the website claims only what the
engine actually does; everything else is explicitly "on the roadmap."
Independently arrived at by both the chat-research review and the
codebase review on the same day — treat it as policy.

**Pricing is centralized:** `lib/pricing.ts` is the single source of
price truth. Billing columns on tenant are provider-shaped ('manual'
today); Stripe later implements the same fields + webhooks. Entitlement
enforcement point exists (`isTenantEntitled`) but is permissive until a
payment provider is live.

**Demo tenants:** fictional data only, `is_demo` email gate (redirect to
one inbox or silence), never go live, resettable with date re-anchoring.

**Emulated actions are attributed to the emulated user (June 19, 2026):**
when a platform admin "Views as" a tenant person, persisted attribution
(`actor_user_id`/`author_user_id` on compliance notes, audit log,
override log) now records the **emulated tenant user** (via
`ctx.actingUserId = appUser.supabase_user_id`), not the operator's real
auth id. Chosen so the demo (and any single-operator workspace) reads
coherently — a note added "as Frank DiMaggio" shows Frank, matching the
seeded data — and the Override Log / Compliance Record / Audit Log agree.
Trade-off: in real customer *support* via emulation this hides that an
RxShift operator (not the customer) took the action. Acceptable
pre-first-customer; revisit if support-via-emulation becomes a real
workflow (e.g. tag emulated actions distinctly). `ctx.userId` is
unchanged (still the real auth user) — only the attribution field moved.

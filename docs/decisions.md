# RxShift — Decision Log

Durable product/scope decisions. Newest first. Code and CLAUDE.md are the
source of truth for *what exists*; this file records *why*.

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

**Scope boundary (from the Phase 2 amendment, confirmed by Jamison):**
RxShift is a scheduling and ratio-enforcement tool with compliance
logging. It is not a full R113-24 compliance engine. Volume-based
staffing minimums are deferred to a future release. R113-24 is urgency
context in marketing, not a feature checklist. Hourly log + deficiency
flagging + state ratio enforcement + manager streak alerts = the product
today.

**Board containment (Jamison, after Susie's reaction to "we notify the
board" in an early pitch deck):** RxShift NEVER contacts any board of
pharmacy or regulator. The product flags when a board report may be
required and alerts the pharmacy's own managers (in-app + email on a
3-consecutive-deficient-day streak at publish). Whether and how to
report is always the pharmacy's decision. This is contractual (Terms §6)
and enforced in copy across the site and app.

**Tennessee enforcement deferred — contradictory research:** The Phase 2
amendment says TN ratios are 6:1 for non-certified techs with certified
techs uncapped; the original Phase 2 spec (and the live TN page) says
1:2 base expandable to 1:4 with certified techs. Until the actual rule
is verified against the TN board's current language, RxShift ships CPhT
*tracking* (staff.certified, rosters, exports) but NOT cert-dependent
ratio enforcement. The TN page stays "in development."

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

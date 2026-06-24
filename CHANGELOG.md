# RxShift Changelog

Newest-first. One entry per build session. This file is updated after every commit and
is the fast-read reference for what shipped, what's pending, and what changed in
infrastructure. Full context lives in `CLAUDE.md`; infrastructure details in
`INFRASTRUCTURE.md`.

---

## 2026-06-23 — Staff scheduling logic: rules, propose-and-accept, ratio exclusion, flexible export

Big build from the Susie working session — captures Lucy's scheduling logic
(`docs/Lucy SMMS Schedule.docx`) and turns the "regular schedule" into a first-class,
rule-driven, human-confirmed flow. Built in 7 phases (one commit each).

**Schema (migrations 0037 + 0038 — APPLIED to the RxShift Supabase):**
- `staff_scheduling_rule` table (rule_type enum + params jsonb, mirrors `constraint_rule`) + RLS.
- `staff.scheduling_notes`, `staff.excluded_from_ratio`, `tenant.week_start_day` (default 1=Mon),
  `location.coverage_notes`, `override_log.warning_type` += `'rule'`.

**Shipped:**
- **Exclude-from-ratio flag** — the engine skips a person entirely (ceiling, trainee sublimit, AND the
  solo-pharmacist floor) while keeping their RPh/tech role + grid band. Distinct from `non_counting`.
- **Staff record slide-over** (`StaffRecordPanel`, reused by the staff list + the builder): notes, ratio
  flag, per-person constraints, scheduling-rules CRUD, availability summary — each section saves on its own.
- **Scheduling rules** — 11 rule types (recurring shift/work-type, nth-weekday, monthly quota, quarterly
  project days, float, per-diem, preferences). Plain-language rendering shared across surfaces.
- **Propose-and-accept** — a pure resolver (`lib/scheduling-rules.ts`, 12 tests) expands rules into concrete
  shift PROPOSALS + advisory unmet warnings. Surfaced per-person (slide-over) AND period-level ("Apply rules"
  on the builder, grouped by person, Accept / Accept-all). Applies via the same path as Ask AI; nothing
  auto-commits. Dismissed warnings → override log (`warning_type='rule'`).
- **Builder hover + click-through** — staff names hover (notes + rules + limits) and open the record
  slide-over. Build-only (gated on `!readOnly`); View Schedule unchanged.
- **Configurable first day of week** (`tenant.week_start_day`, default Monday) threaded through every period
  boundary + the grid; Settings selector. View month zoom now renders full weeks (no month-edge clipping).
- **Flexible schedule export** — `schedule-range` report: any date range × one/many/all locations, rich detail
  columns + a compliance proxy + flags, plus "Hours by staff" / "Hours by location" summary tabs. New
  **print view** (`/app/reports/print`): weekly grid, one location per page, role-grouped.

**Demo:** Mesa Vista now seeds Monday week-start, an excluded procurement supervisor (Amanda Cole),
scheduling notes, Spring Valley coverage notes, and 4 sample scheduling rules. Run "Restore demo data" to
refresh the live demo with them.

**Verified:** `tsc` clean, `next build` clean, 89 vitest tests pass. Browser/demo QA pending (CoWork loop).

**Open:** apply was additive + safe; deploy pending Jamison's go (Vercel CLI). Coverage targets are free-text
only (enforcement deferred). Rules are advisory/propose-only (no auto-scheduling).

## 2026-06-23 — Subprocessor audit + legal doc status

Pre-commercial subprocessor review ahead of first enterprise customer. No code changes this session — documentation and decision logging only.

**Decisions (see `docs/decisions.md` June 23 entry):**
- **OpenAI interim decision locked:** OpenAI gpt-4o-mini stays through demo phase; intended migration is AWS Bedrock (Claude) before first enterprise customer. No formal DPA in place — acknowledged gap. Blocker: Jamison provisions AWS account.
- **Supabase DPA must be formally executed** under supabase@rxshift.io before first customer. Blocker: Jamison signs in Supabase dashboard.
- **Legal docs not finalized:** Terms §14 has a placeholder for governing law/venue. Blocker: Jamison sends to Phil for the clause.

**Privacy policy updated:**
- §4 subprocessors: added Cloudflare (was missing); updated OpenAI language to accurately describe what the API terms of service guarantee (no model training) vs. what is NOT yet in place (formal DPA).

**Open (Jamison actions required before first customer):**
- Provision AWS account → migrate `lib/ai.ts` to Bedrock (one Claude Code session)
- Execute Supabase DPA at supabase.com under supabase@rxshift.io
- Send Terms §14 to Phil for governing-law / venue clause

---

## 2026-06-23 — Security audit + pre-launch hardening

Full read-only security audit (tenant isolation, RLS, privilege escalation, RBAC, service-role usage,
API perimeter, secrets, AI, storage). **Core posture is sound** — RLS genuinely isolates tenants
(`tenant_id = private.user_tenant_id()`, SECURITY DEFINER helpers with pinned search_path, derived from
`auth.uid()`), no privilege-escalation path, service-role usage is tenant-scoped, storage buckets private,
AI can't decide compliance. Fixed the perimeter items below; OpenAI-DPA and a strict CSP are deferred to
Jamison.

**Shipped:**
- **Shared, cross-instance rate limiting** on `/api/auth/login-link` and `/api/contact` (new `lib/rate-limit-db.ts`
  → `check_rate_limit` RPC). Replaces the old in-memory `Map` throttles, which didn't share state across
  serverless instances and were bypassable — this closes an **email-bomb vector** (a known inbox being flooded
  with sign-in links) and blunts enumeration. Per-IP + per-email limits.
- **Removed the login-link enumeration/timing oracle:** the O(users) `listUsers` page-scan is replaced by an
  indexed `auth_user_email_exists` RPC (service-role only). Faster and no timing signal.
- **Baseline security headers** on every response (`next.config.ts`): HSTS, X-Frame-Options DENY,
  X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
- **Cron routes** now fail-closed if `CRON_SECRET` is unset (returns 500 instead of accepting `"Bearer undefined"`).
- **Resend webhook** rejects stale events (svix-timestamp freshness ±5 min) — replay protection.
- **Removed dead `createAdminClient`** from `lib/supabase/server.ts` (a service-role factory with no `server-only`
  guard — latent footgun). The only service-role client is `lib/supabase/admin.ts` (`server-only`).
- **Cloudflare Turnstile (free CAPTCHA) on the demo form** — `lib/turnstile.ts` + the widget in
  `contact-form.tsx`, verified server-side in `/api/contact`. Gated on `NEXT_PUBLIC_TURNSTILE_SITE_KEY` /
  `TURNSTILE_SECRET_KEY`, so it ships **dormant until the keys are added**, then activates automatically. Fails
  open on a Cloudflare outage so real leads aren't lost; the rate limiter stays as the second layer.

**Schema (migration 0036, applied):**
- `rate_limit` table (RLS deny-all; service-role + SECURITY DEFINER fn only) + `check_rate_limit()` fn.
- `auth_user_email_exists()` fn (indexed auth.users lookup, service-role only).
- Pinned `search_path` on `touch_leads_updated_at` (advisor WARN).

**Open / deferred (need Jamison):**
- OpenAI data egress (staff names + schedules → gpt-4o-mini): confirm privacy policy / DPA / zero-retention.
- Content-Security-Policy: deferred — needs per-page testing; other headers shipped.
- Add the Cloudflare Turnstile keys (site + secret) to activate the demo-form CAPTCHA (built this session,
  dormant until set). Enable Supabase "leaked password protection" (dashboard toggle). Optional: add an audit
  entry when a platform admin emulates/switches into a tenant (observability).

## 2026-06-23 — Grid opens on today + website copy = "Demo"

- **Schedule grid auto-scrolls so TODAY is the leftmost day column** (flush against the frozen staff
  column), instead of centering it. On a month / 2-week view you now open on "today → forward" with no
  manual horizontal scrolling. Horizontal-only (no vertical jump). Applies to both Build and View
  (shared `schedule-grid.tsx`).
- **Website copy consolidated on "Demo."** Susie flagged mixed "walkthrough"/"demo" language. The form,
  the `#demo` anchor, the success message, the privacy policy, and the Features CTA already said
  "Demo," so the stray "Schedule a Walkthrough" CTAs (nav, /nevada, /about, pricing signal + calculator,
  /states/tennessee, Nevada callout) are now "Schedule a Demo." (Internal code comment + docs untouched.)

## 2026-06-23 — QA round 3 fixes (Build/View split)

CoWork QA (`docs/qa/2026-06-23-build-view-split-qa.md`) ran the split on Mesa Vista (weekly cadence):
5 PASS / 1 FAIL. The fail was a demo-data gap, not a code bug.

- **PTO conflict now demoable on Mesa Vista.** The feature was verified on Optum, but Mesa Vista had no
  scheduled-on-a-day-off scenario. The seed now seeds a deliberate one — **Keisha Brown (Henderson) has
  an approved day off Friday but stays on Friday's schedule** → red ⚠ + Open Flags + publish gate.
  (Needs a "Restore demo data" to appear.) Prompter beat 6 repointed to Keisha (was the Optum-only
  "Ashley Dinh").
- **View Schedule page title** → "View Schedule — …" (matches nav).
- **"Build mode" button renamed "⤢ Maximize"** — it's the chrome-collapse for laptop rows; the old name
  was confusing now that Build is its own screen. Prompter updated. Prompter → v4.2.
- Work-types chip row hiding on an empty week confirmed by-design (no change).

## 2026-06-23 — Build vs View split: cadence-locked builder + read-only schedule for everyone

The big scheduling-UX decision realized. Building and viewing are now two distinct surfaces, so the
build experience is focused on the org's cadence and "see it or build it" maps cleanly to permissions.

### Shipped
- **Build Schedule** (`/app/schedule`, managers/schedulers only): now **cadence-locked**. The window
  *is* one build-cadence period (week / 2-week / month per `tenant.schedule_cycle`) — no span picker.
  Header reads **"Building: July 2026"** (period label) with **◀ Prev / Today / Next ▶ stepping by
  period**, and the copy button is cadence-aware (**"Copy last month's pattern"** for Optum). A
  read-only/staff user who hits this URL is redirected to View Schedule.
- **View Schedule** (`/app/view-schedule`, **all roles**, new nav item): read-only, **published-only**,
  with the week / 2-week / month **zoom** for looking + the dept/work-type chip filters. No edit
  affordance (cells aren't clickable), no build toolbar, no compliance rings — viewers just see who
  works when. New component `schedule-view.tsx`.
- **Shared grid, no drift:** both surfaces render the same `schedule-grid.tsx`. Added a `readOnly` prop
  (no cursor/hover, cells inert) used by View.
- **Nav:** sidebar + mobile "More" sheet now show **Build Schedule** (managers) and **View Schedule**
  (everyone) in place of the single "Schedule" item.

### Notes
- Phase 2 (multi-manager submit → review → publish workflow) is **designed, not built** — see the
  Susie feedback paragraph. Today: shared draft, anyone with build rights edits, one publish.
- `tsc` clean, 74 tests pass, build clean.

## 2026-06-23 — PTO + scheduled-shift overlap is now a flag (Option B) + Optum data cleanup

- **PTO conflict flag (Option B — flag it, don't hard-block).** A shift scheduled on a day the person
  is off (a direct `pto_day` OR an approved time-off range) is now a flag: red ring + ⚠ on the grid
  (the hard-conflict treatment, same as a ratio deficiency), listed in **Open Flags**, and it **gates
  publish** (publishing over it requires a logged reason — for free, since it joins `constraintFlags`).
  Detected in `validateBundle` (the engine stays PTO-agnostic — PTO = absence of a shift; this is a
  validation-layer overlay that never touches ratio math). The matrix routes `pto_conflict` flags to the
  red channel, not the amber constraint ring. Demo: Ashley Dinh (Optum) is scheduled Fri Jun 26 on her
  PTO day — now flagged red.
- **Optum cleanup:** deleted the 808 empty-shell shifts (Jul 2–31) from the bad month copy. Ashley's 3
  real July shifts kept; 0 segment-less shifts remain.

## 2026-06-23 — Fix: copy-forward dropped shift segments past 1000 rows (phantom "SMRX" cells)

Susie hit empty cells showing only a tiny "SMRX" tag and no shift. Root cause: she ran **"Copy last
week's pattern" on the Month view**, which copied **809 shifts** at once. `copyForwardWindow` fetched
all of the source segments in a single `.in(shift_id, […809])` query — and Supabase/PostgREST silently
caps any response at **1000 rows**, so segments past row 1000 were dropped and those shifts were created
**with no segments** (a shift block with no time/work-type renders as just its location tag). 808 such
shifts landed in the Optum demo tenant (Jul 2–31); no other tenant affected.

### Shipped
- **New `fetchAllRows` helper** (`lib/schedule-data.ts`) pages past the 1000-row cap with `.range()`.
- **`copyForwardWindow`** now pages the prior-shift fetch, the existing-shift ("taken") fetch, AND the
  segment fetch — so a month-long copy carries every segment. This was the actual bug.
- **`loadRangeBundle` + `loadAllLocationsBundle`** now page their shift AND segment fetches too. These
  had the same latent cap: a busy all-locations **month** view could silently under-display the grid
  (shifts/segments past row 1000 just vanished). Fixed before it bit anyone.
- **Display guard:** the matrix ignores any shift with zero segments, so a broken artifact can never
  render a phantom location tag again (real shifts always have ≥1 segment, enforced on save).
- **Month view was loading NO shifts (follow-up, same root family).** A busy month references ~750
  shifts, so the segment fetch put ~750 UUIDs in one `shift_id=in.(…)` URL — PostgREST returned **400
  (URI too long)**, segments came back empty, and the new display guard then hid every shift (only PTO
  showed). New `fetchSegmentsByShiftIds()` chunks the id list (100/req, run in parallel) so the URL
  stays short; used by both loaders and copy-forward. Also: `fetchAllRows` now **throws on a page
  error** instead of silently returning `[]` — that silent failure is what made this invisible.
  (Confirmed via Supabase API logs: month segment fetch 400 → now chunked 200s.)

### Data
- Pending: delete the 808 segment-less artifact shifts from the Optum demo tenant (Jul 2–31).

## 2026-06-23 — Build mode v2 (one command strip) + grid uniform columns + holiday polish

The scheduling surface Susie/Brandy will judge. `tsc` clean; 74 tests pass; build clean.

### Shipped
- **Build mode v2 — ONE command strip.** Build mode used to just collapse the chrome and leave the
  four stacked control rows (status, toolbar, window nav, filters) in place. Now those consolidate into
  a single ~44px bar: **date nav (◀ Today ▶) · view (Wk/2wk/Mo) · location · honest status pill · flags ·
  Ask AI · Copy · Export · Publish · ⤢ Exit**. The filters row and the work-type legend are hidden in
  build mode; the page's own LocationNav / window-nav row / Ask-AI bar hide via the `schedule-chrome`
  class. Net: ~16–17 staff rows visible on a 1366×768 laptop (was ~11). New shared helper
  `lib/build-mode.ts` (`setBuildMode`/`isBuildMode` + a `rx-build-mode` event) keeps the sidebar toggle
  and the strip's Exit button in sync. The matrix renders the strip reactively from that event.
- **Grid columns are uniform width (Susie's "Thursday is wider" finding).** Switched the grid table to
  `table-fixed` with fixed staff (180px) + day (120px) column widths, so a long work-type label
  (e.g. "CCC (Clinical Call Center)") truncates instead of stretching its column. Verified live on the
  OptumRx tenant — columns now read evenly.
- **Holiday column polish.** The whole holiday column (header + body) now reads as one tinted, framed
  unit in BOTH light and dark mode, regardless of cell state (draft amber / PTO / empty), via an
  inline-style overlay + inset accent lines (`HOLIDAY_CELL_STYLE`) that compose over the cell background
  and can't be lost to Tailwind border-class ordering. Header shows ★ + the holiday name. Settings →
  Holidays list now shows the year on each row (the unsorted-looking complaint was a year ambiguity).

### Demo / docs
- Prompter bumped **v4.0 → v4.1**: beat 6 (Build mode) reworded for the command strip + the ⤢ Exit button.
- **Round-2 QA report ingested** (`docs/qa/2026-06-23-round2-demo-qa.md`) — all six targeted round-1 fixes
  verified live (buildable empty week, publish reason-gate, partial status, anchor preservation, holiday
  remove-confirm, OptumRx "Ashley Dinh" match). F-R2-01 (holiday column) resolved by the polish above;
  F-R2-02 (Ask-AI monthly proposal-text nuance) still deferred.

### Open
- Chrome-validate the command strip at 1366×768, then hand CoWork a round-3 prompt.
- PTO + scheduled-shift overlap: flag it as a constraint (Option B) — next change.

## 2026-06-23 — Demo QA round 1: fixes from CoWork's run-through

Triaged CoWork's first run-through (`docs/qa/2026-06-23-demo-qa.md`) and verified each failed item live
via Claude-in-Chrome before coding. `tsc` clean; 74 tests pass; build clean.

### Shipped
- **Location-filtered empty week is now buildable.** A plain location filter shows that location's HOME
  team even with no shifts, so an empty/unbuilt week has rows to click (it showed zero rows before — the
  one genuine bug in the run). All-Locations was already fine. (`schedule-matrix.tsx` `activeStaff`.)
- **Switching location/view preserves your week position** — the nav links now carry `anchor` (it reset
  to today before). (`schedule/page.tsx`.)
- **Holiday Remove now confirms** before deleting (avoids accidental removal mid-demo).
- **No change (working as specified):** generic "Holiday" column label; Ask AI collapsed to a "✨ Ask AI"
  button. Both match the original spec.

### Demo data
- The seed now leaves **next week (offset 1) built-but-draft** (carries Jerome's recurring overtime flag),
  so the publish-reason gate AND the partial "N/M days published" status are reachable/demoable (every
  week was published before, so neither could be reached — the features were correct but invisible).

### Open
- Redeploy (CLI) + demo reset, then CoWork round-2 run-through.
- Ask AI "Ashley Din" name-resolution: code-verified; retest in the OptumRx tenant.

## 2026-06-22 — Scheduling overhaul: bugs, PTO, holidays, build mode, in-app prompter

Demo-critical batch after Susie's schedule-builder walkthrough — make building a schedule strong,
fix three confirmed bugs, add PTO/holidays/carry-forward/build mode, and turn the demo prompter into
a living in-app feature. `tsc` clean; 74 vitest tests pass (engine unchanged).

### Shipped
- **Bug — publish bypassed the required flag reason:** the publish dialog button is now gated until a
  reason is entered, AND `publishWindow` re-validates the whole window (all locations) server-side so
  window-only flags (cross-location double-bookings, window-spanning caps) can't publish unreasoned.
  The reason always lands in the override log.
- **Bug — nav reopen toggle scrolled out of reach:** it's now a FIXED left-edge tab mounted at the
  shell (`sidebar-reopen-button.tsx`), reachable at any scroll position; removed from the page header.
- **Bug — Ask AI matched the wrong staff:** deterministic name resolution (`resolveStaffName` in
  `lib/actions/ai.ts`) — the model echoes the name, we match (exact → containment → typo-tolerant) and
  override the id, asking to confirm when ambiguous. Can't schedule the wrong person.
- **Cadence = Model B (locked), honest status:** one build cadence per tenant (relabeled "Build cadence");
  the period stays the publish unit (no per-day publish). Wired the grid's dormant per-day `dateStatus`
  (worst-wins for All Locations) → truthful column tint/labels + an honest "N/M days published" pill. A
  not-yet-built future week is now clickable (ShiftModal sends a null period; `upsertShift` auto-creates).
- **Month-view parity:** column min-width 92→116px so month cells show the same time + work type + color
  as week/2-week (month had collapsed to the 92px floor, reading as "just the location").
- **PTO** is a first-class `pto_day` record — blacked out on the grid, independent of publish state,
  written by approval or directly (PTO checkbox on the shift editor; deletes the shift that day). Engine
  never reads it. Optional reason on the record; `tenant.pto_reason_required` gates it.
- **Holidays:** Settings → Holidays generates US federal holidays (deterministic, observed-day aware) +
  add/edit/remove; grid tints + labels the column. Visual only.
- **Carry-forward:** copy one shift across following days in one action (skips existing shifts / PTO).
- **Build mode + collapsible Ask AI:** Ask AI defaults to a small button; "Build mode" collapses the
  sidebar + page chrome so the grid fills the viewport.
- **Demo prompter in-app:** `/app/demo-prompter` (platform-admin popout from the Admin Console), driven
  by `lib/demo/prompter-steps.ts` (v4.0). Static `docs/rxshift-demo-prompter.html` retired to a pointer.
- **Demo QA loop:** documented the recursive Claude-Code ↔ CoWork run-through process in
  `docs/qa/README.md` + a mandatory "Demo QA handoff" rule in `CLAUDE.md`.

### Schema
- **Migration 0034** — `pto_day` (+ RLS) + `tenant.pto_reason_required`. Applied to the live Supabase.
- **Migration 0035** — `holiday` (+ RLS). Applied to the live Supabase.

### Demo data
- Mesa Vista seeds `pto_day` (Ashley Morales approved next week + a scheduler-entered Dana Holt
  current-week example) and federal holidays (current + next year). Both new tables added to the reset
  clear-list (`pto_day` before `staff`; `holiday` with the tenant-scoped tables).

### Open
- Run the CoWork QA pass against the live demo (prompter v4.0) and address findings.
- `pto_day` reversal on a denied/un-approved request is out of scope for v1 (see decisions.md).

## 2026-06-19 — Pre-QA cleanup: QA-found bugs, copy, attribution, screenshots

Applied the fixes from the CoWork full product + demo + website QA pass (report archived at
`docs/qa/2026-06-19-full-product-demo-qa.md`) ahead of the next QA run. All verified live on localhost:3200.

### Shipped
- **Coverage Forecast dropdown routing (bug):** the period selector in `components/app/log/compliance-view.tsx`
  pushed to `/app/log` (the Compliance Record), so changing period/location on `/app/coverage-forecast`
  bounced you off the forecast. Now navigates to `/app/coverage-forecast?period=…`. Verified live.
- **Live Board / kiosk ratio label (bug):** `lib/board-data.ts` printed the stored base rule in
  "(N/pharmacist)" while the limit number used the effective R072-25 ceiling. Now uses
  `engineRule.max_techs_per_pharmacist`, so the label matches the limit (verified: 8/4/12 → "4/pharmacist"
  with R072-25 on; 6/3/9 → "3/pharmacist" off). Fixes both `/app/board` and `/app/display`.
- **Attribution under emulation (bug):** notes, audit entries, and overrides were attributed to `ctx.userId`
  (the real platform admin), so actions taken while emulating resolved to a bare role ("owner_admin") instead
  of the tenant person. Added `ctx.actingUserId` in `lib/actions/helpers.ts` (the emulated user's supabase id)
  and used it for every persisted `actor_user_id`/`author_user_id` (helpers/logActivity, compliance-notes,
  audit, requests×2, schedule); added `display_name` resolution to the Audit Log page. Verified live: a note
  added while emulating Frank, and its audit entry, both show **Frank DiMaggio**.
- **Email Log detail crash (bug #3):** could **not reproduce** on a freshly started dev server — the route
  (`/app/admin/emails/[id]`) renders cleanly across all email kinds (notification, sign-in, schedule, PTO).
  The "Jest worker… child process exceptions" message was a transient dev-server worker crash during the
  heavy QA session, not a code defect. No code change; the production-build-for-demos guidance covers that
  dev-overlay/worker-instability class.
- **Marketing copy:** dropped the "hourly documentation regulators require" mandate claim (hero) — current law
  has no such mandate — and the "the math changes when volumes shift" volume-enforcement implication (problem
  section; volume is collect-only). Reworded to accurate value framing.
- **Cosmetics:** `suppressHydrationWarning` on `<html>` (removes the dev "1 Issue" overlay badge from every
  screen incl. the kiosk wall display); "Restore demo data" now confirms inline with re-seeded counts; the
  Admin Console emulate dropdown shows the owner's `display_name` ("Frank DiMaggio") instead of his email.
- **Marketing screenshots (all 5 regenerated, current-law):** recaptured with R072-25 toggled off so the
  imagery shows 3/pharmacist (matching the site), the current sidebar, and the as-worked Compliance Record on
  the deficiency day. Fixed `scripts/capture-screenshots.ts` to target `/app/log?date=…` (the deficient day,
  queried) instead of the stale `?period=`. Demo tenant restored to R072-25 on afterward.

### Schema
- None.

### Infrastructure
- None. (Demo tenant `nevada_r072_25` was temporarily toggled off for the screenshot capture, then restored to
  on; `demo_clock` left pinned at 14:30, branding restored.)

### Open
- Email Log detail "Jest worker" crash is non-reproducible; revisit only if it recurs deterministically.
- `compliance-record.jpg` shows the deficient hour; its inline annotation sits just below the viewport fold —
  acceptable for the feature card, could be reframed (fuller capture) later if desired.

---

## 2026-06-19 — Nevada R072-25 engine + schema, Tennessee, sustained-deficiency reframe, Nevada rewrite

We learned the rule we'd been referencing changed: Nevada's proposed **R072-25** (LCB File No. R072-25;
public hearing June 4, 2026; **not adopted**) supersedes R113-24. Implemented it behind a tenant toggle,
added Tennessee, removed every R113-24 reference, and rewrote the Nevada marketing to lead with current law.
Full build notes: `docs/rxshift-r072-25-build.md`.

### Shipped
- **Engine (`lib/engine/`):** new pure mapper `rule.ts` `buildEngineRule(rule, ctx)` applies the overlays:
  - **Ceiling** — NV retail + toggle → **4 techs** (or 2 techs + 2 trainees); telepharmacy/institutional →
    base cap. **Tennessee** (`state === 'TN'`) → 6-tech cap with **certified (CPhT) techs uncapped**.
  - **Floor (new)** — NV retail + toggle → a solo pharmacist needs **≥1** support (**≥2** with a
    drive-through). `evaluateZone` now emits `flag_type` (`ceiling` | `floor` | `both`); rolled up per hour
    by `generateComplianceRecord`; persisted on `compliance_record.flag_type`.
  - Toggle off / retail / non-TN = **identical to before** (the 55 existing tests stay green). 19 new tests in
    `lib/engine/__tests__/floor-and-r072.test.ts`. All `evaluateZone` callers pass per-location context via
    `engineRuleForLocation`.
- **Schema (migration 0032, applied):** `location.location_type` (retail/telepharmacy/institutional),
  `location.has_drive_through`, `location.expected_rx_mon..sun` (informational); `staff.staff_type`
  (pharmacist/tech/tech_in_training, backfilled); `tenant.nevada_r072_25` (default false);
  `compliance_record.flag_type`.
- **Settings + UI:** R072-25 toggle (Organization); TN note (Ratio); location_type / drive-through /
  expected-Rx fields (Locations); staff_type select + "In training" badge (Staff); informational "Rx N"
  per-day label on the schedule grid; ceiling-vs-floor labels on the Compliance Record + Coverage Forecast.
- **Sustained-deficiency reframe:** `deficiencyStreaks` exposes `sustainedDeficiency`
  (`SUSTAINED_DEFICIENCY_DAYS = 3`, parameterized) instead of `boardReportTriggered`. Publish alert + forecast
  banner reworded to an internal manager heads-up — no "board report" language anywhere.
- **Nevada marketing rewrite:** `/nevada` now leads with **NAC 639.250** (current, enforced) + the inspection
  record; R072-25 is forward context only ("hearing June 2026; not adopted; updates automatically when
  passed"). `nevada-callout`, `vs/when-i-work`, layout meta, `features` all reframed. **Zero "R113-24"** in
  `app/ components/ lib/ supabase/` or the live help corpus. No hourly-doc mandate, no volume-enforcement
  claim.
- **Tennessee (rule confirmed, high confidence):** 6 non-certified techs per pharmacist, certified (CPhT/NHA
  ExCPT) uncapped — confirmed against Tenn. Comp. R. & Regs. 1140-02-.02 + two secondary sources. The engine
  already enforces this (shipped above). Corrected the `/states/tennessee` marketing page, which had a **wrong
  1:2→1:4 framing** that understated what TN pharmacies are allowed; the `/vs/when-i-work` row matches.
- **Help (migration 0033, applied):** rewrote the legacy `compliance-record` help article (per-location,
  as-worked, ceiling/floor, sustained-deficiency) and fixed stale "ratio zone" wording in five other help
  articles (zones were removed in 0018). Also cleaned R113-24 from three live `ratio_rule.notes` rows
  (onboarding template + two test tenants).
- **Demo (Mesa Vista):** R072-25 on; all retail; Spring Valley drive-through (compliant under the floor of 2);
  Tyler Brooks + Miguel Santos `tech_in_training`; expected Rx seeded. Two distinct, annotated current-week
  deficiencies: **ceiling** (Henderson Thu 2–4 PM, no pharmacist) + **floor** (North Las Vegas Tue 9–10 AM,
  solo pharmacist, no tech). Survives `--reset`.

### Schema
- Migration **0032** (R072-25 columns + enums) — applied. Migration **0033** (help refresh) — applied.

### Verification
- `tsc` clean · `vitest` 74/74 · `next build` clean · `--reset` → 3 deficient hours confirmed via
  `compliance_record.flag_type` SQL (1 floor, 2 ceiling).

### Open / review
- **R072-25 is proposed, not adopted** — only NAC 639.250 / CA BPC 4115 / TN 1140-02-.02 are claimed as
  current law. Nevada positioning + Terms/Privacy retention wording should get Susie/attorney review.
- Volume thresholds (Sec 2.2) are collect-only; never enforced.

---

## 2026-06-18 — The Compliance Record (as-worked) + compliance nomenclature across the product

The foundational fix: RxShift now produces a real **as-worked** Compliance Record — the immutable,
hour-by-hour record of what *actually* happened (who was on + counting, ratio met/not), distinct from the
schedule-derived projection. This makes the audit defensible and the website's existing claims true. No
change to the ratio math — the engine was already schedule-agnostic; this feeds it reconstructed actuals.

### Canonical vocabulary (now used product-wide)
- **Schedule** — the plan you build/publish.
- **Coverage Forecast** — projected hourly ratio from the *published schedule* ("are we scheduled to be in
  ratio?"). A planning aid. (This is the old `/app/log`, relocated to `/app/coverage-forecast`.)
- **Compliance Record** — the **immutable, hour-by-hour record of what actually happened**, 2-year retained,
  never edited, **annotatable** after the fact. The board-defensible artifact. (New, at `/app/log`.)
- **Activity Log** / **Override Log** — unchanged (change trail / acknowledged-exception reasons).

### Shipped
- **Data model (migration 0029, applied):** `compliance_record` (immutable; manager-select RLS, no
  insert/update/delete — written only by the finalizer via service role; unique per
  tenant/location/date/hour) + `compliance_record_note` (append-only annotations, mirrors
  `activity_log_note`).
- **Finalization engine** (`lib/compliance-record.ts`, pure + tsx-safe): reconstructs each completed hour's
  *actual* presence — published shift segments **split by each person's live-status history** (a non-counting
  status removes them for those minutes) — runs the existing `evaluateZone` + `generateComplianceRecord`, and
  writes immutable rows. **Idempotent** (only fills missing hours; self-heals missed runs). Reuses the engine;
  the only new logic is the segment-splitting (unit-tested). `appendComplianceNote` action mirrors the audit
  note pattern.
- **Cron** `/api/cron/finalize-compliance` (CRON_SECRET) + `vercel.json` **daily** (`0 9 * * *`). Hourly
  (`5 * * * *`) when on Vercel Pro — same code, just cadence (documented in the route).
- **UI:** `/app/log` is now the **Compliance Record** (reads the immutable table; per-hour deficiency +
  inline annotations + **+ Note** append; Save-as-PDF/CSV; "immutable, never edited" explainer). New
  `/app/coverage-forecast` holds the old as-scheduled view (relabeled "forecast"). Sidebar adds Coverage
  Forecast; dashboard/security-posture/override-log copy updated.
- **Demo (Mesa Vista):** the seed finalizes the elapsed week's as-worked record (266 hours) and **annotates**
  the actual Henderson Thursday 2–4 PM gap with the Patel family-emergency note — so the demo shows a real,
  immutable, annotated record. `compliance_record` + `_note` added to the reset clear list.
- **Copy:** help migration 0030 (applied) adds a "Compliance Record vs Coverage Forecast" article + corrects
  two articles; marketing overclaims fixed ("publish the schedule — the record exists" → "RxShift builds the
  record hour by hour"); features/nevada/vs-when-i-work/pricing aligned to "what actually happened."

### Schema
- `0029_compliance_record.sql` (**applied**), `0030_help_compliance_record.sql` (**applied**),
  `0031_help_record_casing.sql` (**applied** — capitalizes "Compliance Record" across all help articles).

### Naming sweep (follow-up, same day)
- Standardized **"Compliance Record"** across all surfaces: marketing (hero, features, nevada,
  nevada-callout, vs/when-i-work, pricing, layout meta), product (sidebar, dashboard, security-posture,
  reports card, publish modal, settings/onboarding copy), legal (terms/privacy), and **all help articles**
  (migration 0031). Fixed the wrong synonym "compliance log" everywhere. The **Reports xlsx export** now
  pulls the **as-worked** Compliance Record (`compliance_record`) instead of the publish-time snapshot.
- Demo guide gained a **"What changed June 18 — refresh checklist"** (new Compliance Record/Coverage
  Forecast beats, the seeded as-worked record, and the **stale `compliance-record.jpg` to recapture**).

### Verified
- `tsc` clean, **55/55** vitest (5 new for the reconstruction/segment-splitting), `next build` clean.
- `--reset` reproduces 266 finalized hours + the 2 annotated Henderson deficient hours (confirmed via SQL).
- Cron tested locally: run 1 recorded 79 hours (other ratio tenants), run 2 recorded **0** (idempotent).
- Browser (Mesa Vista, manager): `/app/log` shows the immutable record with Henderson Thu 14:00–15:00
  **deficient (no pharmacist)** + Frank DiMaggio's appended annotation; `/app/coverage-forecast` shows the
  as-scheduled projection; sidebar/nav use the new names.

### Open / flags
- **Legal/regulatory copy:** Terms/Privacy 2-year-retention + R113-24 language is now accurate to the real
  record, but should get Susie/attorney review before the push publishes.
- **Hourly cadence** needs Vercel Pro (daily until then — the record is retrospective, so defensible).
- **"Actual" is inferred** (schedule + live status), not punched clock-in/out; annotations correct edge
  cases; slot-granularity (30-min) on sub-slot status changes; overnight-shift live overlay is a v1
  limitation. Clock-in/out is a future enhancement.
- Optional: a final marketing pass to standardize remaining "compliance log" synonyms → "Compliance Record."

---

## 2026-06-18 — Demo Fixes v2 (six fixes) + compliance "as-worked" finding (design only)

Second demo-debrief pass (live walkthrough with Susie). Six code/data fixes + a flagged compliance-architecture
finding written up for review (no compliance code this pass). All seed/data survives `--reset`.

### Shipped
- **Emulation shows the real name.** Emulating an owner with no staff record (Frank) showed "unlinked user";
  `lib/auth.ts` now falls back to `app_user.display_name` → banner reads "Viewing … as Frank DiMaggio
  (owner_admin)". (display_name was added in 0028 last pass.)
- **Empty-week Publish button fixed.** A week with nothing scheduled showed a green **"Published ✓"** button
  (the code treated "no drafts" as "published"). Now it's a disabled **"Publish"** unless a published period
  actually exists; the "Nothing scheduled here yet" pill was already correct. (`schedule-matrix.tsx`)
- **Ask AI works on empty weeks.** The bar was hidden when no period covered the week and the action
  hard-required a period. Now `app/app/(shell)/schedule/page.tsx` mounts it whenever a working location exists
  (passing `periodId|null` + `locationId` + `refDate`); `lib/actions/ai.ts` simulates against an in-memory
  window bundle and **materializes the real period only at apply** via the now-exported `ensurePeriodForDate`.
  "Schedule Dr. Fitzgerald Mon–Fri 9–5" on a blank week proposes + validates + creates on confirm.
- **Ask AI: accurate edits + before/after + deficiency ack.** Added an **`edit_shift`** op (extend/shorten/
  move). The LLM prompt now lists each shift with **staff name + weekday** (it was mis-mapping staff UUIDs,
  which caused the "extend Patel's Thursday shift → wrong times" bug). Proposals now show a **deterministic
  before→after line computed from the data** ("Dr. Sunita Patel · Thu Jun 18: 09:00–14:00 → 09:00–16:00") +
  the engine check; if an edit **adds** a deficiency, a confirm checkbox is required (warn, never block).
- **Step-away indicator gated.** `/app/me` showed "can I step away?" even after a pharmacist set a
  non-counting status; now only shown while the current status counts (`me/page.tsx`).
- **Seeded demo emails.** The email log had no current mail; seeded 3 branded, current-week emails (schedule
  published → Jerome, deficiency alert → Frank, PTO approved → Ashley). Extracted the pure template to
  **`lib/email-template.ts`** (no `server-only`) so the tsx seed can build branded HTML; `lib/email.ts`
  re-exports it. `email_log` added to the demo clear list (scoped by tenant).

### Compliance finding (DESIGN ONLY — no code)
- Confirmed the compliance record at `/app/log` is **as-scheduled, not as-worked** (regenerated from the
  *published* schedule; live status never writes it). That proves intent, not adherence — not a defensible
  audit. Per Jamison: ship the fixes now, **write the design** and validate the regulatory shape with
  Susie/the Board before building. New **`docs/specs/as-worked-compliance.md`** (Proposed) + a `decisions.md`
  entry. DEMO-GUIDE + FEATURE-MAP corrected to call `/app/log` a forecast and retire the "the second you
  publish, the record exists" line.

### Schema
- None (no migration). `email_log` + `app_user.display_name` already exist.

### Verified
- `tsc` clean, **50/50** vitest, `next build` clean. `--reset` run; emails confirmed via SQL (3 branded,
  current-week). Browser (Claude in Chrome, jamison platform admin emulating): Fix 1 banner "Frank DiMaggio";
  Fix 2 empty week shows disabled "Publish"; Fix 3 Ask AI proposes 5 Fitzgerald shifts on a blank week; Fix 4
  "extend Patel's Thursday to 4pm" → "09:00–14:00 → 09:00–16:00, ✓ removes 4 deficient slots"; Fix 5 step-away
  line disappears after switching Patricia to Lunch. (No AI proposals were applied — demo data left pristine;
  emulation/demo-clock state restored.)

---

## 2026-06-18 — Demo QA fixes: override actor name, acknowledged exception inline, overtime amber ring

Three defects found when CoWork dry-ran the demo against the live build. All fixed in the seed
script / engine / shared resolution code so they survive `npx tsx scripts/seed-mesa-vista.ts --reset`.

### Shipped
- **Override "who" shows a real name.** The Override Log and the Compliance Record resolved an
  action's actor from the linked staff member; an owner_admin with no staff record (Frank DiMaggio,
  the Mesa Vista demo owner) fell back to the raw role string `"owner_admin"`. Added an optional
  `app_user.display_name`, set Frank's to **Frank DiMaggio** in the seed (idempotently, so it sticks
  across a reset that preserves his account), and made both resolution sites fall back
  staff name → `display_name` → role. Also rewrote the seeded override **reason** to the demo
  narrative (Dr. Patel family emergency; float held at Spring Valley until 4 PM; single isolated day).
- **Acknowledged exception now shows on the Compliance Record.** The seed linked the override to a
  human-readable string (`"<date> 14:00-16:00 Henderson"`) instead of the Henderson current-week
  **period id**, so `/app/log`'s `override_log WHERE target_id = periodId` matched nothing and the
  existing "Acknowledged exceptions" section never rendered. The seed now captures and links the
  Henderson current-week period id. Added an inline **⚠ Acknowledged exception (actor): reason** line
  on each deficient compliance row (and in the printed PDF), so the "why" sits with the specific
  deficient hours, not only in the section/Override Log.
- **Overtime renders amber, not red.** `lib/engine/constraints.ts` emitted `overtime` / `hour_cap`
  flags with `shift_id: null`, so the schedule grid (which rings only shifts carrying a `shift_id`)
  never showed the amber constraint ring — the only ring on Jerome's row was the red Thursday ratio
  deficiency. New `accumulateHours` helper sums paid hours chronologically and names the **tipping
  shift** (the one that crosses the threshold); the flag now carries that `shift_id`. Jerome's 43h
  week now shows an **amber** ring on **Saturday** (the tipping shift, not deficient), while his
  Thursday keeps the **red ⚠** ratio-gap ring — both visible at once. Flag count unchanged (1/week).

### Schema
- **Migration `0028_app_user_display_name.sql`** — `app_user.display_name text` (nullable). **Applied**
  to the RxShift Supabase. Staff-linked users are unaffected (staff name still wins).

### Verified
- `tsc` clean, **50/50** vitest pass (constraint tests assert length/type/message/date, not `shift_id`),
  `next build` clean. Demo reset run; data confirmed via SQL (Frank's name + override→Henderson period
  link). Browser (Claude in Chrome, Mesa Vista, signed in as Frank): Override Log shows Frank DiMaggio +
  the new reason; the Henderson Jun 15–21 Compliance Record shows the Acknowledged exceptions section
  AND the inline cue on both deficient Thursday 14:00–16:00 rows; the Henderson week schedule shows
  Jerome's Saturday amber ring with the Thursday red ⚠ still present.

### Notes
- The request-impact diff (`lib/actions/requests.ts`) keys on `staff_id|rule_id|date|message`, not
  `shift_id`, so naming the tipping shift doesn't affect approval-warning de-duplication.

---

## 2026-06-17 — Demo-debrief hardening (Phase 9): living demo docs

- **`docs/DEMO-GUIDE.md`** — the accurate, single source for running a demo: pre-demo checklist (login,
  reset, demo clock, AI key), the story, a **screen-by-screen walkthrough with correct facts** (live
  statuses live on the **Live Board / My Schedule**, NOT the dashboard — the mistake that drifted the old
  script), the built-in Henderson deficiency story, the Mesa Vista data summary, reset behavior, and honest
  known-limitations.
- **`docs/FEATURE-MAP.md`** — every route × what it does × who sees it (management + platform-admin + kiosk),
  plus the compliance-engine summary. The at-a-glance index.
- **`CLAUDE.md`** — added a "Demo-debrief hardening (June 17)" summary of all 9 phases (migrations
  0024/0025/0027 applied; new route `/app/log/audit`) and a documentation-discipline entry to keep
  DEMO-GUIDE + FEATURE-MAP current.

---

## 2026-06-17 — Demo-debrief hardening (Phase 8): "Team this week" → "Who's on this week"

- Redesigned the My Schedule team block (`app/app/(shell)/me/page.tsx`) from a flat run-on list into a
  clean, **day-grouped read-only** view of who's on at the person's home location over the next 7 days —
  today highlighted, each teammate with their hours (name left, time right), legible on a phone. Empty days
  are omitted. No editing — coverage awareness only.

---

## 2026-06-17 — Demo-debrief hardening (Phase 7): "Ask AI" restored on the schedule

### Shipped
- **The natural-language command bar is back**, relabeled **Ask AI** and mounted on the schedule
  (`app/app/(shell)/schedule/page.tsx`). It was unmounted June 15 because it was period-bound and the
  schedule went window-based; now the page resolves the period covering the current week for the working
  location (the selected location pill, or the first) from the data it already loads, and binds the bar to
  it. Switching the location pill changes the AI's scope; a context note shows "Working in {location} · {week}".
- **Full scope, unchanged intelligence** (`lib/actions/ai.ts`, all intact): ask questions answered from the
  live schedule ("is anything non-compliant coming up?", "who's short Thursday?"), and propose changes —
  create recurring shifts (PTO-aware, date-clamped), reassign, delete, add availability constraints. Every
  proposal is **simulated through the deterministic engine** and shown ("✓ removes 2 deficient slots / ⚠ adds
  1") before the manager confirms. AI never commits a ratio decision on its own.

---

## 2026-06-17 — Demo-debrief hardening (Phase 6): demo clock (after-hours demos) + departments

### Shipped
- **Demo clock — after-hours demos work.** `nowInTimeZone(tz, overrideMinutes?)` (`lib/dates.ts`) gained a
  demo-only override; `demoClockMinutes()` parses a tenant's `demo_clock` ("HH:MM"). Threaded through every
  presence surface (`lib/board-data.ts`, `lib/live-board.ts`, `app/app/(shell)/me/page.tsx`,
  `lib/actions/me.ts`): when set on a **demo tenant**, "now" is pinned to that time of day on today's real
  date, so a walkthrough at 9pm still shows staff on shift. Real tenants pass nothing → true clock. Toggle in
  the Admin Console per demo tenant ("Pin time" / "Use real time"); action `setDemoClock` (`platform.ts`).
- **Departments in Mesa Vista.** The demo seeded zero departments, so the feature was undemoable. Now seeds
  four tenant-level departments (Retail Counter, Compounding, Specialty, Drive-Thru) and tags every shift via
  a per-person map, so the schedule's department filter shows a real, varied roster. (Departments are area
  tags — they don't affect the ratio, unlike work types.)
- **Reset robustness.** `clearMesaVistaData` now clears `activity_log_note` explicitly (also cascades from
  `activity_log`) so a restore is clean with the new Phase-4 table.

### Schema
- **Migration `0027_demo_clock.sql`** — `tenant.demo_clock text` (nullable). **File written; pending apply on
  go-ahead.** Code is safe without it (an undefined column reads as null → real clock); the toggle needs it.

### To see departments
- Run **Restore demo data** (Admin Console) or `npx tsx scripts/seed-mesa-vista.ts --reset` — departments
  appear after a re-seed.

---

## 2026-06-17 — Demo-debrief hardening (Phase 5): work types vs departments — rule documented + staff self-change

### Shipped
- **Counting precedence documented** at the source (`lib/engine/ratio.ts` `segmentCounts`) and in-app on
  Settings → Work types: a person counts only when their work type / role default says count **and** their
  live status counts; a **non-counting work type always wins** (a tech on Inventory never counts, whatever
  their status). Confirms Jamison's assumption. Also spelled out work types (shift-level, affect ratio) vs
  departments (optional area tag, don't affect ratio).
- **Staff self-change work type in real time** (`lib/actions/me.ts` `setMyWorkType` + new
  `components/app/me/my-work-type-picker.tsx` on My Schedule). A tech/RPh switches their current work type
  on the floor; the segment covering "now" is **split at now** (history preserved — what they were doing
  stays; the new type applies going forward), and the live board + My Schedule update immediately. Writes go
  through the service client but only after verifying the shift is theirs and the work type is their
  tenant's. Audit-logged.
- Managers' in-advance path (split a shift into per-segment work types in the shift editor) verified — no
  change needed; the self-service picker is the ad-hoc complement.

### Notes
- No migration: staff may self-select any of the tenant's work types (a curated "self_selectable" subset
  was considered and deferred — not needed for v1).

---

## 2026-06-17 — Demo-debrief hardening (Phase 4): audit log + append-note, override↔compliance, official PDF

Makes the compliance story auditor-credible: a comprehensive immutable audit log you can annotate (never
edit), and a compliance record/PDF that carries the "why" behind any deficiency.

### Shipped
- **Audit Log view** (`/app/log/audit`, manager-only by RLS): the full append-only `activity_log` — when,
  who, action, and (for overrides) the logged reason. New sidebar item under Compliance. Clarifies the
  distinction in-app: Audit Log = comprehensive action trail; Compliance Record = hourly staffing record.
- **Append-note (HARD RULE preserved).** Entries are never edited or deleted; a manager can **append** a
  note (e.g. "RPh forgot to clock back from lunch; corrected"). Notes live in a separate append-only table
  and are attributed + timestamped. Action `appendActivityNote` (`lib/actions/audit.ts`); the annotation is
  itself audit-logged.
- **Override → compliance link.** The compliance record now shows an **Acknowledged exceptions** section —
  the override reasons for that period (who/when/why) — and it prints. The Override Log page now labels each
  override (Schedule publish / Time-off approval / Swap approval) and shows who.
- **Official, non-editable export.** The compliance record's print view gained an official document header
  (tenant, record title, period) and includes the acknowledged-exceptions section, so "Save as PDF
  (official record)" produces a non-editable PDF carrying the override context. CSV relabeled "Export CSV
  (data)". Chose browser print-to-PDF over serverless Chromium (reliable on Vercel, no heavy dependency).

### Schema
- **Migration `0025_activity_log_notes.sql`** — `activity_log_note` (append-only: select + insert policies
  for managers, no update/delete). **File written; pending apply to Supabase on Jamison's go-ahead.** The
  Audit Log view works now; adding/showing notes needs the table.

---

## 2026-06-17 — Demo-debrief hardening (Phase 3): request/approval/swap/callout warnings + required reasons

Compliance impact is now shown *before* a request is acted on, and a manager who approves something that
creates a ratio deficiency must enter a reason that is logged. Warn, never block.

### Shipped
- **Pre-check engine** (`lib/actions/requests.ts`): `computeTimeOffImpact` / `computeSwapImpact` reuse the
  real validation engine — load every location's shifts over the affected window, validate as-is, then
  validate again with the request **simulated** (person removed for PTO; shifts reassigned for a swap). New
  flags = what the approval would introduce. Exposed as server actions `previewTimeOffImpact` /
  `previewSwapImpact` / `previewCalloutImpact` (any member; RLS already lets members read tenant shifts).
- **Manager approval gate.** Approving a PTO or swap now opens a confirmation showing the specific impact;
  if it creates a **ratio deficiency**, a reason is **required** and written to `override_log`
  (`target_type` 'time_off' / 'swap'). `decideTimeOff` / `decideSwap` re-compute the impact server-side and
  enforce the reason (can't be bypassed from the client). The reason is also recorded in the activity log.
- **Employee visibility.** The PTO request form shows "approving this would create N deficient slot(s)…"
  once dates are filled; the callout form shows the resulting ratio gap when a shift is selected (callouts
  are facts, so they log either way — no reason gate).
- **Swaps populate `ratio_effect`.** The long-unused `swap_request.ratio_effect` column is now filled at
  peer-accept and at manager decision, and the approver's email states the swap's ratio effect.

### Schema
- **Migration `0024_override_request_targets.sql`** — widen `override_log.target_type` check to include
  `time_off` / `swap` / `callout`. **File written; pending apply to Supabase on Jamison's go-ahead.** The
  deficiency-approval path needs it; non-deficiency approvals work without it.

### Open
- Proposer-side swap visibility (the manager gate + email already cover the risk).

---

## 2026-06-17 — Demo-debrief hardening (Phase 2): dashboard interactivity + one flag vocabulary

### Shipped
- **Every dashboard headline is now actionable.** `StatCard` (`components/ui/card.tsx`) takes an optional
  `href` and renders as a hover-highlighted link. On `/app/dashboard`: **Deficient slots** → the schedule
  anchored to the first deficiency's location + week; **Open flags** → the schedule at the first constraint
  flag's week; **Pending requests** → `/app/requests`; **Current period** → the schedule for that period.
  Each **Insight** now carries a deep link too (deficiency / recurring-gap insights jump straight to the
  offending slot). Previously only the Quick-Action links navigated.
- **One flag vocabulary** (`lib/flags.ts`): a single documented definition — a *flag* is a **ratio** issue
  (slot non-compliant / at the limit) or a **constraint** issue (hours / availability / double-booking) —
  plus shared link builders (`scheduleHref` / `ratioFlagHref` / `constraintFlagHref`) so wording and
  click-through are consistent. Wired into the dashboard + insights; available for the board/compliance.

### Open
- A scroll-to + flash highlight of the exact cell on the schedule grid (deep link lands on the week +
  location today; the deficient block is already marked red ⚠).

---

## 2026-06-17 — Demo-debrief hardening (Phase 1): real-time schedule propagation

First phase of the post-demo hardening plan (`/plan` approved; full plan covers 9 phases — flags,
dashboard interactivity, request warnings, audit/compliance/PDF, work types vs departments, demo-data
rebuild + demo-clock, "Ask AI" restore, Team-this-week, living docs).

### Shipped
- **Schedule changes now propagate live.** The bug: extending a shift (e.g. Dr. Nguyen +60 min) never
  updated "My Status Now" — the shift-mutating actions only revalidated `/app/schedule`. Added a shared
  `revalidateScheduleViews()` (`lib/actions/helpers.ts`) that revalidates every schedule-derived view
  (`/app/schedule`, `/app/me`, `/app/board`, `/app/display`, `/app/log`, `/app/dashboard`) and wired it
  into `upsertShift` / `deleteShift` / `copyForward` / `publishPeriod` / `copyForwardWindow`
  (`lib/actions/schedule.ts`) and the shift-mutating approvals `decideTimeOff` / `decideSwap`
  (`lib/actions/requests.ts`).
- **My Schedule self-refreshes.** New `components/app/auto-refresh.tsx` (a tiny client poller, ~45s,
  mirrors the Live Board's pattern) mounted on `/app/me` so an open page (e.g. a pharmacist's phone)
  picks up a manager's change without a manual reload.
- **My Schedule timezone bug (root cause of the demo "off shift" symptom).** Found while testing: even
  after the revalidation fix, `/app/me` still read "off shift" in the evening while the Live Board
  correctly showed the person working. Cause: the page used the **UTC** date (`todayStr()`) as the shift
  query's lower bound, but derived presence from the **tenant-tz** date. After ~5pm Pacific (next-day
  UTC), today's shift was filtered out of the query entirely. Fixed `app/app/(shell)/me/page.tsx` to use
  one tenant-tz "now" (`nowInTimeZone(tenant.timezone)`) for the query bounds, the calendar, the team
  week, and the presence check — matching the Live Board.

### Open
- True sub-second cross-device push (Supabase Realtime) deferred — revalidate + poll covers the demo.
- Phases 2–9 of the plan still to build (test as needed between phases).

---

## 2026-06-17 — /about team page (unlinked draft) + softened homepage pilot-pricing note

- **`/about` (`app/about/page.tsx`)** — two-founder team page (navy hero, two bio cards with treated
  circular photos, navy CTA strip). **Deliberately NOT linked** from nav or footer, and `noindex` —
  an internal-review draft reachable by direct URL only. Photos at `public/images/team/{susie,jamison}.jpg`
  (build-safe initials fallback if absent). Shared `.team-photo` CSS (grayscale 20% + contrast 1.08 +
  navy multiply overlay) applied to both. Reuses the `Card` component + brand tokens.
- **Homepage pilot note** (`components/pricing-signal.tsx`): replaced "Pilot participants receive early
  pricing. Talk to us before rates are published." with "Currently piloting with Nevada pharmacies.
  Schedule a walkthrough to discuss pricing for your group." (same amber treatment; "See pricing
  details →" unchanged).
- Photos: Susie's drop-in worked as-is; Jamison's was a wide full-upper-body shot, so it was cropped
  to a face-centered 480×480 square and saved as `jamison-headshot.jpg` (~23 KB) so it sits in the
  circle like Susie's (a distinct filename also avoids a stale-cache collision with the earlier photo).
- Note: the /about CTA links to **`/#demo`** (the homepage's actual schedule anchor; there is no `#schedule`).

---

## 2026-06-17 — Website: "can I step away?" story + headroom GIF; Mesa Vista staffed up; PWA install fix

Marketing + demo-data update showcasing the new ratio-headroom feature, plus the PWA install fix.

### Shipped
- **Homepage "Know who can step away — without breaking ratio" band**
  (`components/live-board-showcase.tsx`): reframed the live-board section around the headroom feature —
  pain-point copy (no mental math / no group chat), a new GIF, and a one-line mobile note ("staff set
  their status from their phone — no computer needed").
- **New headroom GIF** (`scripts/capture-screenshots.ts` rewritten): on the chrome-free wall display
  for one Spring Valley card, a pharmacist steps away and the "✓ N pharmacists can step away" line
  counts down to the limit and recovers (driven via the service client; the pharmacist is restored
  afterward). Refreshed all four marketing JPGs too. **Fully fictional Mesa Vista — no real customer
  data on the site, ever.**
- **Mesa Vista demo staffed up** (`lib/demo/mesa-vista.ts`): added a third Spring Valley pharmacist
  (fictional Dr. Lena Park) so a location has genuine ratio headroom — the website *and* the live demo
  can show the positive "you can step away." Henderson's deficiency story unchanged. Reseeded (15 staff).
- **PWA install fix** (`proxy.ts`): the manifest + home-screen icons were being rewritten to /app and
  bounced to /login on app.rxshift.io; added them to the proxy's static-asset allow-list so "add to
  home screen" works on the app domain. (Committed earlier as 521cb39; ships in this push.)

### Infrastructure / data
- Mesa Vista demo reseeded with the added pharmacist (live demo data changed — intentional, fictional).

### Verified
- `tsc` clean, 50/50 tests, `next build` clean. Browser: the homepage band shows the headroom GIF
  ("✓ 1 pharmacist can step away") + copy + mobile line; the GIF animates step-away → at-limit →
  recover.

---

## 2026-06-17 — Mobile experience (focused) + "can I step away without breaking ratio?"

Two staff/pharmacist features. No schema changes; one help-content migration (0023) pending apply.

### Shipped — Mobile (focused, app-like)
- **Phone navigation.** The fixed sidebar is now desktop-only (`hidden md:flex`); on phones a **bottom
  tab bar** (`components/app/mobile-tab-bar.tsx`) surfaces the role's key destinations (My Schedule,
  Requests, + Dashboard/Live Board for managers) with a **More** sheet for the full nav. Content runs
  full-width with bottom padding for the bar; desktop collapse/reopen is gated to md+.
- **Desktop-only notice** (`components/app/desktop-only-notice.tsx`): a phone-only heads-up on
  build-heavy routes (schedule, settings, staff, reports, log, admin) — those aren't made
  mobile-friendly; My Schedule / Requests are the mobile experience.
- **Installable (PWA).** `app/manifest.ts` (standalone, start_url `/app/me`, scope `/app`) + viewport
  + appleWebApp meta + apple-touch-icon in `app/layout.tsx`; brand-mark PNG icons (192/512/180)
  generated by `scripts/generate-pwa-icons.ts`. Adds to the home screen as an app with no browser bar.

### Shipped — "Can I step away without breaking ratio?"
- Pure engine helpers in `lib/engine/ratio.ts` (`minPharmacistsFor`, `pharmacistHeadroom`,
  `wouldBreakIfOneLeaves`) + tests (50 total). `buildBoardView`'s LocationCard now carries `headroom`.
- **Live Board + wall display:** a per-location line — "✓ N pharmacists can step away and stay
  compliant" / "At the ratio limit — no pharmacist can step away right now."
- **My Schedule (pharmacist):** by the status buttons, a green/amber line on whether stepping away
  keeps their location in ratio; tapping a non-counting status that would break ratio shows a confirm
  (warn, never block). Techs / non-counting / off-shift → no indicator.

### Schema / migrations
- `0023_help_mobile.sql` — tenant Help article "Using RxShift on your phone." **Not yet applied** —
  apply via the supabase-rxshift MCP on Jamison's go-ahead (like 0022).

### Verified
- `tsc` clean, **50/50** vitest, `next build` clean (`/manifest.webmanifest` served). Browser (Claude
  for Chrome): at 390px the sidebar is gone, bottom tab bar + More sheet work, My Schedule is usable,
  a heavy page shows the desktop notice; desktop unchanged. Headroom verified on OptumRx (10 RPh /
  24 techs → "2 can step away") on the board and as the green banner on My Schedule.

### Open / future
- 0023 help article pending apply. Schedule builder / settings intentionally not mobile-optimized.
- Offline / service worker not included (install + standalone only).

---

## 2026-06-17 — Live Board: collapsible sidebar, wall-display (kiosk) mode, per-location status list

Three Live Board / app-shell improvements (Susie wants the board on an always-on wall monitor). No
schema changes; one help-content migration (0022) **pending application**.

### Shipped
- **Collapsible sidebar (app-wide).** A « button in the sidebar header hides the left nav completely
  (content goes edge to edge — more room for the schedule and board); a tab on the left edge brings
  it back. The preference persists via localStorage + a no-flash script (mirrors dark mode).
  `app/layout.tsx`, `app/globals.css`, `app/app/(shell)/layout.tsx`, `components/app/sidebar.tsx`.
- **Wall-display (kiosk) mode** at **/app/display** — a read-only, chrome-free board (no sidebar, no
  banners, no status controls) for an always-on monitor: large cards, `?location=<id>` to pin one
  site, a location switcher, an "updated" clock, a **Full screen** button, 30s auto-refresh. An
  **Open display** button on the Live Board header opens it in a new tab. New route group
  `app/app/(kiosk)/` + `display/page.tsx`; `components/app/board/{display-board,fullscreen-button}.tsx`.
- **Status board grouped by location.** The change-status list now groups people under a heading per
  location (card order) with an **Off shift** group last, so you can tell who's working where.
  Single-location pharmacies keep the simple flat list. `components/app/board/live-board.tsx`.
- **Refactor (no behavior change):** the board-building logic moved to `lib/board-data.ts`
  (`buildBoardView`) and the per-location card to `components/app/board/location-card.tsx`, shared by
  the in-shell board and the wall display so they can never diverge.

### Schema / migrations
- `0022_help_wall_display.sql` — adds one tenant-facing Help article ("Putting the live board on a
  wall display"). **Not yet applied to the RxShift Supabase** — apply via the supabase-rxshift MCP
  (or `db push`) on Jamison's go-ahead.

### Verified
- `tsc` clean, **45/45** vitest tests pass, `next build` clean. Browser (Claude for Chrome, Mesa
  Vista 3-location demo): sidebar collapse/reopen + persistence; status board grouped by location
  with an Off-shift group; /app/display renders chrome-free with large cards, location pin, and the
  Full screen button; "Open display" opens a new tab.

### Review fixes (pre-push, June 17)
- **Reopen button moved into the page header** (left of the title), where the collapse « lives — it
  was a left-edge tab at the vertical middle, which was hard to find and would overlap the trial/
  platform banners. Now a flow element in `PageHeader` (`components/app/sidebar-reopen-button.tsx`),
  shown only when collapsed.
- **Wall display fills the width.** A dense single location used only ~1/3 of the screen and needed
  scrolling; the large card's roster now flows into auto-fill columns and the cards grid goes
  full-width for a single location — everything fits without scrolling.
- **Feedback image upload no longer hangs.** A screenshot over Next's default 1 MB server-action body
  limit was silently rejected and the form stuck on "Sending…". Raised
  `experimental.serverActions.bodySizeLimit` to 6 MB (matches the action's 5 MB cap — **takes effect
  on deploy / after a dev-server restart**), added a client-side >5 MB guard, and wrapped submit in
  try/catch/finally so it always surfaces an error and re-enables the button.

### Open / future
- The wall display still requires the monitor's browser to be **signed in** (a no-login signed
  display-token URL is future work — see decisions.md).
- Proactive "about to go deficient" alerts on the display — future (relates to Build 2).

---

## 2026-06-16 — Tagline: "Built for pharmacists, by a pharmacist" on the homepage

- Added the credibility line **"Built for pharmacists, by a pharmacist."** as an amber sign-off in
  the homepage Problem section (right after "RxShift does."). Deliberately not the primary hero
  tagline — groundwork for a future Susie-led About page. `components/problem.tsx` only. No schema,
  no migrations.

---

## 2026-06-16 — Marketing homepage: real app screenshots (hero split, feature/Nevada imagery, live-board band)

Added real product screenshots to the marketing homepage (previously all text). Captured from the
local app with Playwright (banner-free via `?screenshot=true`), saved into the repo, and wired into
a restructured hero, the feature cards, the Nevada section, and a new live-board band. No schema, no
migrations.

### Shipped
- **Capture script** (`scripts/capture-screenshots.ts`, run via `npx tsx`): logs in
  programmatically as Frank (Mesa Vista owner_admin) via an admin magic link, temporarily clears
  Mesa Vista's branding so shots use RxShift's own brand (restores it after), and captures four
  1440×900 JPGs to `public/images/screenshots/` — schedule (all locations), compliance record
  (Spring Valley, compliant), dashboard (full-page so location cards show), and the live board. It
  best-effort also records a looping **`live-board.gif`** of the ratio recomputing when an on-shift
  tech is toggled to lunch (pure-JS encode: pngjs + gifenc, no ffmpeg).
- **Hero** (`components/hero.tsx`): centered → two-column split; the schedule screenshot on the
  right inside a browser-chrome frame (`components/browser-frame.tsx`). Copy/CTAs unchanged.
- **Feature cards** (`components/features.tsx`): each card gets a windowed screenshot header.
- **Nevada section** (`components/nevada-callout.tsx`): two-column with the compliance record inset.
- **Live-board band** (`components/live-board-showcase.tsx`): shows the GIF if present, else falls
  back to the static board screenshot (graceful — no broken state when the GIF isn't generated).
- `gifenc.d.ts` — minimal local types for gifenc (ships none).

### Infrastructure
- Dev deps added: `playwright` (+ chromium), `pngjs`, `gifenc`. No runtime/prod deps.

### Verified
- `tsc` clean, `next build` clean. Browser-reviewed on desktop + mobile widths (hero, feature
  cards, live-board band, Nevada all stack to one column on phones).

### Open
- **Live-board GIF — done.** Generated June 17, 2026 (~9:03 AM PT) by the scheduled re-capture (14
  frames, Carlos Rivera on shift at Spring Valley) and committed; the live-board band now shows the
  animated board instead of the static fallback. **Committed, pending push** (Jamison approves
  pushes). The schedule + board jpgs also refreshed to the current week.

---

## 2026-06-16 — Off-shift presence, delete-leads, co-branding lockup, email-log copy, screenshot mode

Post-demo-review polish pass. No schema, no migrations.

### Shipped
- **Off-shift presence (schedule-derived).** The live board + "My status now" no longer
  default everyone to "Working." Presence is derived from the **published** schedule: you're
  "on shift" only if a published shift covers right now (tenant tz). Off shift → shown as
  **"Off shift"**, not counted (no clock-in). Fixes an emulated staffer showing "Working"
  before their shift. Also: the board now uses **published shifts only** (drafts no longer
  count), and a `live_status` is honored only if it was set **today** (a stale "Lunch" from
  yesterday no longer lingers). `lib/live-board.ts` (shared with the alert cron),
  `board/page.tsx` + `live-board.tsx`, `me/page.tsx` + `my-status-picker.tsx`; new
  `dateInTimeZone` helper in `lib/dates.ts`.
- **Delete leads (platform admin).** `deleteLead` in `lib/actions/crm.ts` + a confirm-by-name
  Danger Zone on the lead detail page. Notes cascade; email-log audit rows are kept by design.
- **Co-branding lockup.** Sidebar now separates the RxShift mark from a tenant logo with a thin
  divider + height alignment (`Rx·Shift │ Pharmacy`) instead of two marks colliding.
- **Email-log empty state.** Clearer copy explaining the log fills as the app sends mail.
- **`?screenshot=true`** hides both the platform "viewing as" banner and the demo/trial
  sub-banner for clean marketing captures (client-side, URL-only, not persisted). Extracted the
  demo banner to `components/app/demo-banner.tsx`.

### Verified
- `tsc` clean, 45 tests pass, `next build` clean. Browser (Mesa Vista demo): only on-shift staff
  show "Working" — everyone off-shift shows "Off shift"; `?screenshot=true` removes both banners;
  co-branding divider renders. Not yet pushed (Jamison drives push).

### Next (assessed, awaiting greenlight) — Build 2
- **Proactive compliance notifications** (daily cron digest of upcoming scheduled deficiencies)
  + **append-only compliance annotations** (pharmacy explains a deficiency without editing the
  immutable record). See docs/decisions.md.

---

## 2026-06-16 — Centralized email + email log + deliverability/error detection + feedback + demo-safe chrome

One build (workstreams A–G). Migrations 0019 (email_log) + 0020 (feedback) applied.

### Shipped
- **One send path.** All app email — notifications, sign-in links, the website
  demo form, feedback, system alerts — now flows through a single `sendEmail()`
  core in `lib/email.ts` (branding + safety gate + Resend + logging). The three
  prior direct-to-Resend doors became thin wrappers. There is no other path out.
- **Email log (platform-admin).** New `email_log` table records every send —
  status (sent/suppressed/redirected/failed/delivered/bounced/complained),
  recipient, subject, and the **actual rendered HTML**. `/app/admin/emails` lists
  + filters them and renders each email exactly as it went out (sandboxed iframe);
  xlsx export at `/api/admin/emails`. App-sent emails are tagged to their lead and
  shown on the lead detail page.
- **Deliverability + system-issue loop.** New signed Resend webhook
  (`/api/webhooks/resend`) updates the log on delivered/bounced/complained and,
  with send failures, files a `source='system'` entry into the **same feedback
  inbox** users post to — so detected problems and reported ones live in one place.
  `lib/system-report.ts` (`reportSystemIssue`) is loop-guarded and de-duped.
- **Lean feedback feature.** A Feedback button in the sidebar footer (bug / feature
  / feedback + optional screenshot) → `submitFeedback` → `/app/admin/feedback`
  triage (filter by status/source/kind, set status + internal note). Screenshots in
  a private `feedback` bucket. Notifies platform admin via the central email.
- **Demo-safe admin chrome.** The PLATFORM nav (Admin Console, Leads, Emails,
  Feedback) is hidden while emulating a tenant, the "viewing as" banner is slimmed
  (kept, as the admin's safety signal), and the demo sub-banner no longer reveals
  the internal redirect address to a prospect.
- **Demo alerts → `hello@`.** The website demo-request email now defaults to
  `hello@rxshift.io` (env `CONTACT_TO_EMAIL`) — team-visible once the shared mailbox
  receives (infra step below).

### Schema
- `0019_email_log` (applied): email_log; RLS enabled, no policies (service-role).
- `0020_feedback` (applied): feedback (source user|system); RLS enabled, no
  policies; private `feedback` Storage bucket.

### Infrastructure / config (see INFRASTRUCTURE.md + closeout)
- New env vars: `RESEND_WEBHOOK_SECRET` (webhook signature), `CONTACT_TO_EMAIL`
  (demo-alert recipient; defaults to hello@), optional `PLATFORM_ADMIN_EMAIL`
  (system/feedback alerts; defaults to jamison@jamisonwest.com).
- Manual: configure the Resend webhook endpoint; add the Cloudflare `hello@`
  forwarding rule so the shared mailbox receives demo alerts.

### Verified
- `tsc` clean, 45 vitest tests pass, `next build` clean, migrations applied + confirmed.
- **Deployed to production + verified end-to-end (June 16):** webhook route live with
  signature verification active (unsigned POST → 401); a live demo-form submission
  created a CRM lead + a logged email with the rendered body, and the Resend webhook
  updated it to `delivered`; admin email-log + feedback pages and the feedback modal
  confirmed in-browser; demo-safe chrome (Platform nav hidden while emulating) confirmed.
- **Config completed (June 16):** `RESEND_WEBHOOK_SECRET` set + webhook verified live;
  `CONTACT_TO_EMAIL` set to `hello@rxshift.io`; Cloudflare routing rule
  `hello@rxshift.io → hello@jamisonwest.onmicrosoft.com` Active. Verified end-to-end:
  app demo-alerts AND external mail to hello@ both land in the RxShift shared mailbox;
  everything else still forwards to Jamison's personal inbox.

---

## 2026-06-16 — Brand email: M365 shared mailbox + DKIM/SPF (infra, no app code)

Set up `hello@rxshift.io` as a real branded sending identity and documented the whole
email flow. No app code changed this session — infra + docs only.

### Infrastructure (Microsoft 365 / Cloudflare)
- **`hello@rxshift.io` shared mailbox** in the jamisonwest.com tenant with Send As +
  Full Access (Jamison) and shared Sent Items (`MessageCopyForSentAsEnabled`). Replaces
  a rejected alias approach (alias send-as is desktop-broken and shows the primary addr).
- **Authenticated rxshift.io for M365 sending:** root SPF now includes
  `spf.protection.outlook.com`; M365 **DKIM** enabled (two `selector{1,2}._domainkey`
  CNAMEs → `…jamisonwest.p-v1.dkim.mail.microsoft`). Verified: Gmail shows
  `hello@rxshift.io`, no "via onmicrosoft.com." Resend's `send.rxshift.io` SPF/DKIM left
  intact (separate sender).

### Docs
- `INFRASTRUCTURE.md` email section rewritten: shared-mailbox setup, full **email-flow
  map** (app/Resend vs M365, inbound/outbound, demo-request crossover), reporting model,
  and a now-vs-later cost/scaling table. DNS table updated with DKIM + new SPF.
- `docs/decisions.md`: shared-mailbox-over-alias rationale + the two-stream model (MS
  prohibits BCC-archiving into a shared mailbox) + deferred items.

### Open (next build — moving to plan mode)
- In-app `email_log` table + admin report (durable record of every Resend send).
- Route the demo-request alert to the `hello@` shared mailbox (team-visible).
- Make the shared mailbox *receive* (send-only today); paid seats for Susie/RT when needed.

---

## 2026-06-15 — Punch list: expandable flags, approve-executes-request, staff self-service, logo upload

Follow-on pass after the schedule rebuild (commits 6a8ad97 → 7835867).

### Shipped
- **Schedule flags expand again.** The flag summary in the matrix toolbar is a
  button that opens the full flag list in a bounded modal (the rebuilt matrix had
  collapsed it to a non-expandable count).
- **Approving a time-off request now executes it.** On approval, `decideTimeOff`
  deletes the person's shifts inside the approved window so they actually come off
  the schedule (manager sees the gap and backfills); PTO then overlays those days.
  Previously an approved request left the person still scheduled.
- **Staff self-service photo.** `/app/me` gained a "Your photo" card. Avatar upload
  was reworked from a browser-client + RLS write into a single `uploadAvatar` server
  action (service role, self-or-manager authorization) so it also works under
  platform-admin "viewing as." Light/dark toggle and self request-submission already
  existed on the staff-facing surface.
- **Tenant logo file upload.** Branding settings now accept a logo file (not just a
  hosted URL): `uploadLogo` server action → private `avatars` bucket → 1-year signed
  URL stored in `branding.logo_url`, preserving the accent color. One accent color +
  logo is the confirmed branding depth (no secondary color).

### Email (investigated — no change needed)
- Traced "I approved a request but no manager email arrived." The code is correct:
  `submitTimeOff`/`logCallout` email every approver through the safety gate, and
  **both demo tenants already deliver.** Mesa Vista (`is_demo`) redirects all email
  to `mesa-demo@rxshift.io` → rxshift.io catch-all → Jamison. OptumRx Demo allowlists
  `jamison@jamisonwest.com`, `dr.monahan@yahoo.com`, `susie.monahan@optum.com`. Its
  only approver is Susan Monahan West, whose work email `susie.monahan@optum.com` is
  allowlisted — so the submission email **sends to Susie's real Optum inbox**, which
  is why Jamison didn't see it. To watch the email flow himself, demo on **Mesa
  Vista** (routes to his catch-all). Changing OptumRx routing is a deliberate
  decision (Susie is a real co-founder/buyer) — left as-is pending Jamison's call.

### Schema / Infrastructure
- None (reuses the `avatars` bucket from the rebuild pass).

---

## 2026-06-15 — Schedule rebuild: per-location ratio, unified matrix, departments, filters, avatars

Large pass (commits d0fdc06 → b95b2bf). Supersedes the scroll "condense" shipped
earlier the same day.

### Shipped
- **Ratio is per LOCATION; ratio zones removed entirely.** Everyone counting at a
  location counts together — the "ratio zone" sub-location was a modeling mistake.
  An isolated room is now just a separate location. The engine was already
  zone-agnostic, so this is mostly grouping by location instead of zone
  (validateBundle, buildComplianceRecords, live board, alert cron, reports, AI
  command, callout gap). Added a cross-location **double-booking** check.
- **Departments are tenant-level** (shared, not bound to a location), an optional
  tag on a shift, and a view filter. New tenant setting **"require a department on
  every shift"** (toggle in Settings → Locations & Departments). SPC Compounding
  became a department.
- **Unified, person-centric schedule matrix** is the new home. One grid across all
  locations: staff down the left, each shift tagged with its location. **All
  Locations is where you build**; selecting a location (or a department/work-type)
  is a **view filter** that shows only the matching, scheduled staff. The old
  per-location builder, the range view, and the "Edit period" mode are gone.
- **Periods are invisible plumbing.** Scheduling into a week with no period
  auto-creates the cycle-aligned period (ensurePeriodForDate; upsertShift no longer
  needs a period id). The All-Locations toolbar has **Publish** (publishWindow —
  every draft in the window, or just the filtered location), **Copy last week's
  pattern** (copyForwardWindow), and **Export CSV**. Creating a shift offers a
  **Location picker**. A status pill shows Published / Draft so you always know if
  you're looking at an active schedule or a draft.
- **Fixed-frame scroll** replaced the janky scroll-driven condense: compact header,
  the grid is the single scroll region (sticky day header, frozen staff column,
  horizontal scrollbar always reachable).
- **View filters:** department (single) + **work-type chips (multi-select)** —
  "show only Hospice Shift". (Group-by is covered by these filters for now.)
- **Staff avatars:** 1:1 crop (react-easy-crop) → 400px webp → private avatars
  Storage bucket (manager-only RLS) → shown as rounded squares in the staff list,
  the staff editor, and in front of every name in the schedule. Display via
  short-lived signed URLs.

### Schema
- `0018_per_location_ratio` (applied): drop ratio_zone (table, FKs, RLS); re-point
  compliance_snapshot + live_ratio_alert_state to location; department tenant-level
  (drop location_id); add tenant.require_department + staff.avatar_path; create
  private `avatars` Storage bucket + tenant-scoped RLS.

### Infrastructure
- New private Supabase Storage bucket `avatars` (tenant-scoped paths
  `{tenant}/{staff}-{ts}.webp`; manager-only writes; signed-URL reads).
- New dependency: `react-easy-crop`.

### Open
- **Publish UX** — Jamison has a question about the Publish button (TBD).
- **AI command bar** was removed from the schedule (it was period-bound); re-add
  bound to the window/all-locations later.
- **Multi-state / per-location ratio rules** deferred (one tenant rule today) —
  revisit when a cross-state prospect appears (see decisions.md).
- Real-photo avatar upload should be exercised by a normal manager login to confirm
  the storage RLS path end-to-end.
- Per-column published/draft tint (from the old range view) not carried into the
  matrix; the toolbar status pill covers it for now.

---

## 2026-06-15 — Schedule scroll fix: sticky header, reachable horizontal scrollbar, condensing chrome

### Shipped
- **Sticky day header + always-reachable horizontal scrollbar (the core fix).** The schedule grid is now a height-capped, internally-scrolling region (`overflow-auto` + a runtime-measured `max-height`). Previously the grid had no height cap and the whole page scrolled — and because `overflow-x` makes the box a scroll container on *both* axes, the `sticky top-0` header stuck to a box that itself scrolled off-screen, and the horizontal scrollbar lived at the bottom of a full-height box far below the viewport. Capping the height fixes both: the header stays pinned, the staff column stays frozen, and the horizontal scrollbar sits at the visible grid's bottom edge. (`components/app/schedule/schedule-grid.tsx`)
- **Condensing top chrome → slim strip (editor).** As you scroll the grid, the location/view pills, AI command bar, period toolbar, and open-flag list condense to one slim pinned strip — `Location · Period · Draft/Published · ⚠ N flags`; click it to bring the full controls back. Chrome is hidden via CSS (not unmounted) so the AI-bar input survives. Reclaims vertical space for the grid; grid height recomputes via a `ResizeObserver` on `document.body`. (`schedule-builder.tsx`, with the chrome now passed in from `schedule/page.tsx`.)
- **All-locations overview** got the same sticky-header + reachable-scrollbar fix per location section (`overflow-auto` + `max-h`, switched the table to `border-separate` so sticky cells work in Chrome, made the date header + corner sticky). (`all-locations-overview.tsx`)
- The week / 2-week / month views inherit the grid fix automatically (shared `ScheduleGrid`); condense is editor-only.

### Open
- UI/layout only — no schema, API, auth, or dependency changes.
- Verified in-browser (Mesa Vista/OptumRx demo tenant, dark mode): header sticks, scrollbar always reachable, condense/expand cycle, frozen staff column, all-locations sticky header. Clean: `tsc`, 45 vitest tests, `next build`. No new console errors (the remaining `<html>` hydration warning is the pre-existing dark-mode no-flash script — fires on every page, not from this change).

---

## 2026-06-15 — Docs: infra fingerprint moved to the C:\dev master doc

### Infrastructure
- Adopted `C:\dev\INFRASTRUCTURE.md` as the cross-entity source of truth for accounts/tiers/connectivity. This repo's `CLAUDE.md` now points there for the account fingerprint; the repo's own `INFRASTRUCTURE.md` stays as the RxShift **operational runbook** (DNS, email flow, M365 send-as, troubleshooting) so it travels with the product.
- RxShift account added to the `gh` CLI (SSH key `RxShiftGit`). Push nuance: `origin` is HTTPS — `gh auth switch --user RxShift` before pushing to `RxShift/RxShift`, or repoint `origin` to the SSH URL `git@github.com:RxShift/RxShift.git`.

---

## 2026-06-13 — Schedule UX, live board, branding & help overhaul

### Shipped
- **Schedule navigation:** always-visible **Create next period** button + prev/next steppers (you could not create a future period once one had shifts — the core bug). Sticky staff column **and** date header (the staff column was silently broken by `border-collapse`; grid is now `border-separate`). Opens on the period containing today and scrolls to today's column.
- **View selector (week / 2-week / month)** decoupled from the build cycle — browse any window with a clear published / draft / no-period column cutoff; editing still resolves to the underlying period. Grid extracted to a shared `ScheduleGrid`. Copy-forward relabeled "Copy last period's weekday pattern" with a confirm.
- **Out-of-ratio indicator:** fill-independent red ⚠ corner badge (the old ring vanished on reddish work-type colors).
- **Configurable live statuses:** per-tenant show/hide, rename, and counts-toward-ratio, in Settings → Statuses. Single source of truth in `lib/live-status-config.ts`; board + picker + alerts all read it. Defaults reproduce prior behavior.
- **Live out-of-ratio alerts:** new cron evaluates each zone's current slot (shared `lib/live-board.ts`), notifies managers in-app + gated email, with a 5-min grace + 60-min cooldown (`live_ratio_alert_state`).
- **Mobile-first My Schedule:** stacked agenda on phones, calendar grid at `sm:`+.
- **Light tenant branding:** owner-set accent color (overrides only the amber token, both modes, server-rendered, regex-validated) + logo URL in the sidebar; RxShift mark always shown + "powered by RxShift". No migration (branding JSONB existed).
- **Help:** `admin_only` column + RLS so platform-admin docs never reach tenants or the AI assistant; rewrote the misleading "Building a schedule" article; added 5 tenant + 4 admin articles.

### Schema
- `0015_live_status_config` — `live_status_config` + `live_ratio_alert_state` tables (RLS, grants) — applied
- `0016_help_admin_only` — `help_article.admin_only` column + `help_select` RLS rewrite — applied
- `0017_help_content_overhaul` — rewrite + new help articles — applied

### Infrastructure
- `vercel.json`: added `/api/cron/live-ratio-check` (`0 9 * * *`, daily). **Hobby rejects sub-daily crons and fails the whole deploy** — an every-minute schedule was the real cause of the "deploy won't start" troubleshooting on June 13 (PENDING hook job, no build). Keep it daily until the Vercel account is on Pro, then change to `* * * * *` for near-real-time alerts. The board badge stays real-time meanwhile; grace/cooldown state means a slower cadence only delays alerts.

### Review (multi-agent code review, fixes applied)
- **Tenant isolation in the alert cron:** `loadPeriodBundle` now scopes staff/work_type/ratio_rule/constraint_rule/time_off by the period's `tenant_id` — they relied on RLS, which the service-role cron bypasses, so the cron could have used another tenant's ratio rule. Fixed before any second ratio tenant exists.
- Range view `periodForDate` prefers the published period on overlap; `?anchor` date validated; statuses manager stores `null` when a label matches the built-in default; My Schedule still shows a held-but-disabled status; sidebar recovers when a bad logo URL is corrected.
- Verified clean: `tsc`, 45 vitest tests, `next build`.

### Open (status after this session)
- Pre-existing lint: 2 errors unrelated to this work (`app/app/(shell)/admin/page.tsx` prefer-const; `components/ui/theme-toggle.tsx` set-state-in-effect) — flag, not fixed.
- Browser/visual walkthrough of the new surfaces recommended before the next demo.
- Paid-plan upgrade (Vercel + Supabase) at first customer / confident deep trial → unlocks per-minute alert cadence, backups, uptime.

---

## 2026-06-13 — Documentation thoroughness pass (no app changes)

### Shipped
- `CHANGELOG.md` created and backfilled with all June 11–12 build history
- `README.md` rewritten — replaces Next.js boilerplate with RxShift-specific content (port, stack, scripts, accounts, docs map)
- `docs/SCRIPTS.md` created — documents all 4 operational scripts with flags and examples
- `docs/decisions.md` — added 3 entries for June 12 late session (work-type two-channel, curated palette, dark mode app-only)
- `supabase/migrations/0008_break_minutes.sql` created — local file was missing (migration was already live in Supabase since June 12)
- CHANGELOG.md fixed: `0006_tenant_status.sql` → `0006_email_safety.sql` (wrong name backfilled from CoWork flag)
- INFRASTRUCTURE.md: migrations 0001–0005 tracking gap documented; status line updated

### Schema
- No new migrations (0008 file creation only — schema already applied June 12)

### Infrastructure
- No infrastructure changes

### Open (status after this session)
- Susie's platform-admin account: needs her admin email → `npx tsx scripts/provision-user.ts --platform-admin --email <addr>`
- Website screenshots/demo content: format decision pending (screenshots/video/embed)
- Vercel RxShift account authorization: phone verification pending with Vercel support
- **Jamison action:** verify keep-alive cron is active in Vercel personal account → rx-shift project → Settings → Cron Jobs
- Tennessee ratio enforcement: BLOCKED (contradictory rule research)
- CRM test leads to delete: "Verification Pharmacy" and "Branded Email Test Pharmacy"

---

## 2026-06-12 (late) — Dark mode + work-type colors + schedule UX

### Shipped
- App-only dark mode: `.dark` token overrides in `globals.css`; `ThemeToggle` in sidebar footer
- No-flash script gated to app context (`app.*` hostname / `/app` path) — marketing always renders light
- Manager Settings access: `scheduler`/`supervisor` can now edit org config, ratio rules; Danger Zone stays owner-only
- Work-type colors: `work_type.color` + curated 16-swatch palette + `readableTextColor()` util
- Swatch picker in Settings → Work Types (EntityManager `"color"` field type)
- Schedule grid: shift fill = work-type color + name; compliance separated to ring channel (red ring + ⚠ = deficient, amber ring = constraint)
- Rows banded by role: Pharmacists → Technicians → Other; work-type color legend
- Shared `ShiftBlock` component for consistent rendering across schedule, overview, and future surfaces
- Location clarity: pill switcher + location name in page header
- Read-only "All locations" overview (`?view=all`, weekly, per-location banded sections)
- Live board: per-person work-type color dots + "Other" group for non-counting staff
- My Schedule: colored shift cells via work-type color
- Marketing pricing page: removed R113-24 roadmap paragraph (honest scope)

### Schema
- `0014_work_type_colors.sql` — adds `work_type.color` (nullable hex, CHECK format); backfills all seeded work types for Mesa Vista and OptumRx demo

### Infrastructure
- `origin` remote (RxShift/RxShift) unblocked: jamisonwest-ship-it added as GitHub collaborator
- DMARC TXT record added in Cloudflare — Jamison (confirmed)
- Branded Supabase magic-link template pasted in dashboard — Jamison (confirmed)

### Open (status as of this session)
- Susie's platform-admin account: needs her admin email, then `npx tsx scripts/provision-user.ts --platform-admin --email <addr>`
- Website screenshots/demo content — unblocked by Mesa Vista; format decision pending
- Vercel RxShift account authorization — phone verification pending with Vercel support
- Tennessee cert-dependent ratio enforcement — BLOCKED (contradictory rule research)
- README.md is still unmodified Next.js boilerplate — needs RxShift rewrite

---

## 2026-06-12 (evening) — Retail-ready pass

### Shipped
- Branded email everywhere: `brandedEmailHtml()` in `lib/email.ts` covers all known-user sign-ins and notifications; Supabase template only touches brand-new signups
- AI shift creation: `create_shifts` command via natural-language input (expanded/clamped/PTO-aware, engine-validated, confirm-to-apply)
- Copy-forward break_minutes bug fixed (was silently dropping break data)
- California ratio enforcement (BPC 4115, 2P−1 additive formula) in engine + tests + CA settings seed + `/states/california` page live (no "Coming Soon")
- CPhT tracking on staff profiles (informational; TN enforcement deferred)
- Board containment policy: RxShift never contacts a board; publish-time 3-day-streak alerts go to pharmacy's own managers only
- Reports page (`/app/reports`): 4 XLSX exports — compliance log, staff roster, schedule, audit (audit = owner-only)
- Billing scaffold: `lib/pricing.ts` + tenant billing columns + `isTenantEntitled()` enforcement point (permissive until Stripe connects)
- Go Live opens a manual subscription flow
- Legal drafts: `/terms` + `/privacy` — attorney review confirmed OK; "Draft" notices removed

### Schema
- `0011_billing_columns.sql` — tenant billing fields (plan, billing cycle, entitlement flag)

### Infrastructure
- Resend SMTP for Supabase Auth configured (sender typo `.com`→`.io` was causing 550 rejections — fixed)

### Open
- Stripe billing integration: enforcement point exists, permissive until webhook handlers + billing columns wired
- Owner-facing alias management UI: scripts-only for now
- Shared rate limiting on `/api/auth/login-link` and `/api/contact` before public launch

---

## 2026-06-12 — Phase 2: CRM, demo mode, Mesa Vista, website expansion, demo identities

### Shipped
- **Internal CRM** at `/app/admin/leads`: platform-admin only; `leads`+`lead_notes` service-role tables; website forms auto-capture leads with source page; duplicates merge via notes
- **Demo tenant mode**: `tenant.is_demo` + `demo_redirect_email`; demo emails redirected or suppressed; demo tenants never go live; admin console controls + "Restore demo data" button
- **Mesa Vista Pharmacy** demo tenant: 3 NV locations (Spring Valley, Henderson, Summerlin), 14 fictional staff (@mesavistarx.com), 7 date-anchored weekly periods (re-anchors to current Monday on reset), engine-real Henderson Thursday 2–4 PM pharmacist-gap deficiency
- Mesa Vista logins: `demo@rxshift.io` → Frank DiMaggio (owner), `jerome@rxshift.io` → Jerome Williams (staff), `patricia@rxshift.io` → Dr. Patricia Nguyen (scheduler = Susie's identity)
- Demo reset: admin console button or `npx tsx scripts/seed-mesa-vista.ts --reset`
- **Website expansion**: interactive `/pricing` calculator (tiers $199/$169/$149, annual=10×monthly), `/nevada` R113-24 deep-dive, `/states/california` + `/states/tennessee` stubs, `/vs/when-i-work` battle card, States nav dropdown, columned footer
- Honeypot + per-address throttle on demo request form
- Susie's platform-admin (dr.monahanwest@outlook.com) provisioned separately from her customer logins
- Admin console: "No staff record" label replaced with auth email fallback (Frank DiMaggio now visible)
- "Restore demo data" moved to visible tenant row in admin console (was buried in email editor panel)
- Sidebar regrouped: tenant name heads tenant nav; Configuration (Staff/Settings); Resources (Security Posture/Help)
- 7 new help articles

### Schema
- `0009_crm.sql` — `leads` + `lead_notes` service-role tables
- `0010_demo_mode.sql` — `tenant.is_demo` + `tenant.demo_redirect_email`

### Infrastructure
- Mesa Vista demo alias emails registered in Cloudflare catch-all (all deliver to Jamison's inbox)
- CRM author map updated for Susie's platform-admin address

### Open
- CRM v2: pagination, stage analytics, export — after Susie uses it
- Delete test CRM leads: "Verification Pharmacy" and "Branded Email Test Pharmacy"

---

## 2026-06-12 (morning) — Tenant lifecycle, login aliases, unpaid breaks, onboarding polish

### Shipped
- Tenant lifecycle: `tenant.status` (setup→trial→live) + `email_allowlist` — gate in `lib/email-policy.ts`; `sendNotificationEmail()` enforces all send rules; Go Live card in Settings
- Amber trial banner across the app for non-live tenants
- Login aliases: `login_alias` table; `POST /api/auth/login-link` + `GET /app/auth/confirm` token-hash flow; survives Outlook link scanners
- Manage aliases: `npx tsx scripts/provision-user.ts --add-alias <email> --for <primary>`
- Susie's login: dr.monahan@yahoo.com (home/phone) ↔ susie.monahan@optum.com (work), same account
- Unpaid breaks: `shift.break_minutes` + `tenant.default_break_minutes`; paid-hours math subtracts per shift; ratio coverage untouched
- `scripts/seed-live-now.ts` — seeds `live_status` from today's real shifts so the live board looks alive during demos
- `scripts/provision-user.ts` — provision a login to an existing tenant by email/tenant/staff/role; `--delete-auth-user` cleanup
- Live board + helpers compute "now"/"today" in tenant.timezone via `nowInTimeZone()` in `lib/dates.ts`
- Schedule defaults to the published period for the first location

### Schema
- `0006_email_safety.sql` — `tenant.status` + `tenant.email_allowlist`
- `0007_login_alias.sql` — `login_alias` table
- `0008_break_minutes.sql` — `shift.break_minutes` + `tenant.default_break_minutes`

### Infrastructure
- Orphan auth user jamison.west@outlook.com deleted

---

## 2026-06-11 — Initial scaffold + v1 full build

### Shipped
- Two-domain architecture: marketing at `rxshift.io`, app at `app.rxshift.io`; host-based middleware rewrites `/app/*`
- Supabase Auth (magic link); RLS on all tables; `app_user` roles (owner_admin/scheduler/supervisor/read_only/staff)
- Deterministic compliance engine: slot-based ratio evaluation, 7 constraint types, overnight spillover, 24 vitest tests
- Schedule builder: period management, grid with segments, PTO overlay, copy-forward, publish with override logging, CSV export
- Requests: time-off, callouts (with ratio gap), manager-mediated swaps; Resend emails + in-app notifications
- Onboarding wizard: 7 screens, AI state-ratio proposal, CSV roster import
- AI layer: `lib/ai.ts` (OpenAI gpt-4o-mini, server-side); help assistant, flag explanations, NL schedule commands
- Compliance log (`/app/log`): hourly per zone, CSV + print export, override log
- Live ratio board (`/app/board`): schedule + live-status overlay; one-tap status from `/app/me`
- `/app/me`: 2-week calendar grid, requests, team this week
- Reports (basic), dashboard with deterministic insights
- Marketing homepage, pricing page (initial), security page
- Keep-alive cron: `/api/cron/keep-alive` + `vercel.json` (activates when Vercel connects)
- `scripts/seed-demo.ts`: OptumRx demo tenant (44 staff, NULL emails, outbound disabled)

### Schema
- Migrations `0001`–`0005`: core schema (tenant, location, staff, schedule, shifts, segments, ratio rules, constraints, live status, audit, platform admin, RLS)

### Infrastructure
- Supabase project `cnhpaxucnbgxazpbvtod` created (supabase@rxshift.io)
- Resend account (resend@rxshift.io) configured; domain rxshift.io verified; sends from hello@rxshift.io
- Cloudflare DNS + email routing: catch-all `*@rxshift.io` → Jamison's M365 inbox
- GitHub repo RxShift/RxShift created (github@rxshift.io); `vercel` remote → jamisonwest-ship-it/rx-shift (deploy path)
- Vercel personal account hosts app at app.rxshift.io (RxShift Vercel account still pending phone verification)

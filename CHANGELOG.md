# RxShift Changelog

Newest-first. One entry per build session. This file is updated after every commit and
is the fast-read reference for what shipped, what's pending, and what changed in
infrastructure. Full context lives in `CLAUDE.md`; infrastructure details in
`INFRASTRUCTURE.md`.

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

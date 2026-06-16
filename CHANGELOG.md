# RxShift Changelog

Newest-first. One entry per build session. This file is updated after every commit and
is the fast-read reference for what shipped, what's pending, and what changed in
infrastructure. Full context lives in `CLAUDE.md`; infrastructure details in
`INFRASTRUCTURE.md`.

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

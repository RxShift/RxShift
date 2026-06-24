@AGENTS.md

# RxShift — Project Context
# Last updated: June 23, 2026
# Entity: JWC LLC (Jamison West Consulting)

---

## What RxShift Is

RxShift is a **B2B SaaS scheduling platform for retail pharmacies** — multi-tenant, designed to scale from independent single-location pharmacies up to small chains (1–25 locations).

**The problem it solves:** Retail pharmacies must maintain state-regulated pharmacist-to-technician ratios during every shift hour. Today this is tracked in spreadsheets, whiteboards, or disconnected scheduling tools that have no concept of compliance. RxShift embeds ratio rules into the schedule so deficiencies surface before they become violations.

**Tagline:** Compliance-ready pharmacy scheduling

**Primary user:** Managing pharmacist / pharmacy owner — typically a 45–60 year old independent operator or small-chain manager who needs credibility from the software, not startup vibes.

**Origin:** Evolved from a one-off scheduling demo built for Optum pharmacies (repo: `Optum-Schedule-Demo`, now abandoned in favor of this product-grade version). Some ideas and workflow patterns from that repo may be worth referencing, but do not copy code directly — the architectures differ.

---

## Entity & Ownership

- **Owner:** Jamison West (JWC LLC)
- **GitHub account:** `RxShift` (github@rxshift.io) — separate from Jamison's personal `jamisonwest-ship-it` account
- **Business entity:** JWC LLC — not a separate company yet. Will become one if the product takes off.
- This is NOT a TimeZest or MSP+ project. Keep accounts, keys, and infrastructure fully separate.

> **Two parent docs hold the rest:** universal working rules → `C:\dev\CLAUDE.md`; the cross-entity account/tier
> fingerprint → `C:\dev\INFRASTRUCTURE.md` (rx-shift section). The repo's own `INFRASTRUCTURE.md` is the **RxShift
> operational runbook** (DNS, email flow, M365 send-as, troubleshooting) — kept here so it travels with the product.

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| CSS | Tailwind CSS 4 |
| Database / Auth | Supabase (direct client — no Prisma) |
| Email | Resend |
| Hosting | Vercel (personal account active at app.rxshift.io; RxShift account pending phone verification) |
| AI | OpenAI gpt-4o-mini (server-side only, `lib/ai.ts`) |

**Local dev port:** `3200` (first in the JWC LLC port range 3200–3299)
**Run with:** `npm run dev` (port pinned in package.json)

---

## Accounts & Credentials

**Which account hosts what** (the cross-entity fingerprint) is canonical in **`C:\dev\INFRASTRUCTURE.md`** (rx-shift
section): GitHub `RxShift`, Supabase `supabase@rxshift.io` (`cnhpaxucnbgxazpbvtod`), Resend `resend@rxshift.io`,
Cloudflare `jamison@jamisonwest.com`, Vercel (dedicated RxShift account pending; deploys via personal Hobby).

The **detailed operational runbook** — DNS records, the demo-request email flow, email troubleshooting, and the M365
send-as setup — lives in **this repo's `INFRASTRUCTURE.md`** (it travels with the product). Keep it current; Jamison
drops updates into it from outside Claude Code.

**Environment variables** are in `.env.local` (gitignored). See `.env.example` for the template.

**Supabase project:** `https://cnhpaxucnbgxazpbvtod.supabase.co` — **free tier**; keep-alive cron (`/api/cron/keep-alive`, every 3 days) is in place.

---

## Brand & Design System

Full brand spec lives in `Brand Items/DESIGN.md`. Read it before building any UI. Summary:

**Brand name:** Always `RxShift` — capital R, lowercase x, capital S. Never "RX Shift" or "Rx Shift".

**Colors:**
- Navy Anchor `#1C2F5E` — primary brand, headlines, nav background
- Shift Amber `#F07C30` — CTAs, active states, accent
- Steel `#4A5B7A` — secondary text, labels
- Cloud `#F2F5FA` — light surfaces
- Border `#DDE5EF` — dividers, input borders
- Background `#F8FAFC` — page background

**Fonts:** Space Grotesk (headings, labels, CTAs) + Inter (body, data, tables) — both from Google Fonts

**Status colors (product UI only):**
- Compliant `#2E7D5E` / bg `#EDF7F2`
- Alert `#D4860A` / bg `#FEF7ED`
- Deficiency `#C0392B` / bg `#FEF0EF`

**Logo files** are in `Brand Items/` — use `rxshift-horizontal-light.svg` as the primary lockup on light backgrounds.

---

## Product Architecture (BUILT — June 11, 2026)

The full v1 build is complete per `docs/RxShift-Product-Scoping.md` (the authoritative scope doc — read it). **Migrations 0001–0014 are applied and live in Supabase.** Note: 0001–0005 were applied via raw `execute_sql` before MCP migration tracking was configured — they do not appear in `list_migrations`; 0006+ are tracked normally.

### What exists
- **Two-domain architecture:** marketing at `rxshift.io` (root routes), app at `app.rxshift.io` → host-based middleware rewrites to the `/app` route tree. Local dev: `http://localhost:3200/app/...` works directly.
- **Auth:** Supabase magic link; middleware gates all `/app` routes; roles via `app_user` (owner_admin / scheduler / supervisor / read_only / staff).
- **Deterministic engines** (`lib/engine/` — pure functions, 24 vitest tests, `npm test`): slot-based ratio evaluation with work-type counting + overnight spillover; all 7 constraint rule types; hourly compliance record with documented exceptions + 3-day board-report trigger. **These engines own compliance truth. AI never decides a ratio.**
- **Schedule builder:** period management per cycle, grid with segments (split counting/non-counting), PTO overlay, copy-forward, live validation flags, publish-with-logged-override, CSV export, compliance snapshot at publish.
- **Requests:** time off (approver pool), callouts (with computed ratio gap), manager-mediated swaps. Resend emails + in-app notifications.
- **Onboarding wizard:** 7 screens, AI-assisted state ratio proposal (verified seed vs flagged AI proposal), CSV roster import, creates the whole tenant via service role.
- **AI layer** (`lib/ai.ts`, OpenAI gpt-4o-mini, server-side ONLY): help assistant (answers from help articles), flag explanations, NL schedule commands (propose → engine-validate → human confirm), deterministic insights on the dashboard.
- **Compliance record** (`/app/log`): hourly per zone, CSV + print export, override log.
- **Live ratio board** (`/app/board`, gated on `has_ratio`): schedule + live-status overlay, one-tap status from `/app/me`.
- **Security pages:** marketing `/security` + in-app `/app/security-posture` (update its `LAST_REVIEWED` const when security-relevant code changes).
- **Keep-alive cron:** `/api/cron/keep-alive` + `vercel.json` — in place; verify it is active in the personal Vercel account (Settings → Cron Jobs) until the RxShift Vercel account is authorized.

This is a **multi-tenant** platform. Each tenant = one pharmacy organization (which may have multiple locations).

### Core data model concepts
- **Organization** — the tenant (e.g., "Southwest Medical RX")
- **Location** — a physical pharmacy (an org may have multiple)
- **Staff** — pharmacists (RPh), technicians (tech), trainees — tied to a location
- **Ratio Rules** — state-specific regulations (e.g., "1 RPh per 2 techs")
- **Schedule** — weekly staffing plan per location
- **Compliance Log** — hourly record of who was working and whether ratios were met

### Planned routes
| Route | Purpose |
|-------|---------|
| `/` | Marketing homepage |
| `/login` | Auth |
| `/dashboard` | Compliance status overview — location cards, deficiency flags |
| `/schedule` | Week-view staff scheduling with live ratio overlay |
| `/log` | Hourly compliance documentation |
| `/staff` | Staff directory — RPh/tech/trainee, cert tracking |
| `/settings` | Ratio rules per state, location management |

### Auth model
- Supabase Auth (magic link or email/password — TBD)
- Multi-tenant via RLS: every table has an `organization_id` column; users can only see their org's data

---

## Documentation Discipline — MANDATORY

**Every significant code pass ends with documentation updates. This is not optional and is not the last thing to remember — it is part of the definition of "done."**

Documentation that goes stale is worse than no documentation: it creates false confidence and costs real time to untangle. We learned this the hard way. Do not push a commit without completing the checklist below.

### The files you must consider after every session

| File | Update when… |
|------|-------------|
| **`CHANGELOG.md`** | Every session without exception. One H2 entry: date + summary heading, then Shipped / Schema / Infrastructure / Open sections. Bullets, not prose. This is what a future agent reads first to understand current state — keep it honest. |
| **`docs/DEMO-GUIDE.md`** + **`docs/FEATURE-MAP.md`** | When a change alters what a screen does, adds/removes a route, or changes the demo flow or demo data. These are the source of truth for running a demo (the demo script kept drifting from reality) — keep them accurate so a script can be generated from them. |
| **`lib/demo/prompter-steps.ts`** (the in-app demo prompter) | When a change alters the demo flow, a screen the demo touches, or the demo data. This is the LIVING presenter script shown at `/app/demo-prompter` (and what CoWork QA follows). Bump `PROMPTER_VERSION` on a meaningful pass. Keep it in lockstep with DEMO-GUIDE/FEATURE-MAP. |
| **`CLAUDE.md`** (this file) | A feature ships, a route is added, the stack changes, TODOs are completed or discovered, architecture decisions are made, or any section becomes inaccurate. Update the `Last updated` date at the top. |
| **`INFRASTRUCTURE.md`** | Any account, credential, DNS record, Vercel config, Supabase project, email routing, or hosting change. If Jamison makes an infra change outside Claude Code, he should tell you and you update this file. |
| **`docs/decisions.md`** | A durable scope or architecture decision is made — something that explains WHY the code is the way it is, or rules out a future direction. Especially: deferred features, blocked items, and deliberate design choices. |
| **`docs/PROJECT-STATUS.md`** | Milestone changes: new features reaching production, demo/customer readiness changes, blocking issues resolved or discovered. |

### What "significant" means

Almost everything qualifies. When in doubt, update. Skip only for:
- Typo or copy fixes
- Style-only changes (spacing, color tweaks)
- Dependency bumps with no behavior change

### The sequence

1. Finish the code work
2. Run through the table above — update every file that applies
3. Commit everything together (docs + code in the same commit, or a follow-up commit in the same session)
4. Then and only then ask Jamison to approve a push

**If you realize mid-session that a previous session left docs stale, fix them now.** Don't leave it for later.

### Demo QA handoff — MANDATORY after any demo-affecting change

The demo is QA'd in a recursive loop: Claude Code ships → hands Jamison a **CoWork QA prompt** →
CoWork runs the full demo in Chrome against the in-app prompter (`/app/demo-prompter`) → writes a
dated report to `docs/qa/` → Claude Code validates + fixes → repeat until a run-through is clean.

**So: at the END of any change that could affect the demo** (a schedule/board/compliance/requests/
settings surface, the demo data/seed, a route, the ratio engine's visible output, or the prompter
script), after updating the prompter + docs, **give Jamison a ready-to-paste CoWork QA prompt** —
use the template in `docs/qa/README.md` and fill in the "areas you touched" line with what changed
this session. This is part of "done," not optional. Skip only for pure infra, copy-only tweaks, or
non-demo internal screens.

---

## Development Rules

- **Always `git pull` before starting work** — standard discipline.
- **Commit frequently** with plain-English messages.
- **Never push without Jamison's explicit approval.**
- **Deploying (June 23, 2026): use the Vercel CLI, not git-push or the deploy hook.** On the personal
  Hobby account, both git-push auto-deploy AND the deploy hook get **Blocked** ("commit author did not
  have contributing access" — the Hobby private-repo author check, tripped by the `Co-Authored-By:`
  trailer). The CLI sidesteps it (attributed to the authed account, not the commit author). After
  pushing both remotes, deploy with **`npx --yes vercel --prod --yes`** from the repo — Claude can run
  this (CLI is authed as `jamisonwest-ship-it`); it needs Jamison's explicit "deploy" each time
  (production-deploy guardrail). Permanent fix: upgrade the account to Vercel Pro (lifts the
  restriction so git-push works again). Details in memory `vercel_deploy_hook.md`.
- For any multi-step task, create a task list before starting.
- Match the brand spec in `Brand Items/DESIGN.md` for all UI work — do not improvise colors or typography.
- When adding new API routes, check whether the Supabase keep-alive cron is in place first (required for free-tier).
- **Documentation: see the Documentation Discipline section above. It is mandatory, not advisory.**

## Phase 2 (built June 12, 2026)

- **Tenant lifecycle + email safety:** `tenant.status` (setup→trial→live), recipient allowlist, owner Go Live, plus **demo mode** (`is_demo` + `demo_redirect_email` — demo email is redirected to one inbox or suppressed; demo tenants never go live). Gate lives in `lib/email-policy.ts` / `sendNotificationEmail` — every send passes through it.
- **Login aliases:** one account, multiple sign-in emails (`login_alias` table, `/api/auth/login-link`, `/app/auth/confirm` token-hash flow — survives Outlook link scanners). Manage via `scripts/provision-user.ts --add-alias`.
- **Unpaid breaks:** `shift.break_minutes` + `tenant.default_break_minutes`; paid-hours math subtracts per shift; ratio coverage untouched.
- **Internal CRM:** `/app/admin/leads` (platform admins only; service-role tables `leads`/`lead_notes`). Website forms auto-capture leads with source page; duplicates merge via notes.
- **Website:** interactive `/pricing` calculator, `/nevada` regulatory deep-dive, `/states/california` + `/states/tennessee` stubs (Coming Soon), `/vs/when-i-work` battle card, States nav dropdown, columned footer. (Marketing scope was later updated — see the June 19, 2026 R072-25 section: certified/non-certified, trainee limits, and the floor are now shipped behind the toggle; volume remains collect-only.)
- **Mesa Vista Pharmacy demo tenant:** fully fictional, 3 NV locations, 15 staff (Spring Valley has 3 pharmacists so it carries real ratio headroom — for the "who can step away?" demo), 7 date-anchored weeks, engine-real Henderson Thursday 2–4 PM deficiency. Login: `demo@rxshift.io` (alias → Frank DiMaggio, catch-all delivers to Jamison). Reset: admin console "Restore demo data" or `npx tsx scripts/seed-mesa-vista.ts --reset` (core in `lib/demo/mesa-vista.ts`).

**Spec workflow:** feature specs land in `docs/specs/`; once implemented they move to `docs/specs/_archive/` (see `docs/specs/README.md`). Archived specs are history — code + this file are the source of truth. Durable scope decisions live in `docs/decisions.md`.

## Retail-ready pass (built June 12, 2026, evening)

- **Branded email everywhere:** one layout (`brandedEmailHtml` in `lib/email.ts`) for notifications, sign-in links, and demo requests. ALL known-user logins are sent by RxShift via Resend (`/api/auth/login-link` handles aliases AND direct emails); Supabase's template only touches brand-new signups — paste-in HTML in `docs/supabase-email-templates.md`.
- **AI shift creation:** the command bar's `create_shifts` op makes "Marcus works 8–5 Mon–Fri for three weeks" real — expanded/clamped/PTO-aware, engine-validated, confirm-to-apply. Copy-forward now copies `break_minutes` (was silently dropping them).
- **California enforcement:** additive formula (BPC 4115, 2P−1) in the engine with tests; CA seed rule; formula selector in ratio settings; CA page live (no Coming Soon). **CPhT tracking** on staff (informational; TN cert-dependent enforcement DEFERRED — see decisions.md).
- **Board containment** (policy, see decisions.md): RxShift never contacts a board. Publish-time 3-day-streak alerts notify the pharmacy's own managers (in-app + gated email).
- **Reports** (`/app/reports` + `/api/reports/[type]`, xlsx): compliance log, staff roster, schedule export, audit (owner-only).
- **Billing scaffold:** `lib/pricing.ts` (single price truth) + tenant billing columns (migration 0011) + `lib/billing.ts` (`isTenantEntitled` enforcement point, permissive until Stripe) + Go Live opens a manual subscription + admin console billing controls.
- **Legal:** `/terms` + `/privacy` — attorney-reviewed and approved (June 12, 2026); "Draft" notices removed. Entity name, address, governing law/venue are placeholder text — fill in before first customer.
- **Spam:** honeypot + per-address throttle on the demo form.

## Dark mode + work-type colors pass (built June 12, 2026, late)

- **Dark mode (app only):** `.dark` token overrides in `globals.css`; `ThemeToggle`
  in the sidebar footer; no-flash inline script in `app/layout.tsx` is **gated to the
  app context** (hostname `app.*` or path `/app`) so marketing always renders light.
- **Manager Settings access:** Settings opens to `scheduler`/`supervisor` (sidebar
  `CONFIG` set; settings layout `canManage`; `updateTenant`/`upsertRatioRule` →
  `requireManager`). Danger Zone wrapped in `isOwner`. Go-live, delete, role assignment,
  offboarding stay owner-only.
- **Work-type colors** (the When I Work pattern Susie/Optum needed): `work_type.color`
  (migration 0014, backfilled for all seeded types incl. OptumRx) + curated palette in
  `lib/work-type-colors.ts` (16 mid-dark swatches, white-text-safe in both modes,
  red/amber reserved for compliance) + `readableTextColor()`. Color picker = swatch grid
  (`"color"` field type in `EntityManager`).
- **Schedule grid redesign** (`shift-block.tsx`, shared): shift fill = work-type color +
  name + time; **compliance is now a separate channel** — deficient = red ring + ⚠,
  constraint = amber ring (fill stays the work-type color). Rows banded
  **Pharmacists → Technicians → Other**; work-type legend.
- **Location clarity:** pill switcher + location name in the header; read-only
  **"All locations" overview** (`?view=all`, weekly, per-location sections reusing the
  block renderer) — editing stays per-location (periods/zones/compliance are per-location).
- **Live board + My Schedule:** per-person work-type color dots (+ "Other" group on the
  board); colored shift cells on `/app/me`.
- Marketing pricing page: removed the proposed-rule roadmap paragraph.

## Schedule UX + live board + branding + help pass (built June 13, 2026)

- **Schedule navigation:** always-visible **Create next period** button + ◀/▶ steppers
  (`schedule-builder.tsx`) — previously you could not open a future period once one had
  shifts. Grid extracted to shared `schedule-grid.tsx`; switched to `border-separate` so
  the sticky **staff column** actually freezes (Chrome ignores sticky cells under
  `border-collapse`) and the **date header** freezes on vertical scroll. Opens on the
  period containing today and centers today's column.
- **View selector (week / 2-week / month),** decoupled from the build cycle:
  `?view=…&anchor=…` in `schedule/page.tsx` → `loadRangeBundle` (fetch by date range
  across periods) → read-mostly `schedule-range-view.tsx` with a published / draft /
  no-period column cutoff. Validation reuses the engine via a synthetic period
  (`validateRangeBundle`). Editing still resolves to each shift's own period.
- **Copy-forward** relabeled "Copy last period's weekday pattern" + confirm dialog.
- **Out-of-ratio indicator:** fill-independent red ⚠ corner badge in `shift-block.tsx`
  (supersedes the red-ring-only cue, which vanished on reddish work-type colors).
- **Configurable live statuses:** `live_status_config` (migration 0015) — per-tenant
  show/hide, label, counts-toward-ratio; Settings → **Statuses**. Single source of truth
  `lib/live-status-config.ts`; board, picker, and alerts all read it; no config = prior
  behavior. Stored in its own table (not `tenant` JSONB) — see decisions.md re the
  owner-only `tenant` UPDATE policy vs `requireManager` mismatch.
- **Live out-of-ratio alerts:** `lib/live-board.ts` `evaluateLiveZones` (shared with the
  board so they can't disagree) + cron `/api/cron/live-ratio-check` → managers in-app +
  gated email, with a 5-min grace + 60-min cooldown in `live_ratio_alert_state`
  (migration 0015). Cron is in `vercel.json` at `0 9 * * *` (daily) — **Hobby rejects
  sub-daily crons and fails the entire deploy**, so do NOT set it to `* * * * *` until
  the Vercel account is on Pro (that every-minute value blocked all deploys on June 13).
  The board badge stays real-time; the cron only drives the alert emails.
- **Mobile-first My Schedule:** stacked agenda on phones, calendar grid at `sm:`+.
- **Light tenant branding:** owner-set accent color (overrides only `--color-amber`, both
  modes, server-rendered + regex-validated in the app-shell layout) + logo URL in the
  sidebar; RxShift mark always shown + "powered by RxShift". Settings → **Branding**
  (`updateBranding`, owner-only). No migration (branding JSONB existed). Logo upload still
  deferred (needs Supabase Storage).
- **Help:** `help_article.admin_only` + RLS (migration 0016) so platform-admin docs never
  reach tenants or the AI assistant; content overhaul (migration 0017) rewrote the
  misleading "Building a schedule" article and added 5 tenant + 4 admin articles. Admins
  see a "Platform Admin" category on `/app/help`; gating is RLS-only (no app-code change).
- **New routes:** `/app/settings/statuses`, `/api/cron/live-ratio-check`. Migrations
  0015–0017 applied. Verified: `tsc` clean, 45 vitest tests pass, `next build` clean.

## Schedule architecture (rebuilt June 15, 2026)

The schedule is **one person-centric matrix** (`components/app/schedule/schedule-matrix.tsx`
wrapping `schedule-grid.tsx`). Earlier components (`schedule-builder.tsx`,
`schedule-range-view.tsx`, `all-locations-overview.tsx`) and the scroll-condense were
**removed** — don't reintroduce them.

- **Ratio is per LOCATION.** The `ratio_zone` table/concept is gone (migration 0018).
  `validateBundle`/`buildComplianceRecords`/`live-board`/the alert cron group segments
  by `location_id`. `EngineSegment.location_id` (was `zone_id`); `ComplianceRecordRow`
  is per location; `compliance_snapshot` + `live_ratio_alert_state` key on `location_id`.
  A person in two overlapping shifts across locations is flagged
  (`detectDoubleBookings`). If a site needs two ratio pools → two locations.
- **Departments** are tenant-level (no `location_id`), an optional tag on a shift, and a
  view filter. `tenant.require_department` toggles mandatory selection (Settings →
  Locations & Departments).
- **All Locations is the build surface** (default for multi-location tenants); a
  location/department/work-type is a **view filter** that shows only matching scheduled
  staff. Window selector = week / 2-week / month (`?view=`, `?anchor=`); `?location=`
  filters. Data: `loadAllLocationsBundle(start,end)` (all locations, no location filter).
- **Periods are invisible plumbing.** `upsertShift` auto-creates the covering period
  (`ensurePeriodForDate`, cycle-aligned) when none exists — no "create period" button.
  The matrix toolbar has **Publish** (`publishWindow` — every draft in the window or the
  filtered location; reuses `publishPeriod`), **Copy last week's pattern**
  (`copyForwardWindow`), **Export CSV**, and a Published/Draft **status pill**.
- **Fixed-frame scroll:** the grid fills a bounded flex frame (`h-full overflow-auto`);
  compact header, single scroll region, sticky day header + frozen staff column. Do
  **not** let the page document-scroll around it.
- **Avatars:** private `avatars` Storage bucket (manager-only RLS); 1:1 crop upload
  (`avatar-upload.tsx`, react-easy-crop) → 400px webp; display (`avatar.tsx`) in the
  staff list, staff editor, and schedule staff column via signed URLs
  (`lib/avatars.ts`).
- **Deferred:** per-location/multi-state ratio rules; AI command bar (was period-bound,
  removed from the schedule — re-add bound to the window); group-by sectioning (filters
  cover it for now). See `docs/decisions.md`.

## Platform email, deliverability & feedback (built June 16, 2026)

- **One send path:** every app email goes through `sendEmail()` in `lib/email.ts`
  (branding + safety gate + Resend + `email_log` write + failure reporting).
  `sendNotificationEmail`, `sendLoginLinkEmail`, and the website demo form
  (`/api/contact`) are thin wrappers — do NOT call Resend directly anywhere else.
- **Email log** (`email_log`, migration 0019; service-role only, platform-admin):
  records every send incl. the rendered HTML + gate outcome. Surfaced at
  `/app/admin/emails` (+ `[id]` actual-form view, xlsx export at `/api/admin/emails`).
  App-sent mail is tagged via `related_type/related_id` and shown on the lead page.
- **Deliverability:** signed Resend webhook at `/api/webhooks/resend`
  (`RESEND_WEBHOOK_SECRET`) updates the log on delivered/bounced/complained.
- **System issues = feedback:** `lib/system-report.ts` `reportSystemIssue()` files
  detected problems (failed sends, bounces) into the SAME `feedback` table as
  `source='system'`, loop-guarded + 24h de-duped, and alerts platform admins.
- **Feedback** (`feedback`, migration 0020; service-role only; private `feedback`
  bucket): `lib/actions/feedback.ts` (`submitFeedback`/`updateFeedbackStatus`/
  `setFeedbackNote`). Capture = the sidebar Feedback button
  (`components/app/feedback-button.tsx`); triage = `/app/admin/feedback`.
- **Demo-safe chrome:** the PLATFORM nav section is hidden while emulating
  (`sidebar.tsx` `isEmulating`); the platform banner is slim; the demo sub-banner
  hides the redirect address from prospects (`(shell)/layout.tsx`).
- **New env:** `RESEND_WEBHOOK_SECRET`, `CONTACT_TO_EMAIL` (demo alerts → hello@),
  optional `PLATFORM_ADMIN_EMAIL`. Full email flow + manual steps in INFRASTRUCTURE.md.
- **Future (Jamison-directed, not auto-built):** a fuller Squeeze/ProductBoard-style
  feedback product, and per-tenant manager visibility of the email log. See decisions.md.

## Live presence + polish (June 16, 2026)

- **Live presence is schedule-derived.** On the live board + `/app/me`, a person is "on shift"
  only if a **published** shift covers now (tenant tz) → auto "Working" (counts); otherwise
  **"Off shift"** (not counted, no clock-in). Stale `live_status` is ignored unless set today.
  Logic in `lib/live-board.ts` (shared with the alert cron); `dateInTimeZone` in `lib/dates.ts`.
  Don't reintroduce the "default everyone to present_counting" behavior.
- **Delete leads:** `deleteLead` (platform-admin) + Danger Zone on the lead detail page; notes
  cascade, email_log audit rows are kept.
- **`?screenshot=true`** hides both the platform + demo banners (client-side, URL-only) for
  marketing captures — `components/app/demo-banner.tsx` + `platform-banner.tsx`.
- **Co-branding:** sidebar separates the RxShift mark from a tenant logo with a divider.
- **Assessed, not built (Build 2):** proactive compliance notifications + append-only
  compliance annotations — see docs/decisions.md; build on Jamison's greenlight.

## Live Board wall display + collapsible sidebar (June 17, 2026)

Susie's pharmacies will run the board on an always-on wall monitor, so the board got more important.

- **Shared board data + card.** Board-building logic now lives in `lib/board-data.ts`
  (`buildBoardView(supabase, tenant)` → `{ locationCards, statusList, statusOptions, labels,
  noPeriodToday }`) and the per-location card in `components/app/board/location-card.tsx`
  (`size="default" | "large"`). BOTH the in-shell board and the wall display call these — don't
  duplicate the logic. `statusList` items now carry `locationId/locationName` (the person's current
  shift location, null if off shift).
- **Wall display (kiosk) at `/app/display`.** New route group `app/app/(kiosk)/` with its OWN
  minimal layout (auth-gated via `getSession`, **no sidebar, no banners**). Read-only — no status
  controls. Large cards, `?location=<id>` pins one site, location switcher + clock + Full-screen
  button (`components/app/board/{display-board,fullscreen-button}.tsx`), 30s `router.refresh()`
  (in-shell board stays 60s). An **Open display** button (PageHeader `actions`) on `/app/board`
  opens it in a new tab. v1: the display URL still requires a signed-in session (see decisions.md).
- **Status board grouped by location.** `live-board.tsx` groups the change-status grid under a
  heading per location (card order) + an **Off shift** group; single-location tenants keep the flat
  list. Per-person row extracted to a `StatusRow` helper.
- **Collapsible sidebar (app-wide).** A « in the sidebar header hides the nav completely; the reopen
  » lives in the page header (`components/app/sidebar-reopen-button.tsx`, rendered by `PageHeader`),
  where the « is — so it never overlaps banners. Persisted via `localStorage['rx-sidebar-collapsed']`
  + a no-flash script in
  `app/layout.tsx` (mirrors the theme pattern); CSS in `globals.css` keyed on `html.sidebar-collapsed`
  drives `.app-sidebar` (translateX) + `.app-content` (margin). Applies to every `/app` page.
- **New route:** `/app/display`. **Migration 0022** adds one tenant Help article — *pending
  application to the RxShift Supabase.*
- **Server-action body limit:** `next.config.ts` sets `experimental.serverActions.bodySizeLimit` to
  `6mb` so feedback screenshots (the action caps at 5 MB) aren't silently rejected by Next's 1 MB
  default. The feedback submit also guards >5 MB client-side and wraps the call in try/catch/finally
  so a rejected upload surfaces an error instead of hanging on "Sending…". (Config change → effective
  on deploy / after a dev-server restart.)

## Mobile experience + ratio headroom (June 17, 2026)

- **Mobile nav.** `components/app/sidebar.tsx` is `hidden md:flex` (desktop only); phones get a bottom
  tab bar (`components/app/mobile-tab-bar.tsx`, `md:hidden`) — role-aware tabs (My Schedule, Requests,
  + Dashboard/Live Board for managers) + a **More** sheet that reuses the sidebar's exported
  `sections()`/`MANAGE`. Shell content is `ml-0 md:ml-60` + `pb-16 md:pb-0`. Collapse/reopen is now
  desktop-only (the reopen-show CSS is gated to `@media (min-width:768px)`).
- **Desktop-only notice** (`components/app/desktop-only-notice.tsx`, rendered once in the shell): a
  `md:hidden` heads-up on build-heavy routes (schedule/settings/staff/reports/log/admin). My Schedule
  + Requests are the intended mobile surfaces; the builder/settings are intentionally NOT
  mobile-optimized.
- **PWA / install.** `app/manifest.ts` (standalone, start_url `/app/me`, scope `/app`); `app/layout.tsx`
  has `viewport` (navy themeColor) + `appleWebApp` + apple-touch-icon. PNG icons in `public/`
  (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`) are generated from the grid mark by
  `scripts/generate-pwa-icons.ts` (rerun if the mark changes).
- **Ratio headroom ("can I step away?").** Pure helpers in `lib/engine/ratio.ts`: `minPharmacistsFor`,
  `pharmacistHeadroom`, `wouldBreakIfOneLeaves` (monotonic on `maxTechsAllowed`). `buildBoardView`'s
  LocationCard exposes `headroom`; the shared `location-card.tsx` shows a per-location line on the Live
  Board + `/app/display`. `/app/me` resolves the signed-in **pharmacist's** current location via
  `buildBoardView` and passes `ratioImpact` to `my-status-picker.tsx` (safe/at-limit line + a confirm —
  warn, never block — when a counting pharmacist taps a non-counting status that would break ratio).
  Techs / non-counting / off-shift → no indicator.
- **Migration 0023** adds the "Using RxShift on your phone" Help article — *applied.*
- **Website (marketing):** the live-board band (`components/live-board-showcase.tsx`) is reframed as
  "Know who can step away — without breaking ratio" with a headroom GIF + a one-line mobile note. The
  GIF is captured by the rewritten `scripts/capture-screenshots.ts` (drops a pharmacist on the wall
  display and shows the headroom count down). **All website imagery is fictional Mesa Vista only —
  never real customer data.** Mesa Vista was staffed up (Dr. Lena Park at Spring Valley) so a location
  shows positive headroom.
- **PWA install fix** (`proxy.ts`): `/manifest.webmanifest` + the icon PNGs are excluded from the
  host rewrite/auth so "add to home screen" works on app.rxshift.io (they were bouncing to /login).

## Demo-debrief hardening (June 17, 2026) — 9 phases

Post-demo pass after the Susie walkthrough. Built in phases; see `CHANGELOG.md` for per-phase detail and
`docs/decisions.md` for the durable choices. New: a living **`docs/DEMO-GUIDE.md`** (run a demo accurately)
and **`docs/FEATURE-MAP.md`** (every screen × role) — keep both current.

1. **Real-time propagation.** A shared `revalidateScheduleViews()` (`lib/actions/helpers.ts`) revalidates
   `/app/me`, `/app/board`, `/app/display`, `/app/log`, `/app/dashboard` on every shift mutation; My Schedule
   self-refreshes (`components/app/auto-refresh.tsx`). Also fixed `/app/me` reading "off shift" in the
   evening — it used the UTC date as the query bound but the tenant-tz date for presence; now tenant-tz throughout.
2. **Dashboard interactivity + one flag vocabulary.** `StatCard` takes an `href`; counts + AI insights deep-link
   to the offending slot. `lib/flags.ts` is the single flag definition (ratio vs constraint) + link builders.
3. **Request warnings + reasons.** `lib/actions/requests.ts` pre-checks PTO/swap/callout impact via the engine;
   approving a ratio-deficiency-causing PTO/swap requires a logged reason → `override_log` (0024). `swap.ratio_effect` now populated.
4. **Audit log + append-note + PDF.** New `/app/log/audit` over the append-only `activity_log`; managers append
   immutable notes (`activity_log_note`, 0025). Compliance Record shows override reasons + prints them; the
   official export is **Save as PDF** (print-to-PDF, non-editable). Override Log labels publish vs request overrides.
5. **Work types vs departments.** Counting precedence documented (`segmentCounts` + Settings → Work types):
   a non-counting work type wins over a counting status. Staff self-change their current work type on My Schedule
   (`setMyWorkType` splits the segment at "now"; `lib/actions/me.ts`).
6. **Demo clock + departments.** `nowInTimeZone(tz, overrideMinutes?)` + `tenant.demo_clock` (0027): a demo
   tenant can pin "now" to a business hour so after-hours demos show staff on shift (Admin Console toggle). Mesa
   Vista now seeds 4 departments + tags shifts; reset clears the new note table.
7. **Ask AI restored.** The command bar (relabeled **Ask AI**) is mounted on the schedule, bound to the working
   location's current-week period; full ask + propose/validate/confirm ops (`lib/actions/ai.ts` unchanged).
8. **"Who's on this week."** My Schedule's team block is now a day-grouped read-only view of the home location.
9. **Living docs:** `docs/DEMO-GUIDE.md` + `docs/FEATURE-MAP.md` (this pass).

**Migrations 0024 / 0025 / 0027 applied** to the RxShift Supabase. New routes: `/app/log/audit`.

## Demo QA fixes (June 18, 2026)

Three defects CoWork found dry-running the demo against the live build — all fixed in the seed/engine/
shared code so they survive `--reset`:

- **Override "who" → a real name.** Added `app_user.display_name` (**migration 0028, applied**); the
  Override Log + Compliance Record now resolve an actor as staff name → `display_name` → role. Frank
  DiMaggio (the Mesa Vista owner, no staff record) gets his name set in the seed (idempotently across
  resets). Seeded override reason rewritten to the demo narrative.
- **Acknowledged exception now surfaces on the Compliance Record.** The seed linked the override to the
  Henderson current-week **period id** (was a human-readable string), so `/app/log`'s existing
  "Acknowledged exceptions" section populates; plus an inline **⚠ Acknowledged exception** line on each
  deficient row (`components/app/log/compliance-view.tsx`), which also prints.
- **Overtime renders amber, not red.** `lib/engine/constraints.ts` `overtime`/`hour_cap` now attach the
  flag to the **tipping shift** (new `accumulateHours` helper) instead of `shift_id: null`, so the
  schedule grid shows the amber constraint ring. Jerome (43h) → amber on Saturday; his Thursday keeps the
  red ⚠ ratio-gap. The two ring channels (red = ratio deficiency, amber = constraint) are intentionally
  distinct — don't collapse them.

**Demo-clock reminder** (documented in `docs/DEMO-GUIDE.md`): the Demo clock + Restore demo data live in
the **Admin Console** (`/app/admin`), **platform-admin only**, and the Platform nav is hidden while
emulating — set the clock + reset *before* you emulate a tenant person.

## Demo Fixes v2 + compliance "as-worked" finding (June 18, 2026)

Second debrief (live walkthrough with Susie). Six more fixes — no migration:

- **Emulation name:** `getSession`'s emulate path (`lib/auth.ts`) now falls back to `app_user.display_name`,
  so emulating Frank shows "Frank DiMaggio" not "unlinked user".
- **Empty-week Publish:** the matrix Publish button no longer reads "Published ✓" when nothing is scheduled
  (only when a published period exists); empty = disabled "Publish".
- **Ask AI on empty weeks + `edit_shift`:** the bar mounts even with no period (`schedule/page.tsx` passes
  `periodId|null` + `locationId` + `refDate`); `lib/actions/ai.ts` simulates against an in-memory window
  bundle and creates the real period only at apply (exported `ensurePeriodForDate`). Added an `edit_shift`
  op; the LLM prompt now lists shifts by **staff name + weekday** (UUID cross-referencing was the
  wrong-times bug); proposals show a **deterministic before→after line** + an ack checkbox when an edit adds
  a deficiency.
- **Step-away gating:** `/app/me` shows "can I step away?" only while the pharmacist's current status counts.
- **Seeded emails:** 3 branded current-week emails in `email_log` via the seed. Pure template extracted to
  **`lib/email-template.ts`** (no `server-only`); `lib/email.ts` re-exports it; `email_log` added to the
  demo clear list.

## The Compliance Record (as-worked) — BUILT June 18, 2026

The compliance audit is now real. Three distinct artifacts, named consistently across product/help/marketing:
- **Schedule** — the plan. **Coverage Forecast** (`/app/coverage-forecast`) — projected hourly ratio from the
  *published schedule* (planning aid; the old `/app/log` view, relocated). **Compliance Record** (`/app/log`)
  — the **immutable, hour-by-hour record of what actually happened**, 2-year retained, never edited,
  annotatable. **Activity Log** / **Override Log** — change trail / acknowledged-exception reasons.

- **How the record is written:** the finalizer (`lib/compliance-record.ts`, pure/tsx-safe — no `server-only`)
  reconstructs each completed hour's actual presence (published shift segments **split by each person's
  `live_status` history**; non-counting status removes them for those minutes), runs the existing
  `evaluateZone` + `generateComplianceRecord`, and writes immutable `compliance_record` rows (migration 0029).
  **Idempotent.** Cron `/api/cron/finalize-compliance` runs **daily** (`vercel.json`); switch to hourly
  (`5 * * * *`) on Vercel Pro — same code. Managers add after-the-fact notes via `appendComplianceNote`
  (`compliance_record_note`, mirrors `activity_log_note`); the determination is never edited.
- **Demo:** the Mesa Vista seed finalizes the elapsed week (~290 hours; varies by which weekday the reset
  runs) and annotates the deficiency stories. `compliance_record` + `_note` are in the reset clear list. (As of
  the June 19 R072-25 build there are two deficiencies — Henderson ceiling + North Las Vegas floor; see that
  section below.)
- **Don't regress:** `/app/log` is the as-worked audit; the schedule projection is the **Coverage Forecast**,
  not "the compliance record." The engine stays the single source of compliance truth.
- **Open:** hourly cadence needs Pro; "actual" is inferred from schedule + live status (no clock-in/out —
  annotations correct edge cases; 30-min slot granularity; overnight live-overlay is a v1 limitation). Legal
  copy (Terms/Privacy retention) is accurate but should get Susie/attorney review before publish.
  Implemented spec archived at `docs/specs/_archive/as-worked-compliance.md`; rationale in `docs/decisions.md`.

## Nevada R072-25 + Tennessee — BUILT June 19, 2026

Nevada's proposed **R072-25** (public hearing June 4, 2026; **not adopted**) supersedes R113-24. Implemented
behind a tenant toggle, plus Tennessee, the sustained-deficiency reframe, and a full Nevada marketing rewrite.
**Full build notes: `docs/rxshift-r072-25-build.md`.**

- **Engine:** pure `lib/engine/rule.ts` `buildEngineRule(rule, ctx)` is the ONE place the state/location
  overlays live (server + tsx-safe finalizer both use it). NV retail + `tenant.nevada_r072_25` → **4-tech
  ceiling** (or 2 techs + 2 trainees) + a **solo-pharmacist floor** (≥1 support, ≥2 with a drive-through).
  **TN** (`ratio_rule.state === 'TN'`) → 6-tech cap with **certified (CPhT) techs uncapped**. `evaluateZone`
  emits `flag_type` (`ceiling` | `floor` | `both`), rolled up to `compliance_record.flag_type`. Toggle off /
  retail / non-TN reproduces the prior behavior exactly. New tests:
  `lib/engine/__tests__/floor-and-r072.test.ts`. Pass per-location context to the engine via
  `engineRuleForLocation(rule, location, tenant)` — don't call the engine with a bare cap.
- **Schema (migration 0032):** `location.location_type` (retail/telepharmacy/institutional),
  `location.has_drive_through`, `location.expected_rx_mon..sun` (informational — Decision 4, never enforced);
  `staff.staff_type` (pharmacist/tech/tech_in_training); `tenant.nevada_r072_25`; `compliance_record.flag_type`.
  Migration **0033** refreshed the `compliance-record` help article + fixed stale "ratio zone" wording.
- **Sustained deficiency:** `deficiencyStreaks` → `sustainedDeficiency` (threshold `SUSTAINED_DEFICIENCY_DAYS`,
  default 3). No "board report" language — it's an internal heads-up; RxShift never contacts a board.
- **Marketing:** `/nevada` leads with **NAC 639.250** (current law, enforced); R072-25 is forward context
  only. **Zero "R113-24"** in code or the live help corpus. No hourly-doc mandate, no volume enforcement.
- **Demo:** Mesa Vista has R072-25 on, Spring Valley drive-through, two `tech_in_training`, and two distinct
  current-week deficiencies — **ceiling** (Henderson Thu 2–4 PM) + **floor** (North Las Vegas Tue 9–10 AM).
- **Review flag:** R072-25 is *proposed, not adopted* — only NAC 639.250 / CA BPC 4115 / TN 1140-02-.02 are
  claimed as current law. Nevada positioning + Terms/Privacy wording want Susie/attorney sign-off.

## Pre-QA cleanup (June 19, 2026)

Fixes from the CoWork QA pass (report archived at `docs/qa/2026-06-19-full-product-demo-qa.md`; details in
`CHANGELOG.md`). Two conventions worth keeping in mind:

- **Attribution under emulation:** persisted `actor_user_id` / `author_user_id` use **`ctx.actingUserId`**
  (= the emulated user's `supabase_user_id`), NOT `ctx.userId`. While a platform admin emulates a tenant
  person, actions are recorded as that person (e.g. "Frank DiMaggio") so notes / audit / overrides agree with
  seeded data. Use `ctx.actingUserId` for any new attribution write. (Decision + trade-off in `docs/decisions.md`.)
- **The "(N/pharmacist)" board label uses the *effective* engine rule** (`engineRule.max_techs_per_pharmacist`),
  not the stored base rule — so it matches the limit under the R072-25 overlay.
- **Marketing screenshots are current-law:** recapture with the demo tenant's `nevada_r072_25` toggled **off**
  (see DEMO-GUIDE §6); the capture script targets the Compliance Record by `?date=`.

## Scheduling overhaul (June 22, 2026) — Susie/Brandy readiness

Post-walkthrough batch after Susie tried to build a schedule. Demo-critical UX + three bug fixes + PTO,
holidays, carry-forward, build mode, and a living in-app demo prompter. See `CHANGELOG.md` for the full list.

- **Cadence = Model B (locked), Jamison signed off.** One build cadence per tenant (`tenant.schedule_cycle`,
  relabeled "Build cadence" in Settings → Organization). The period stays the publish/override/compliance
  unit — NO per-day publish tracking. Viewing in any span stays available; quick click-to-edit works in any
  view. The straddle dishonesty was a *display* gap: the grid already had a per-day `DateStatus` channel that
  the matrix never fed. The matrix now computes `dateStatus` (worst-wins across location-periods for All
  Locations) → truthful per-column tint/labels + an honest "N/M days published" status pill (never a
  misleading single "Published ✓"). Rationale + the Model-A-rejected reasoning in `docs/decisions.md`.
- **Build any future week by clicking it.** A no-period cell is now clickable; `ShiftModal` sends a null
  `schedule_period_id` and `upsertShift` auto-creates the covering period on save (it always could — the modal
  used to hard-error instead). Header still honestly reads "No period" until built.
- **Bug fixes:** (1) Publish can't bypass the required flag reason — the dialog button is gated AND
  `publishWindow` re-validates the whole window (all locations) server-side, so window-only flags
  (cross-location double-bookings, window-spanning caps) can't publish unreasoned. (2) The nav reopen control
  is a FIXED left-edge tab (`sidebar-reopen-button.tsx`, mounted in the shell, not the page header) so it never
  scrolls out of reach — build mode relies on it. (3) Ask AI resolves staff by NAME deterministically
  (`resolveStaffName` in `lib/actions/ai.ts`): the model echoes the name, we match (exact → containment →
  typo-tolerant) and override the id, asking to confirm on ambiguity — it can't schedule the wrong person.
- **Grid legibility:** column min-width 92→116px so month view shows the same legible time + work type + color
  as week/2-week (week stretched to fit, month sat at the 92px floor and read as "just the location").
- **PTO is a first-class record** (`pto_day`, migration 0034). One row per person per date, independent of
  publish state (future PTO shows immediately). Written by time-off approval (`decideTimeOff` also inserts
  pto_day) AND by a scheduler directly (the "PTO" checkbox on the shift editor → `lib/actions/pto.ts`
  `setPtoDay`/`clearPtoDay`, which deletes any shift that day). The engine never reads it — PTO = absence of a
  shift. Reason on `pto_day.reason` (never override_log); `tenant.pto_reason_required` (Settings → Organization)
  gates it. Grid renders PTO **blacked out**; `timeOffByCell` is the union of pto_day + approved TOR.
- **Holidays** (`holiday`, migration 0035). Settings → Holidays generates US federal holidays for a year
  (pure `lib/holidays.ts`, observed Sat→Fri / Sun→Mon), then add/edit/remove. Tenant-wide; grid tints + labels
  the column ("Holiday"). Visual only — never blocks staffing.
- **Carry-forward** (`copyShiftForward` in `lib/actions/schedule.ts`): clone one shift to following days through
  a chosen date in one move, from the shift editor; skips days the person already works or is off (TOR/pto_day).
- **Build mode + collapsible Ask AI:** Ask AI defaults to a small button (`ai-command-bar.tsx`); a "Build mode"
  toggle (`build-mode-toggle.tsx` + `html.schedule-build` CSS) collapses the sidebar + page chrome so the grid
  fills the viewport. Transient; clears on leaving the schedule page. **(v2, June 23 — see below.)**
- **Demo prompter is now in-app** (`/app/demo-prompter`, platform-admin only, route group `(prompter)`).
  Steps live as data in `lib/demo/prompter-steps.ts` (single source of truth, `PROMPTER_VERSION` v4.0);
  `components/app/demo-prompter.tsx` renders it; launch via Admin Console "Open demo prompter" (popout). The
  standalone `docs/rxshift-demo-prompter.html` is retired to a pointer. **Demo QA is a recursive Claude-Code ↔
  CoWork loop — see `docs/qa/README.md` + the "Demo QA handoff" rule above.**
- **Seed:** Mesa Vista now seeds `pto_day` (Ashley Morales approved next week + a scheduler-entered Dana Holt
  current-week example) and federal holidays (current + next year); both added to the reset clear-list
  (`pto_day` before `staff`). Migrations 0034 + 0035 applied to the live Supabase.

## Build mode v2 + grid uniformity + holiday polish (June 23, 2026)

Pre-Brandy scheduling-UX pass. No migration.

- **Build mode is now ONE command strip.** The shared state moved to `lib/build-mode.ts`
  (`setBuildMode`/`isBuildMode` + a `rx-build-mode` window event); `build-mode-toggle.tsx` and the matrix
  both subscribe so the toggle label and the strip's **⤢ Exit** button stay in sync. In build mode
  `schedule-matrix.tsx` renders a single ~44px bar — **date nav (◀ Today ▶) · view pills (Wk/2wk/Mo) ·
  location select · honest status pill (`statusShort`) · flags · Ask AI · Copy · Export · Publish · ⤢ Exit** —
  and hides the normal toolbar, the filters row, and the work-type legend. `schedule/page.tsx` passes
  `view`/`anchor` + the Ask-AI props (`aiPeriodId`/`aiLocationId`/`aiRefDate`/`aiContextNote`) into the matrix
  and wraps its own LocationNav / window-nav row / Ask-AI bar in the `schedule-chrome` class so they hide
  under `html.schedule-build`. Result: ~16–17 staff rows on a 1366×768 laptop (was ~11). The strip's nav
  Links derive prev/next from the day just outside the window (uniform across week/2-week/month).
- **Grid uses `table-fixed`** with fixed staff (180px) + day (120px) widths so a long work-type label can't
  widen its column (Susie's "Thursday is wider" finding). Verified live on OptumRx.
- **Holiday column** is one tinted, framed unit (header + body) in light AND dark mode regardless of cell
  state, via the inline `HOLIDAY_CELL_STYLE` overlay + inset accent lines in `schedule-grid.tsx` (composes
  over the state background; can't be lost to Tailwind border-class ordering). Header shows ★ + the holiday
  name. Settings → Holidays list shows the year per row.
- **Prompter → v4.1** (beat 6 reworded for the strip + ⤢ Exit). DEMO-GUIDE / FEATURE-MAP updated.

## Build ⇄ View split + PTO conflict flag + published-edit fix (June 23, 2026)

The big scheduling-UX decision, shipped + verified live (Optum monthly, Mesa Vista weekly). No migration.

- **Two surfaces, one shared grid.** **Build Schedule** (`/app/schedule`, managers/schedulers — CONFIG
  roles; others redirect to View) is **cadence-locked**: the window IS one `tenant.schedule_cycle` period.
  `schedule/page.tsx` uses `cadenceWindow()` + `periodLabel()`, drops the week/2-week/month pills, shows
  "Building: <period>" + period steppers, and the copy button is cadence-aware ("Copy last month's
  pattern"). **View Schedule** (`/app/view-schedule`, ALL roles, new nav item) is read-only,
  **published-only**, week/2-week/month zoom + the chip filters — new `schedule-view.tsx`. Both render
  `schedule-grid.tsx` (added a `readOnly` prop) so they can't drift. The old "Build mode" toggle is now
  the **"⤢ Maximize"** chrome-collapse (still on Build). Nav split in `sidebar.tsx`.
- **PTO conflict = a flag (Option B).** A shift on a day the person is off (pto_day or approved TOR) is
  detected in `validateBundle` (engine stays PTO-agnostic), joins `constraintFlags` (→ Open Flags +
  publish gate), and the matrix routes `rule_type === "pto_conflict"` to the **red** deficiency
  treatment. Demo: Optum = Ashley Dinh Fri Jun 26; Mesa Vista = Keisha Brown Fri (seeded, NOT in
  `ptoExcluded`).
- **Published-edit fix.** `upsertShift` sets the shift's `status` to its covering period's status —
  saving into a published period is live immediately; building a draft stays hidden until publish.
  (Previously new shifts defaulted to `draft` and never reached staff on a published schedule.)
- **1000-row cap fix.** `fetchAllRows()` (paginates) + `fetchSegmentsByShiftIds()` (chunks the
  `shift_id=in.(…)` list by 100 to dodge the URI-too-long 400) in `schedule-data.ts`, used by both
  loaders + `copyForwardWindow`. Fixed copy-forward dropping segments + month view loading no shifts.
- **Filters:** departments is now a chip row (was a dropdown); the bottom color legend is gone.
- **Prompter → v4.2.** Phase 2 (multi-manager submit → review → publish) is designed, NOT built — see
  `docs/decisions.md` / the Susie feedback paragraph.

## Pending TODOs (as of June 13, 2026)

- [ ] **Provision Susie's platform-admin account** — needs her NEW admin email (separate from her customer logins), then: `npx tsx scripts/provision-user.ts --platform-admin --email <addr> --note "Susie - co-founder"`. Also add it to the author map in `lib/actions/crm.ts`.
- [ ] **Website interactive demo / screenshots** — UNBLOCKED by Mesa Vista demo tenant. Format decision pending (screenshots, video, or interactive embed). Homepage/pricing have no product visuals yet.
- [x] **Compliance engine roadmap** — SHIPPED June 19, 2026 (R072-25 build): certified vs non-certified tech logic (Tennessee), trainee supervision sub-limits (R072-25), and the solo-pharmacist floor are all in the engine behind the `nevada_r072_25` toggle / TN state. Volume thresholds (Sec 2.2) remain **collect-only** by design (Decision 4) — expected Rx is shown, never enforced.
- [x] **Shared rate limiting on `/api/auth/login-link` and `/api/contact`** — DONE June 23, 2026 (security pass): cross-instance via the `rate_limit` table + `check_rate_limit` RPC (`lib/rate-limit-db.ts`), per email + IP. Closed the email-bomb vector + the login-link enumeration oracle. See CHANGELOG 2026-06-23 security entry.
- [ ] Owner-facing alias management UI — before public launch.
- [ ] **Security follow-ups (Jamison's call, from the June 23 audit):** confirm OpenAI DPA/zero-retention for staff-name+schedule egress; add a Content-Security-Policy (other security headers already shipped); add the Cloudflare Turnstile keys to activate the demo-form CAPTCHA (built June 23, dormant until `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set); enable Supabase "leaked password protection" (dashboard); audit-log platform-admin emulation/tenant-switch.
- [ ] CRM v2 polish after Susie uses it (no pagination, no stage analytics, client-side filter only — deliberately basic for now).
- [ ] **Sentry + uptime monitoring — first customer trigger.** Also: Supabase Pro upgrade (backups/PITR), move Vercel hosting off personal account. The Vercel paid plan also **unlocks sub-daily cron cadence** — only then change `/api/cron/live-ratio-check` in `vercel.json` to `* * * * *` for near-real-time live out-of-ratio email alerts (Hobby caps crons at daily and rejects the deploy otherwise).
- [ ] **Browser/visual walkthrough of the June 13 surfaces before the next demo** — create-next-period, sticky headers, view selector + published/draft cutoff, Settings → Statuses, live alert path, branding (color + logo, both modes), help (tenant vs platform-admin). Build + tests are green; this is the visual pass.
- [x] Tennessee cert-dependent ratio enforcement — SHIPPED June 19, 2026 (per Tenn. Comp. R. & Regs. 1140-02-.02: 6 non-certified techs per pharmacist, certified/CPhT uncapped). Verify the exact board language before a TN customer relies on it.
- [ ] Fill in legal entity name, address, governing law/venue in `/terms` + `/privacy` before first customer.
- [ ] Delete test CRM leads: "Verification Pharmacy" (crm-test@rxshift.io) and "Branded Email Test Pharmacy" (email-test@rxshift.io).
- [x] README.md rewritten — done June 13, 2026.

### Done (June 12, 2026)
- [x] Dark mode (app-only, marketing stays light) — shipped
- [x] Both GitHub remotes current: `vercel` (deploy path) + `origin` (RxShift/RxShift) — collaborator added
- [x] Attorney reviewed /terms + /privacy — approved, "Draft" notices removed
- [x] DMARC TXT record — added by Jamison in Cloudflare
- [x] Branded Supabase magic-link template — pasted by Jamison in dashboard

### v1 simplifications to revisit
- Location operating hours: schema supports per-day hours; no UI editor yet (engine doesn't need it).
- Staff import is CSV-only (no XLSX).
- PDF export = browser print view (no server-side PDF generation).
- Swap proposals don't pre-compute ratio effect at peer-accept; the manager sees the engine check via the AI command path and post-apply revalidation.
- Branding (logo upload) deferred — needs Supabase Storage setup.
- Departments step in onboarding is skipped (manageable in Settings).

@AGENTS.md

# RxShift — Project Context
# Last updated: June 13, 2026
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

### The five files you must consider after every session

| File | Update when… |
|------|-------------|
| **`CHANGELOG.md`** | Every session without exception. One H2 entry: date + summary heading, then Shipped / Schema / Infrastructure / Open sections. Bullets, not prose. This is what a future agent reads first to understand current state — keep it honest. |
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

---

## Development Rules

- **Always `git pull` before starting work** — standard discipline.
- **Commit frequently** with plain-English messages.
- **Never push without Jamison's explicit approval.**
- For any multi-step task, create a task list before starting.
- Match the brand spec in `Brand Items/DESIGN.md` for all UI work — do not improvise colors or typography.
- When adding new API routes, check whether the Supabase keep-alive cron is in place first (required for free-tier).
- **Documentation: see the Documentation Discipline section above. It is mandatory, not advisory.**

## Phase 2 (built June 12, 2026)

- **Tenant lifecycle + email safety:** `tenant.status` (setup→trial→live), recipient allowlist, owner Go Live, plus **demo mode** (`is_demo` + `demo_redirect_email` — demo email is redirected to one inbox or suppressed; demo tenants never go live). Gate lives in `lib/email-policy.ts` / `sendNotificationEmail` — every send passes through it.
- **Login aliases:** one account, multiple sign-in emails (`login_alias` table, `/api/auth/login-link`, `/app/auth/confirm` token-hash flow — survives Outlook link scanners). Manage via `scripts/provision-user.ts --add-alias`.
- **Unpaid breaks:** `shift.break_minutes` + `tenant.default_break_minutes`; paid-hours math subtracts per shift; ratio coverage untouched.
- **Internal CRM:** `/app/admin/leads` (platform admins only; service-role tables `leads`/`lead_notes`). Website forms auto-capture leads with source page; duplicates merge via notes.
- **Website:** interactive `/pricing` calculator, `/nevada` R113-24 deep-dive, `/states/california` + `/states/tennessee` stubs (Coming Soon), `/vs/when-i-work` battle card, States nav dropdown, columned footer. Marketing copy is HONEST about engine scope: volume minimums, certified/non-certified, trainee limits are ROADMAP, not shipped.
- **Mesa Vista Pharmacy demo tenant:** fully fictional, 3 NV locations, 14 staff, 7 date-anchored weeks, engine-real Henderson Thursday 2–4 PM deficiency. Login: `demo@rxshift.io` (alias → Frank DiMaggio, catch-all delivers to Jamison). Reset: admin console "Restore demo data" or `npx tsx scripts/seed-mesa-vista.ts --reset` (core in `lib/demo/mesa-vista.ts`).

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
- Marketing pricing page: removed the R113-24 roadmap paragraph.

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

## Schedule scroll fix (built June 15, 2026)

- **Sticky header + reachable horizontal scrollbar.** `ScheduleGrid` is now a
  height-capped, internally-scrolling region (`overflow-auto` + a runtime-measured
  `max-height`, `ResizeObserver` on `document.body`). The previous full-height,
  page-scrolling grid couldn't keep the `sticky top-0` header on screen (an
  `overflow-x` box scrolls on both axes, so the header stuck to a box that scrolled
  away) and buried the horizontal scrollbar at the page bottom. Capping the height is
  the fix. Do **not** revert to "no height cap" — that reintroduces both bugs.
- **Condensing chrome (editor only).** On grid scroll, the pills/AI bar/toolbar/flag
  list collapse to a slim pinned strip (`Location · Period · status · flag count`);
  click to expand. Chrome is CSS-hidden, not unmounted (preserves AI-bar input). The
  editor chrome (`ViewNav`/`ViewModeNav`/`AiCommandBar`) is passed from
  `schedule/page.tsx` into `ScheduleBuilder` as `nav`/`aiBar` props so it can respond
  to the grid's `onCondensedChange`. Range views inherit the grid fix; no condense.
- **All-locations overview** got the same sticky/scroll treatment per section
  (`border-separate` so sticky cells work in Chrome). UI-only; no schema/API changes.

## Pending TODOs (as of June 13, 2026)

- [ ] **Provision Susie's platform-admin account** — needs her NEW admin email (separate from her customer logins), then: `npx tsx scripts/provision-user.ts --platform-admin --email <addr> --note "Susie - co-founder"`. Also add it to the author map in `lib/actions/crm.ts`.
- [ ] **Website interactive demo / screenshots** — UNBLOCKED by Mesa Vista demo tenant. Format decision pending (screenshots, video, or interactive embed). Homepage/pricing have no product visuals yet.
- [ ] **Compliance engine roadmap** (marketing frames these as roadmap): scripts-per-hour volume minimums (R113-24), certified vs non-certified tech fields + ratio logic, trainee supervision sub-limits (`ratio_rule.trainee_sublimits` JSONB exists but is unread).
- [ ] Owner-facing alias management UI + shared rate limiting on `/api/auth/login-link` and `/api/contact` — before public launch.
- [ ] CRM v2 polish after Susie uses it (no pagination, no stage analytics, client-side filter only — deliberately basic for now).
- [ ] **Sentry + uptime monitoring — first customer trigger.** Also: Supabase Pro upgrade (backups/PITR), move Vercel hosting off personal account. The Vercel paid plan also **unlocks sub-daily cron cadence** — only then change `/api/cron/live-ratio-check` in `vercel.json` to `* * * * *` for near-real-time live out-of-ratio email alerts (Hobby caps crons at daily and rejects the deploy otherwise).
- [ ] **Browser/visual walkthrough of the June 13 surfaces before the next demo** — create-next-period, sticky headers, view selector + published/draft cutoff, Settings → Statuses, live alert path, branding (color + logo, both modes), help (tenant vs platform-admin). Build + tests are green; this is the visual pass.
- [ ] Tennessee cert-dependent ratio enforcement — BLOCKED on TN's actual rule (two research sources contradict; see docs/decisions.md). CPhT tracking already shipped.
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

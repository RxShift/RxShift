# RxShift Changelog

Newest-first. One entry per build session. This file is updated after every commit and
is the fast-read reference for what shipped, what's pending, and what changed in
infrastructure. Full context lives in `CLAUDE.md`; infrastructure details in
`INFRASTRUCTURE.md`.

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

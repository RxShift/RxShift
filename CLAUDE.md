@AGENTS.md

# RxShift — Project Context
# Last updated: June 11, 2026
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

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| CSS | Tailwind CSS 4 |
| Database / Auth | Supabase (direct client — no Prisma) |
| Email | Resend |
| Hosting | Vercel (pending authorization — use local dev for now) |
| AI | TBD — not yet integrated |

**Local dev port:** `3200` (first in the JWC LLC port range 3200–3299)
**Run with:** `npm run dev` (port pinned in package.json)

---

## Accounts & Credentials

**Full infrastructure detail lives in `INFRASTRUCTURE.md`** — accounts, DNS
records, the demo-request email flow, and email troubleshooting steps. Keep
that file current; Jamison drops updates into it from outside Claude Code.

| Service | Account | Notes |
|---------|---------|-------|
| GitHub | RxShift (`github@rxshift.io`) | Repo: RxShift/RxShift. Separate from Jamison's personal/MSP+/TimeZest |
| Supabase | `supabase@rxshift.io` | Project ID: `cnhpaxucnbgxazpbvtod` |
| Resend | `resend@rxshift.io` | Sends from hello@rxshift.io; domain verified |
| Cloudflare | `jamison@jamisonwest.com` | DNS + Email Routing: catch-all `*@rxshift.io` → jamison@jamisonwest.com (M365) |
| Vercel | `github@rxshift.io` | NOT YET AUTHORIZED (phone verification pending with Vercel support) |

**Environment variables** are in `.env.local` (gitignored). See `.env.example` for the template.

**Supabase project:** `https://cnhpaxucnbgxazpbvtod.supabase.co`
**Free tier** — keep-alive cron required (every 3 days). Standard pattern: `/api/cron/keep-alive` route + `vercel.json` entry. **Add this when Vercel is connected.**

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

The full v1 build is complete per `docs/RxShift-Product-Scoping.md` (the authoritative scope doc — read it). **The database schema is written but NOT yet applied to Supabase** (migrations in `supabase/migrations/`, application pending a personal access token from Jamison).

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
- **Keep-alive cron:** `/api/cron/keep-alive` + `vercel.json` (activates when Vercel connects).

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

## Development Rules

- **Always `git pull` before starting work** — standard discipline.
- **Commit frequently** with plain-English messages.
- **Never push without Jamison's explicit approval.**
- For any multi-step task, create a task list before starting.
- Match the brand spec in `Brand Items/DESIGN.md` for all UI work — do not improvise colors or typography.
- When adding new API routes, check whether the Supabase keep-alive cron is in place first (required for free-tier).
- Do not use AI APIs until Jamison explicitly says to add them.

## Phase 2 (built June 12, 2026)

- **Tenant lifecycle + email safety:** `tenant.status` (setup→trial→live), recipient allowlist, owner Go Live, plus **demo mode** (`is_demo` + `demo_redirect_email` — demo email is redirected to one inbox or suppressed; demo tenants never go live). Gate lives in `lib/email-policy.ts` / `sendNotificationEmail` — every send passes through it.
- **Login aliases:** one account, multiple sign-in emails (`login_alias` table, `/api/auth/login-link`, `/app/auth/confirm` token-hash flow — survives Outlook link scanners). Manage via `scripts/provision-user.ts --add-alias`.
- **Unpaid breaks:** `shift.break_minutes` + `tenant.default_break_minutes`; paid-hours math subtracts per shift; ratio coverage untouched.
- **Internal CRM:** `/app/admin/leads` (platform admins only; service-role tables `leads`/`lead_notes`). Website forms auto-capture leads with source page; duplicates merge via notes.
- **Website:** interactive `/pricing` calculator, `/nevada` R113-24 deep-dive, `/states/california` + `/states/tennessee` stubs (Coming Soon), `/vs/when-i-work` battle card, States nav dropdown, columned footer. Marketing copy is HONEST about engine scope: volume minimums, certified/non-certified, trainee limits are ROADMAP, not shipped.
- **Mesa Vista Pharmacy demo tenant:** fully fictional, 3 NV locations, 14 staff, 7 date-anchored weeks, engine-real Henderson Thursday 2–4 PM deficiency. Login: `demo@rxshift.io` (alias → Frank DiMaggio, catch-all delivers to Jamison). Reset: admin console "Restore demo data" or `npx tsx scripts/seed-mesa-vista.ts --reset` (core in `lib/demo/mesa-vista.ts`).

**Spec workflow:** feature specs land in `docs/specs/`; once implemented they move to `docs/specs/_archive/` (see `docs/specs/README.md`). Archived specs are history — code + this file are the source of truth.

## Pending TODOs (as of June 12, 2026)

- [ ] **Provision Susie's platform-admin account** — needs her NEW admin email (separate from her customer logins), then: `npx tsx scripts/provision-user.ts --platform-admin --email <addr> --note "Susie - co-founder"`. Also add it to the author map in `lib/actions/crm.ts`.
- [ ] **Website interactive demo / screenshots** — now UNBLOCKED by the Mesa Vista demo tenant. Needs a decision on format (screenshots, video, or interactive embed) and imagery production. The homepage/pricing currently have no product visuals.
- [ ] **Compliance engine roadmap** (marketing already frames these honestly as roadmap): scripts-per-hour volume minimums (R113-24 — read `volume_data`, new "understaffed for volume" deficiency type), certified vs non-certified tech fields + ratio logic, trainee supervision sub-limits (`ratio_rule.trainee_sublimits` JSONB exists but is unread).
- [ ] Push to the RxShift-account GitHub repo (`origin` → RxShift/RxShift) — needs that account's PAT; `vercel` remote (jamisonwest-ship-it/rx-shift) is the deploy path and works.
- [ ] Owner-facing alias management UI + real rate limiting on `/api/auth/login-link` before public launch.
- [ ] **Dark mode** (Jamison wants it) — needs a real theming pass: brand tokens in `globals.css` get a `.dark` variant AND the many hardcoded hex values (`#FEF7ED`, `#C0392B`, shadows, email-style colors) move to tokens first. Do as its own pass; don't rush it.
- [ ] CRM v2 polish after Susie uses it (it's deliberately basic: no pagination, no stage analytics, client-side filter only).

### v1 simplifications to revisit
- Location operating hours: schema supports per-day hours; no UI editor yet (engine doesn't need it).
- Staff import is CSV-only (no XLSX).
- PDF export = browser print view (no server-side PDF generation).
- Swap proposals don't pre-compute ratio effect at peer-accept; the manager sees the engine check via the AI command path and post-apply revalidation.
- Branding (logo upload) deferred — needs Supabase Storage setup.
- Departments step in onboarding is skipped (manageable in Settings).

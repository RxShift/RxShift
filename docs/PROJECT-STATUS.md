# RxShift — Project Status
**Last updated:** June 19, 2026
**Entity:** JWC LLC (Jamison West Consulting)
**Managed in:** Cowork (codebase) + Claude.ai RxShift project (strategy/chat)

> Upload this file to the Claude.ai RxShift project to keep both environments in sync.
> Regenerate after every significant Cowork session.

---

## What It Is

B2B SaaS scheduling platform for retail pharmacies (1–25 locations). Embeds state-regulated pharmacist-to-technician ratio rules into the schedule so deficiencies surface before they become violations.

**Tagline:** Compliance-ready pharmacy scheduling
**Target:** Independent pharmacy owners and managing pharmacists, 1–25 locations
**GTM:** Nevada first (current law NAC 639.250; proposed R072-25 is forward context), California second, Tennessee supported
**Customer #1:** Southwest Medical (Optum-owned, Las Vegas) — Susie is the champion and design partner

---

## Build Status: COMPLETE (v1 + Phase 2 + retail-ready + June 13 UX pass + June 15 schedule rebuild + June 16 platform email/feedback)

Full product built June 11–16, 2026. All features are live in the repo (`tsc` clean, 45 vitest tests, `next build` clean); migrations 0001–0021 applied to Supabase. **The June 16 platform-email/feedback build is deployed to production and verified end-to-end** (live demo-form submission produced a CRM lead + a logged email with rendered body; the Resend delivery webhook updated it to `delivered`).

### What Exists in the App

| Area | Status |
|---|---|
| Two-domain architecture (rxshift.io / app.rxshift.io) | Live |
| Supabase Auth (magic link) + RLS + multi-tenant roles | Live |
| Deterministic compliance engine (slot-based, 45 vitest tests) | Live |
| Schedule builder (periods, grid, PTO, copy-forward, publish, CSV export) | Live |
| Requests: time-off, callouts, manager-mediated swaps | Live |
| Onboarding wizard (7 screens, AI ratio proposal, CSV roster import) | Live |
| AI layer (OpenAI gpt-4o-mini, server-side): help assistant, flag explanations, NL schedule commands | Live |
| Compliance log (/app/log): hourly per zone, CSV + print export, override log | Live |
| Live ratio board (/app/board): schedule + live-status overlay | Live |
| My Schedule (/app/me): 2-week grid, requests, team this week | Live |
| Reports (/app/reports): 4 XLSX exports (compliance, roster, schedule, audit) | Live |
| California enforcement (BPC 4115, 2P−1 additive formula, tested) | Live |
| CPhT tracking on staff (informational; TN enforcement deferred) | Live |
| Dark mode (app-only; marketing always light) | Live |
| Work-type colors (16-swatch palette; compliance is a separate ring channel) | Live |
| Schedule grid redesign (role-banded rows, ShiftBlock shared component) | Live |
| All-locations overview (/schedule?view=all, read-only) | Live |
| Internal CRM (/app/admin/leads, platform-admin only) | Live |
| Demo mode (is_demo + redirect gate; demo tenants never go live) | Live |
| Mesa Vista Pharmacy demo tenant (3 NV locations, 14 staff, 7 date-anchored periods) | Live |
| Tenant lifecycle (setup → trial → live) + email allowlist + Go Live flow | Live |
| Login aliases (one account, multiple sign-in emails; Outlook-safe) | Live |
| Unpaid breaks (shift.break_minutes; ratio coverage untouched) | Live |
| Branded email everywhere (brandedEmailHtml, Resend; Supabase template for new signups only) | Live |
| Billing scaffold (lib/pricing.ts, isTenantEntitled enforcement point, permissive until Stripe) | Live |
| Legal (/terms + /privacy, attorney-reviewed June 12) | Live |
| Marketing: homepage, /pricing calculator, /nevada, /states/california, /vs/when-i-work, footer | Live |
| Security pages (/security + /app/security-posture) | Live |
| Board containment policy (RxShift never contacts a board — contractual in Terms §6) | Live |
| Schedule: create-next-period button + period steppers, land-on-today | Live (June 13) |
| Schedule: sticky staff column + date header (spreadsheet-style) | Live (June 13) |
| Schedule: view selector (week / 2-week / month) decoupled from build cycle, published/draft cutoff | Live (June 13) |
| Out-of-ratio cue: fill-independent ⚠ corner badge | Live (June 13) |
| Configurable live statuses (per-tenant show/hide, rename, counts-toward-ratio) — Settings → Statuses | Live (June 13) |
| Live out-of-ratio alerts (managers, in-app + gated email, grace + cooldown; cron) | Live (June 13)* |
| Mobile-first My Schedule (agenda on phones) | Live (June 13) |
| Light tenant branding (accent color + logo URL; RxShift mark always shown) — Settings → Branding | Live (June 13) |
| Admin-only help (RLS-gated) + expanded help library | Live (June 13) |
| Per-location ratio + unified person-centric schedule matrix (ratio zones removed) | Live (June 15) |
| Staff avatars (1:1 crop → private Storage bucket, signed URLs) | Live (June 15) |
| **Centralized email path (`sendEmail`) + email log** (`/app/admin/emails`, actual-form view, xlsx export) | Live (June 16) |
| **Email deliverability webhook + system-issues-into-feedback loop** | Live (June 16) |
| **In-app feedback / bug / feature capture + triage** (`/app/admin/feedback`) | Live (June 16) |
| **Demo-safe admin chrome** (Platform nav hidden while emulating; slim banner) | Live (June 16) |
| **M365 shared mailbox** sending as hello@ (brand email; DKIM/SPF authenticated) | Live (June 16) |
| **Schedule-derived live presence** (Off shift vs Working; published-only; today-only status) | Live (June 16) |
| **Delete leads** (platform admin, confirm-by-name) | Live (June 16) |
| **Co-branding lockup** (RxShift mark │ tenant logo divider) + **`?screenshot=true`** clean-capture | Live (June 16) |

\* Per-minute alert delivery needs a paid Vercel plan; on the free plan the cron runs ~daily and the on-screen board badge is the real-time signal.

### Database (Supabase)

Project: `cnhpaxucnbgxazpbvtod` (supabase@rxshift.io)

| Migration | What it did |
|---|---|
| 0001–0005 | Core schema: tenant, location, staff, schedule, shifts, segments, ratio rules, constraints, live status, audit, platform admin, RLS (applied before MCP tracking — not in list_migrations, but schema is live) |
| 0006_email_safety | tenant.status + email_allowlist |
| 0007_login_alias | login_alias table |
| 0008_break_minutes | shift.break_minutes + tenant.default_break_minutes |
| 0009_leads_crm | leads + lead_notes (service-role) |
| 0010_demo_mode | tenant.is_demo + tenant.demo_redirect_email |
| 0011_billing_scaffold | tenant billing columns |
| 0012_help_articles | help articles seed data |
| 0013_ca_formula_and_certs | CA additive formula fields + staff.certified |
| 0014_work_type_colors | work_type.color + curated palette backfill |
| 0015_live_status_config | live_status_config + live_ratio_alert_state (configurable statuses + alert grace/cooldown state) |
| 0016_help_admin_only | help_article.admin_only column + help_select RLS rewrite (admin docs gated to platform admins) |
| 0017_help_content_overhaul | rewrote "Building a schedule" + added 5 tenant + 4 admin help articles |
| 0018_per_location_ratio | ratio per location (dropped ratio_zone); departments tenant-level; tenant.require_department; staff.avatar_path; private avatars bucket |
| 0019_email_log | email_log (service-role; every send + status + rendered body) |
| 0020_feedback | feedback (user + system issues; service-role) + private feedback bucket |
| 0021_help_feedback | help articles for feedback + the platform email log |

---

## Infrastructure

### Accounts

| Service | Account | Status |
|---|---|---|
| Cloudflare | jamison@jamisonwest.com | Active — DNS + email routing |
| GitHub | github@rxshift.io (RxShift/RxShift) | Active |
| Supabase | supabase@rxshift.io | Active — free tier |
| Resend | resend@rxshift.io | Active — sends from hello@rxshift.io |
| Vercel | github@rxshift.io | Pending phone verification (see below) |

### Domain & Email

- Domain: rxshift.io (Cloudflare, $50/yr, auto-renews June 11, 2027)
- Catch-all: `*@rxshift.io` → jamison@jamisonwest.com (M365)
- **`hello@rxshift.io` → M365 shared mailbox "RxShift" (June 16)** — a specific Cloudflare rule overrides the catch-all for hello@ only; the team sees demo requests + replies there. Sending as hello@ uses the shared mailbox (Send As) with rxshift.io DKIM/SPF.
- Resend DKIM/SPF verified; DMARC added June 12, 2026
- demo@rxshift.io, jerome@rxshift.io, patricia@rxshift.io (Mesa Vista demo logins) — all forward to Jamison

### Vercel Situation

App is live on the **personal Vercel account** (jamisonwest-ship-it) at app.rxshift.io as an interim deployment. A dedicated RxShift Vercel account (github@rxshift.io) was requested June 11 — blocked on phone verification. Email sent to registration@vercel.com; awaiting response.

Deploy path today: push to `vercel` remote (jamisonwest-ship-it/rx-shift). Also push `origin` (RxShift/RxShift) to keep the canonical repo current.

**Action needed:** Verify the keep-alive cron is active on the personal Vercel account (Settings → Cron Jobs → rx-shift project). Required to keep Supabase free tier from pausing.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| CSS | Tailwind CSS 4 |
| Database / Auth | Supabase (direct client — no Prisma) |
| Email | Resend |
| AI | OpenAI gpt-4o-mini (server-side only, lib/ai.ts) |
| Hosting | Vercel |

Local dev port: **3200** — run with `npm run dev`

---

## Demo Tenants

### Mesa Vista Pharmacy (primary demo)
- 3 NV locations: Spring Valley, Henderson, Summerlin
- 14 fictional staff (@mesavistarx.com)
- 7 date-anchored weekly periods (re-anchors on reset)
- Engine-real Henderson Thursday 2–4 PM deficiency
- Login: demo@rxshift.io (Frank DiMaggio, owner)
- Also: jerome@rxshift.io (staff), patricia@rxshift.io (Dr. Nguyen, scheduler — Susie's demo identity)
- Reset: admin console "Restore demo data" or `npx tsx scripts/seed-mesa-vista.ts --reset`

### OptumRx Demo
- 44 staff (real Optum names, NULL emails), outbound email suppressed
- Reset: `npx tsx scripts/seed-demo.ts` (assumes clean state)

---

## Key Scripts

Full docs in `docs/SCRIPTS.md`. Quick reference:

```bash
npx tsx scripts/seed-mesa-vista.ts --reset   # reset Mesa Vista demo
npx tsx scripts/seed-demo.ts                 # seed OptumRx demo (clean state)
npx tsx scripts/seed-live-now.ts             # seed live board status for demos
npx tsx scripts/provision-user.ts --help     # provision/alias/cleanup users
```

---

## Open To-Dos

### Blocking first customer
- [ ] Fill in legal entity name, address, governing law/venue in /terms + /privacy
- [ ] Sentry + uptime monitoring
- [ ] Supabase Pro upgrade (backups/PITR)
- [ ] Move Vercel hosting off personal account (waiting on Vercel support)
- [ ] Owner-facing alias management UI (currently scripts-only)
- [ ] Shared rate limiting on /api/auth/login-link and /api/contact

### Waiting on Jamison
- [ ] Provision Susie's platform-admin account: needs her new admin email, then `npx tsx scripts/provision-user.ts --platform-admin --email <addr> --note "Susie - co-founder"` — also add to author map in lib/actions/crm.ts
- [ ] Verify keep-alive cron is active in personal Vercel account
- [ ] Vercel RxShift account authorization (waiting on registration@vercel.com)
- [ ] M365 send-as hello@rxshift.io (steps in INFRASTRUCTURE.md) — low urgency

### Product roadmap
- [ ] Website interactive demo / screenshots — format decision pending (Mesa Vista is ready to demo)
- [ ] Stripe billing integration (enforcement point exists, permissive until wired)
- [x] Tennessee cert-dependent ratio enforcement — SHIPPED June 19, 2026 (6 non-certified per RPh, CPhT uncapped)
- [ ] CRM v2: pagination, stage analytics, export — after Susie uses v1
- [x] Compliance engine roadmap — SHIPPED June 19, 2026 (R072-25): certified/non-certified logic, trainee sub-limit, solo-pharmacist floor. Volume thresholds stay collect-only (never enforced).

### Cleanup
- [ ] Delete test CRM leads: "Verification Pharmacy" (crm-test@rxshift.io) and "Branded Email Test Pharmacy" (email-test@rxshift.io)

---

## Standing Decisions

**Scope boundary:** RxShift is a scheduling + ratio-enforcement + compliance-logging tool. Volume-based minimums (R072-25 Sec 2.2) are collect-only — expected Rx is shown, never enforced. The proposed rule (R072-25) is forward context, not a current-law claim.

**Nevada regulatory posture (June 19, 2026):** Current law (NAC 639.250) is enforced on every shift. Proposed **R072-25** (public hearing June 4, 2026; not adopted) is implemented behind the `nevada_r072_25` tenant toggle — 4-tech ceiling, 2-trainee sublimit, solo-pharmacist floor (±drive-through). Only current law is claimed in marketing.

**Board containment:** RxShift never contacts any board of pharmacy or regulator. A sustained run of deficient days alerts the pharmacy's own managers; the pharmacy decides whether and how to report. Contractual in Terms §6.

**Honest marketing:** Website claims only what the engine actually does. Everything else is explicitly "on the roadmap."

**Tennessee enforcement — SHIPPED June 19, 2026:** Per Tenn. Comp. R. & Regs. 1140-02-.02 — 6 non-certified techs per pharmacist, certified (CPhT) uncapped. Engine applies it when the ratio rule's state is TN. Verify current board language before a TN customer relies on it.

**California shipped:** BPC 4115 (2P−1 additive formula) is enforced, tested, and marketed in present tense.

**Pricing centralized:** `lib/pricing.ts` is the single source of price truth. Provider is 'manual' today; Stripe later.

**Demo tenants:** Fictional data only, email gate, never go live, resettable.

**Work-type colors (Susie/Optum feedback):** Shift fill = work-type color. Compliance = separate ring channel (red ring + ⚠ for deficient, amber ring for constraints). Red and amber reserved for compliance only across the whole product.

---

## Pricing

| Tier | Monthly | Annual |
|---|---|---|
| 1 location | $199/mo | $1,990/yr |
| 2–5 locations | $169/location/mo | $1,690/location/yr |
| 6+ locations | $149/location/mo | $1,490/location/yr |

Anchored above When I Work (~$120/mo), far below enterprise WFM. No per-seat fees.

---

## Documentation Map

| File | What it covers |
|---|---|
| CLAUDE.md | Master context: architecture, accounts, phases, open TODOs |
| CHANGELOG.md | What shipped per session — schema changes, infra updates |
| INFRASTRUCTURE.md | DNS, email routing, service accounts, Vercel setup steps |
| docs/decisions.md | Why things were built the way they were |
| docs/SCRIPTS.md | How to run every operational script with flags and examples |
| Brand Items/DESIGN.md | Full design system (colors, typography, components) |
| docs/RxShift-Product-Scoping.md | Authoritative product scope document |

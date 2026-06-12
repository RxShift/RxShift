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

## Product Architecture (Planned)

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

## Pending TODOs (as of June 11, 2026)

- [ ] Authorize Vercel account (blocked on phone number — Jamison's action item)
- [ ] Connect GitHub repo to Vercel once authorized
- [ ] Add `vercel.json` with keep-alive cron once Vercel is connected
- [ ] Confirm `RESEND_FROM_EMAIL` address (domain rxshift.io is set up; from address TBD)
- [ ] Define auth strategy (magic link vs. email/password)
- [ ] Define initial Supabase schema (organizations, locations, staff, ratio_rules, schedules, compliance_logs)
- [ ] Build marketing homepage at `/`
- [ ] Build first app screen (dashboard or schedule builder — TBD)

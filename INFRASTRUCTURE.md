# RxShift: Infrastructure Setup
Tag: [JWC] | Last updated: June 13, 2026 | Status: Live — Vercel RxShift account authorization still pending (phone issue)

> **This file is the RxShift operational runbook** — DNS, email flow, M365 send-as, troubleshooting, cost. It stays in
> the repo so it travels with the product. Jamison drops updates here from outside Claude Code; Claude Code keeps it
> current and folds anything code-relevant into CLAUDE.md.
>
> The **cross-entity account/tier fingerprint** (which GitHub/Vercel/Supabase account + plan, MCP reach, deploy
> mechanics) is canonical in **`C:\dev\INFRASTRUCTURE.md`** (rx-shift section). If the two disagree on an account
> fact, that master wins.

---

## Domain

| Item | Detail |
|---|---|
| Domain | rxshift.io |
| Registrar | Cloudflare (purchased June 11, 2026) |
| Annual cost | $50/year |
| Auto-renew | On — renews June 11, 2027 |
| DNS | Cloudflare (same account, automatic) |
| rxshift.com | Unavailable, owned by someone else, not pursuing |

---

## Cloudflare Account

| Item | Detail |
|---|---|
| Login email | jamison@jamisonwest.com |
| Account type | Free |
| DNS management | Full (Cloudflare is authoritative) |

---

## Email

### Forwarding (Cloudflare Email Routing)
- Catch-all rule: `*@rxshift.io` → `jamison@jamisonwest.com` (Microsoft 365)
- Status: Active and verified
- Any address invented on the fly (e.g. `hello@rxshift.io`, `vercel@rxshift.io`) automatically forwards — no pre-configuration needed

### Transactional Email (Resend)
| Item | Detail |
|---|---|
| Account login | resend@rxshift.io |
| Sending domain | rxshift.io |
| From address | hello@rxshift.io (site emails); demo requests land at info@rxshift.io |
| Status | Verified (DKIM, SPF verified; DMARC added June 12, 2026 ✓) |
| DNS provider | Cloudflare (auto-configured via Resend integration) |
| Region | us-east-1 (North Virginia) |
| Free tier | 3,000 emails/month, 100/day |

### Demo-request email flow (verified end-to-end June 11, 2026)

```
Visitor submits form on rxshift.io/#demo
  → POST /api/contact (Next.js route)
  → (1) creates a CRM LEAD (/app/admin/leads) — the PERMANENT record
  → (2) Resend API sends FROM hello@rxshift.io TO info@rxshift.io
      (replyTo = the visitor's email, so replying reaches the prospect)
  → Cloudflare MX accepts (Resend dashboard shows "delivered" here)
  → Cloudflare catch-all forwards to jamison@jamisonwest.com (M365)
  → Lands in Jamison's Outlook inbox — OR Junk, OR M365 quarantine
```

The CRM lead is the system of record — the email is only a heads-up copy. See "The
complete email flow" below for how this fits the whole picture.

**Troubleshooting "the email never arrived":**
1. Check the Resend dashboard (or API) first — if status is `delivered`,
   Resend and Cloudflare did their jobs; the problem is on the M365 side.
2. Check **Junk Email** in Outlook. Forwarded mail from a brand-new domain
   very commonly lands there. Mark as "Not junk" + add hello@rxshift.io to
   safe senders to train it.
3. Check M365 quarantine: security.microsoft.com → Email & collaboration →
   Review → Quarantine.
4. Root cause of junking: Cloudflare forwarding makes SPF fail at M365
   (the forwarding IP isn't the original sender's). DKIM survives
   forwarding, which mostly saves it — adding DMARC (below) and, if junking
   persists, adding Cloudflare as a trusted ARC sealer in M365 Defender
   (Email authentication settings → ARC) both help.

### DNS records (mail) — verified June 16, 2026

| Record | Value | Purpose |
|---|---|---|
| MX rxshift.io | route1/2/3.mx.cloudflare.net | Inbound → Cloudflare Email Routing (catch-all) |
| MX send.rxshift.io | feedback-smtp.us-east-1.amazonses.com | Resend bounce handling |
| TXT rxshift.io | `v=spf1 include:_spf.mx.cloudflare.net include:spf.protection.outlook.com ~all` | SPF — authorizes BOTH Cloudflare forwarding AND M365 sending as @rxshift.io |
| TXT send.rxshift.io | `v=spf1 include:amazonses.com ~all` | SPF for Resend's bounce subdomain — **leave alone** |
| CNAME selector1._domainkey.rxshift.io | `selector1-rxshift-io._domainkey.jamisonwest.p-v1.dkim.mail.microsoft` | **M365 DKIM** (selector 1) — signs human mail as rxshift.io (kills the "via onmicrosoft.com") |
| CNAME selector2._domainkey.rxshift.io | `selector2-rxshift-io._domainkey.jamisonwest.p-v1.dkim.mail.microsoft` | M365 DKIM (selector 2 — rotation standby) |
| TXT resend._domainkey.rxshift.io | (DKIM key) | **Resend DKIM** — signs app/transactional mail |
| TXT cf2024-1._domainkey.rxshift.io | (DKIM key) | Cloudflare Email Routing DKIM |
| TXT _dmarc.rxshift.io | `v=DMARC1; p=none; rua=mailto:dmarc@rxshift.io` | DMARC (monitor mode; `rua` → dmarc@rxshift.io via catch-all) |

All mail records are **DNS only** (grey cloud) in Cloudflare — proxying breaks them.
**Three legitimate senders now sign for rxshift.io:** M365 (DKIM `d=rxshift.io`, human
mail), Resend (`resend._domainkey`, app mail), Cloudflare (forwarding). DMARC stays
`p=none` while multiple senders exist; only tighten to quarantine/reject after confirming
all three align (check the DMARC `rua` reports first).

### Sending AS the brand — `hello@rxshift.io` shared mailbox (DONE — June 16, 2026)

`hello@rxshift.io` is a **Microsoft 365 shared mailbox** in the jamisonwest.com tenant.
Jamison sends *as* it from Outlook (desktop + web); recipients see `hello@rxshift.io`,
DKIM-signed as rxshift.io (no "via onmicrosoft.com"). Sent copies land in the shared
mailbox's Sent Items, so anyone with access sees the full thread history.

> We tried an **alias + `SendFromAliasEnabled`** first — it's a dead end: Outlook desktop
> never honors it, and even in OWA the recipient still sees the primary address. A shared
> mailbox is the correct, free, reliable pattern, and works in every client. The alias and
> its OWA "addresses to send from" checkbox were removed. (`SendFromAliasEnabled` is still
> `True` on the org — harmless, unrelated to shared-mailbox send-as.)

**The setup (so it can be rebuilt / extended):**
1. Domain `rxshift.io` added + verified in the M365 tenant (TXT `MS=ms52040000`). **MX
   stays on Cloudflare** — do NOT let M365 take the MX, or inbound/catch-all breaks.
2. Shared mailbox created: admin center → **Teams & groups → Shared mailboxes** →
   "RxShift" / `hello@rxshift.io`.
3. Permissions: Jamison granted **Read and manage (Full Access)** + **Send as**.
   ⚠️ Each person who OPENS the mailbox needs their **own Exchange Online license**; the
   shared mailbox itself is free (≤50 GB).
4. Shared Sent Items (no GUI for this — PowerShell):
   `Set-Mailbox -Identity hello@rxshift.io -MessageCopyForSentAsEnabled $true`
5. Authentication (kills junking + the "via"):
   - **SPF** — root TXT now includes `spf.protection.outlook.com` (see DNS table).
   - **DKIM** — published the two selector CNAMEs, then
     `Set-DkimSigningConfig -Identity rxshift.io -Enabled $true` (Status = Enabled/Valid).
6. Signature: brand HTML block (RxShift wordmark, tagline, hello@/rxshift.io) pasted in
   OWA → Settings → Mail → Compose and reply.

**Exchange Online PowerShell reminder:** install once with
`Install-Module ExchangeOnlineManagement -Scope CurrentUser -Force` (installs for
**PowerShell 7 / pwsh** — use that, not Windows PowerShell 5.1). Order matters:
**`Connect-ExchangeOnline -UserPrincipalName jamison@jamisonwest.com` FIRST → do the work
→ `Disconnect-ExchangeOnline` LAST.** Jamison admins multiple tenants — run
`Get-AcceptedDomain` and confirm `rxshift.io` is listed before changing anything.

### The complete email flow — who sends/receives what, and where it's recorded

Three systems touch email; mail lives in two of them. **This is the answer to "how do we
make sure nothing gets missed."**

```
OUTBOUND
  RxShift app ──(Resend, From: hello@rxshift.io)──▶ recipients
     types: sign-in links, request notifications (PTO/callout/swap),
            live-ratio alerts, demo-request alert, CRM mail
     recorded in: Resend dashboard + in-app `notification` rows
                  (NOT in any mailbox; no durable app-side log yet — see TODO)

  Humans ──(M365 hello@ shared mailbox, Send As, DKIM d=rxshift.io)──▶ recipients
     recorded in: shared mailbox Sent Items (team-visible)

INBOUND
  hello@rxshift.io  ──▶ Cloudflare ──(specific rule)──▶ hello@jamisonwest.onmicrosoft.com
                                                         ──▶ RxShift SHARED mailbox (team)
  any other @rxshift.io ──▶ Cloudflare MX ──▶ catch-all ──▶ jamison@jamisonwest.com (personal)
     (Verified June 16: a specific Cloudflare routing rule for hello@ overrides the
      catch-all and delivers to the shared mailbox's onmicrosoft address; everything
      else still forwards to Jamison's personal inbox.)

  The app receives NO email — it only sends.
```

**The demo-request crossover (the worry: "does a lead fall out of tracking?")**
```
Visitor submits the demo form on rxshift.io
   ├─▶ creates a CRM LEAD → /app/admin/leads   (PERMANENT — the system of record)
   └─▶ sends an alert email (Resend, from hello@) → info@rxshift.io → Jamison's inbox
```
The lead is **persisted and stays in the CRM** — the email is only a heads-up copy, not a
handoff. Nothing is lost at request time. The *one* gap: the follow-up email conversation
with a prospect isn't auto-linked back to its CRM lead. **Mitigation: work prospects FROM
the CRM, not the inbox.**

**Why we can't just "put everything in one inbox":** Microsoft **prohibits** BCC-ing or
transport-ruling app mail into a shared mailbox for archiving. So app email and human email
are two streams by design. Unifying them means either (a) report on each in its own place
(below), or (b) later, move app sending onto **M365 (Graph) as hello@** — then it's
genuinely stored in the shared mailbox. (b) is a real project, not a config toggle.

### Reporting — "what was sent/received, to whom"

| Stream | Where it lives | How to find / report |
|---|---|---|
| App / transactional (Resend) | `email_log` table + Resend dashboard + in-app `notification` rows | **`email_log` (shipped June 16)** — platform-admin view at `/app/admin/emails` with the actual rendered email + xlsx export; Resend dashboard for raw delivery detail |
| Human / brand (shared mailbox) | M365 shared mailbox (Sent + received) | Exchange **Message Trace** (recent); Purview **Content Search** (full history); everyone with access reads threads directly |

### Now vs. later (free today; what costs money only when RxShift grows)

| | Now (free) | Later (when it takes off) |
|---|---|---|
| Send as brand | ✅ `hello@` shared mailbox + Send As | More shared mailboxes (info@, support@) — still free |
| Receive into the shared mailbox | **Done (June 16)** — `hello@` lands in the shared mailbox via a Cloudflare rule | If you ever want *all* rxshift.io mail in M365, switch the MX to M365 (cleaner end-state; loses the auto-forward catch-all, so define each address) |
| Team access | Jamison + assistant (each needs an EXO license) | **RT / Susie need a licensed account in THIS tenant** (~$6–8/user/mo). Susie is in Optum's tenant, so she'd be a licensed/guest user here. |
| Mailbox size / legal hold | 50 GB, no hold | EXO **Plan 2** (~$8/mo) for 100 GB or litigation hold/retention |
| App-email record | Resend + in-app notifications | Build `email_log`; optionally move app sending to M365 Graph for a single store |
| Prospect/client folders | ✅ create freely inside the shared mailbox | — |

**Cost stays $0 today.** Money only enters with (1) *people* who must open the mailbox
(licenses) and (2) *retention / legal-hold* needs — both only when the business grows.

**Caveat to remember:** rxshift.io is an **Authoritative** accepted domain in M365, so mail
sent *from inside the tenant* to an @rxshift.io address that isn't a real mailbox/alias will
bounce instead of forwarding via Cloudflare. External senders are unaffected (MX → Cloudflare).
Non-issue today; if internal mail to an @rxshift.io address ever bounces oddly, this is why.

### App email instrumentation + env (June 16, 2026)

Every app email now flows through one `sendEmail()` core and is recorded in `email_log`
(platform-admin view at `/app/admin/emails`). Deliverability + system errors fold into the
platform **Feedback** inbox (`/app/admin/feedback`). New/changed env vars:

| Env var | Where | Purpose |
|---|---|---|
| `CONTACT_TO_EMAIL` | Vercel | Recipient of the website demo-request alert. **Set to `hello@rxshift.io` (June 16)** — verified that demo alerts now land in the shared mailbox. |
| `RESEND_WEBHOOK_SECRET` | Vercel | Signing secret for the Resend delivery webhook (`POST /api/webhooks/resend`). Until set, the webhook acknowledges but does nothing. |
| `PLATFORM_ADMIN_EMAIL` | Vercel (optional) | Where feedback + system alerts are emailed. Defaults to `jamison@jamisonwest.com`. |

**Manual steps — both DONE June 16, 2026:**
1. ✅ **Resend webhook:** endpoint `https://app.rxshift.io/api/webhooks/resend` added in
   Resend (delivered / bounced / complained); signing secret set as `RESEND_WEBHOOK_SECRET`
   in Vercel. Verified live: an unsigned POST returns 401, and a real delivery event
   updated an email_log row to `delivered`.
2. ✅ **Shared mailbox receives `hello@`:** Cloudflare Email Routing → Destination address
   `hello@jamisonwest.onmicrosoft.com` (the shared mailbox's onmicrosoft address) verified;
   custom routing rule `hello@rxshift.io → hello@jamisonwest.onmicrosoft.com` Active
   (overrides the catch-all for hello@ only). Verified: both an app demo-alert and an
   external Gmail message to hello@ landed in the RxShift shared mailbox.

---

## Services & Accounts

| Service | Account email | Status |
|---|---|---|
| Cloudflare | jamison@jamisonwest.com | Active |
| GitHub | github@rxshift.io (username: RxShift, repo: RxShift/RxShift) | Active |
| Supabase | supabase@rxshift.io (project `cnhpaxucnbgxazpbvtod`) | Active |
| Resend | resend@rxshift.io | Active, domain verified |
| Vercel | github@rxshift.io | **Pending — see below** |

---

## Vercel — Pending Action

Vercel blocks multiple accounts on the same phone number. A second account for RxShift is needed to isolate it from existing personal Vercel projects.

**Email sent June 11, 2026 to:** registration@vercel.com  
**Subject:** Second account verification — same phone number  
**Summary:** Requested manual verification for new account `github@rxshift.io`, explained single phone number limitation and legitimate business separation need. Existing personal account is `jamison.west@gmail.com`.

**When resolved:**
1. Log into new Vercel account
2. Connect GitHub repo (github@rxshift.io account)
3. Create project for RxShift
4. Add domains in Vercel: `rxshift.io` and `app.rxshift.io`
5. Configure both in Cloudflare DNS pointing to Vercel
6. Add env vars from `.env.local` in the Vercel dashboard
7. Add the Supabase keep-alive cron (`vercel.json` + `/api/cron/keep-alive`) — required because Supabase is on the free tier

---

## Architecture Decisions

### URL Structure
- `rxshift.io` — marketing/landing page (root route `/`)
- `app.rxshift.io` — the application (authenticated routes)

### Stack
- **Framework:** Next.js 16 (single repo, single Vercel deployment)
- **Database:** Supabase (Postgres)
- **Transactional email:** Resend
- **DNS/domain:** Cloudflare
- **Source control:** GitHub

### One repo, one deployment
Marketing site and application live in the same Next.js repo. No need to split unless the marketing site becomes a separate large project (unlikely for a niche SaaS). Vercel handles both domains from one deployment.

---

## Pending To-Dos

- [ ] Vercel account verification response from registration@vercel.com
- [ ] Once Vercel resolves: connect GitHub repo, create project, add domains, env vars, keep-alive cron
- [ ] Configure Cloudflare DNS A/CNAME records pointing rxshift.io and app.rxshift.io to Vercel
- [x] Add DMARC record in Cloudflare: TXT `_dmarc` = `v=DMARC1; p=none; rua=mailto:dmarc@rxshift.io` — added June 12, 2026
- [x] **M365 send-as `hello@rxshift.io` — DONE June 16, 2026** (shared mailbox, NOT the alias dead-end). Shared mailbox + Full Access/Send As + `MessageCopyForSentAsEnabled` (shared Sent Items) + SPF (`spf.protection.outlook.com`) + DKIM (`Set-DkimSigningConfig -Enabled`). Verified: Gmail shows `hello@rxshift.io`, no "via," shared Sent Items working. Full procedure + email flow in the Email section above.
- [x] **In-app `email_log`** + admin report — DONE June 16, 2026 (`/app/admin/emails`).
- [x] **Route the demo-request alert to `hello@`** — app side DONE June 16 (`CONTACT_TO_EMAIL` defaults to hello@); team-visible once the mailbox receives (below).
- [x] **Configure the Resend delivery webhook** + `RESEND_WEBHOOK_SECRET` — DONE June 16 (verified live).
- [x] **Make the shared mailbox RECEIVE `hello@`** — DONE June 16. Cloudflare rule `hello@rxshift.io → hello@jamisonwest.onmicrosoft.com` (Active); demo alerts + external mail to hello@ verified landing in the shared mailbox. `CONTACT_TO_EMAIL` set to hello@. (A full MX move to M365 remains a future option if ever wanted.)
- [ ] License a paid mailbox/seat for **Susie** (and RT if he engages) on this tenant — only when they actually need access.
- [x] Push the repo to GitHub — jamisonwest-ship-it added as collaborator on RxShift/RxShift; both remotes (`vercel` + `origin`) current as of June 12, 2026
- [x] Supabase schema — migrations 0001–0019 applied; full v1 schema live
  - Note: migrations 0001–0005 were applied via raw `execute_sql` before MCP migration tracking was configured — they do not appear in `list_migrations`. Schema is correct; 0006+ are tracked normally.
  - 0018 (June 15): ratio is per-location (dropped `ratio_zone`); departments tenant-level; `tenant.require_department`; `staff.avatar_path`.
- [x] Supabase Storage — private `avatars` bucket (created in migration 0018; tenant-scoped paths `{tenant}/{staff}-{ts}.webp`, manager-only write RLS, signed-URL reads). Free tier; tiny webp files.
- [x] Scaffold Next.js repo — done June 11, 2026
- [x] Full v1 app + marketing site built and live — June 11–12, 2026
- [x] Branded Supabase magic-link template — pasted by Jamison in dashboard, June 12, 2026

---

## Cost Summary (current)

| Item | Cost |
|---|---|
| rxshift.io domain | $50/year |
| Cloudflare | Free |
| Email Routing | Free |
| Resend | Free (under 3K/month) |
| Supabase | Free (under usage limits) |
| Vercel | Free (under usage limits) |
| **Total today** | **$50/year** |

### Crons (vercel.json)

| Path | Schedule | Notes |
|---|---|---|
| `/api/cron/keep-alive` | every 3 days | Keeps the free-tier Supabase project awake |
| `/api/cron/live-ratio-check` | `0 9 * * *` (daily) | Live out-of-ratio alerts to managers (in-app + gated email), with a 5-min grace + 60-min cooldown. **MUST be daily (or less) on Hobby** — Vercel REJECTS the whole deployment if any cron runs more than once/day (learned June 13: an every-minute schedule silently failed every deploy with a PENDING-but-no-build). Change to `* * * * *` for near-real-time alerts ONLY after upgrading to Pro. The on-screen board badge stays real-time regardless; grace/cooldown state means a slower cadence only delays alerts, never duplicates or misfires them. |

### Planned upgrade (free → paid) — at first customer / confident deep trial

Stay on free tiers through development and early trials. When there's a live customer
(or a confident deep trial — e.g. a discounted opt-in 2-location first customer), move
**both Vercel and Supabase to paid starter tiers (~$20/mo each)**. That covers:

- Supabase: automatic backups / point-in-time recovery, no auto-pause, more capacity.
- Vercel: uptime headroom **and per-minute cron cadence** (unlocks near-real-time live
  out-of-ratio email alerts), plus moving hosting off the personal account to the
  dedicated RxShift account.

Jamison may also re-evaluate the platform choice wholesale at full-live (currently
expects to stay on Vercel + Supabase). Nothing in the app assumes paid plans to ship.

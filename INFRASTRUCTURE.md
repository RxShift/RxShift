# RxShift: Infrastructure Setup
Tag: [JWC] | Last updated: June 11, 2026 | Status: Mostly complete — Vercel pending

> This file is the source of truth for RxShift accounts, DNS, and email flow.
> Jamison drops updates here from outside Claude Code; Claude Code keeps it
> current and folds anything code-relevant into CLAUDE.md.

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
| Status | Verified (DKIM, SPF verified; DMARC **not yet added** — see to-dos) |
| DNS provider | Cloudflare (auto-configured via Resend integration) |
| Region | us-east-1 (North Virginia) |
| Free tier | 3,000 emails/month, 100/day |

### Demo-request email flow (verified end-to-end June 11, 2026)

```
Visitor submits form on rxshift.io/#demo
  → POST /api/contact (Next.js route)
  → Resend API sends FROM hello@rxshift.io TO info@rxshift.io
      (replyTo = the visitor's email, so replying reaches the prospect)
  → Cloudflare MX accepts (Resend dashboard shows "delivered" here)
  → Cloudflare catch-all forwards to jamison@jamisonwest.com (M365)
  → Lands in Jamison's Outlook inbox — OR Junk, OR M365 quarantine
```

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

### DNS records verified June 11, 2026

| Record | Value | Purpose |
|---|---|---|
| MX rxshift.io | route1/2/3.mx.cloudflare.net | Inbound → Cloudflare Email Routing |
| TXT rxshift.io | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF for Cloudflare forwarding |
| TXT send.rxshift.io | `v=spf1 include:amazonses.com ~all` | SPF for Resend bounce domain |
| TXT resend._domainkey.rxshift.io | (DKIM key) | Resend DKIM — present ✓ |
| TXT _dmarc.rxshift.io | `v=DMARC1; p=none; rua=mailto:dmarc@rxshift.io` | DMARC — added by Jamison June 12, 2026 |

(The DMARC `rua` reports go to dmarc@rxshift.io, which the catch-all
forwards to Jamison — no extra setup needed.)

### Replying AS hello@rxshift.io from Outlook (planned, not yet done)

Cloudflare Email Routing is receive-only — it cannot send. Today, replying
to a demo request goes out as jamison@jamisonwest.com (the replyTo is set to
the prospect, so the reply reaches the right person, just from the wrong
domain). To reply as hello@rxshift.io, rxshift.io must be added to the
jamisonwest.com Microsoft 365 tenant:

1. **M365 admin center** (admin.microsoft.com) → Settings → Domains →
   Add domain: `rxshift.io`. Verify ownership via the TXT record Microsoft
   provides (add it in Cloudflare DNS).
2. When M365 offers to set up DNS records, **skip the MX record** — MX must
   stay pointed at Cloudflare or Email Routing breaks. (Skipping is allowed;
   M365 will nag about it. Ignore the nag.)
3. Users → Jamison's user → Manage email aliases → add `hello@rxshift.io`.
4. Enable sending from aliases (Exchange Online PowerShell):
   `Set-OrganizationConfig -SendFromAliasEnabled $true`
5. Update the SPF record in Cloudflare to authorize Outlook:
   `v=spf1 include:_spf.mx.cloudflare.net include:spf.protection.outlook.com ~all`
6. (Recommended) Enable DKIM for rxshift.io in M365: Defender portal →
   Email authentication settings → DKIM → rxshift.io (requires two CNAME
   records Microsoft provides).
7. In Outlook (web first — desktop catches up later), the From dropdown
   will offer hello@rxshift.io.

**Caveat:** once rxshift.io is an accepted domain in the tenant, mail sent
from inside the tenant to any @rxshift.io address routes internally — only
hello@ will exist as an alias, so tenant-internal mail to other @rxshift.io
addresses would bounce instead of forwarding. External senders are
unaffected (MX still points to Cloudflare). With a one-person tenant this is
a non-issue, but it's the thing to remember if it ever behaves oddly.

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
- [ ] M365 send-as-hello@rxshift.io setup (steps above) — so replies to demo requests come from the brand domain
- [ ] Push the repo to GitHub (needs a personal access token from the RxShift account)
- [ ] Supabase schema design (to be done via Claude Code)
- [x] Scaffold Next.js repo — done June 11, 2026
- [x] Marketing website built (homepage, /pricing, /features, working demo form) — done June 11, 2026

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

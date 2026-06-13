# RxShift

Compliance-ready pharmacy scheduling for retail pharmacies (1–25 locations).

RxShift embeds state ratio rules (pharmacist-to-technician requirements) into the schedule
so deficiencies surface before they become violations. Built as a multi-tenant B2B SaaS
under JWC LLC (Jamison West).

**Live:** app.rxshift.io · rxshift.io

---

## Local Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Resend + OpenAI keys
npm run dev
```

App runs at **http://localhost:3200/app/...** (port pinned in `package.json`).
Marketing pages are at http://localhost:3200/.

---

## Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| CSS | Tailwind CSS 4 |
| Database / Auth | Supabase (direct client — no Prisma) |
| Email | Resend |
| AI | OpenAI gpt-4o-mini (server-side only) |
| Hosting | Vercel |

---

## Supabase

- **Project:** `cnhpaxucnbgxazpbvtod` (supabase@rxshift.io)
- **Migrations:** `supabase/migrations/` — numbered `0001`–`0014+`
- Migrations are applied via the Supabase MCP (`mcp__supabase-rxshift__apply_migration`) or the Supabase dashboard SQL editor. The Supabase CLI is not configured.
- `list_migrations` shows history from 0006+ (0001–0005 were applied before MCP tracking began; schema is live).

---

## Key Scripts

See **[docs/SCRIPTS.md](docs/SCRIPTS.md)** for full documentation. Quick reference:

```bash
npx tsx scripts/seed-demo.ts                    # seed OptumRx demo tenant
npx tsx scripts/seed-mesa-vista.ts --reset      # reset Mesa Vista demo tenant
npx tsx scripts/provision-user.ts --help        # provision a user (see docs/SCRIPTS.md)
npx tsx scripts/seed-live-now.ts                # seed live board status for demo
```

---

## Repo & Accounts

This repo is **separate** from Jamison's personal, TimeZest, and MSP+ accounts.

| Service | Account |
|---------|---------|
| GitHub | `RxShift` (github@rxshift.io) — repo `RxShift/RxShift` |
| Supabase | supabase@rxshift.io |
| Resend | resend@rxshift.io — sends from hello@rxshift.io |
| Vercel | github@rxshift.io (personal account hosts app.rxshift.io in the interim) |

Deploy path: push to the `vercel` remote (`jamisonwest-ship-it/rx-shift`) — Vercel
auto-deploys from there. Push `origin` (`RxShift/RxShift`) to keep the canonical repo
current. Both remotes after every ship.

---

## Documentation

| File | What it covers |
|------|---------------|
| `CLAUDE.md` | Master context: architecture, accounts, phases, open TODOs |
| `CHANGELOG.md` | What shipped, schema changes, infra updates — updated after every build |
| `INFRASTRUCTURE.md` | DNS, email routing, service accounts, Vercel setup steps |
| `docs/decisions.md` | Why things were built the way they were |
| `docs/SCRIPTS.md` | How to run every operational script |
| `Brand Items/DESIGN.md` | Full design system (colors, typography, components) |


# RxShift — Feature Map (every screen, what it does, who sees it)

> Keep this current whenever a route is added/changed or a feature ships (it pairs with
> `DEMO-GUIDE.md`). Source of truth for *what exists* is the code + `CLAUDE.md`; this is the
> at-a-glance index. Last updated June 17, 2026.

**Roles:** `owner_admin`, `scheduler`, `supervisor`, `read_only`, `staff`.
- **MANAGE** = owner_admin + scheduler + supervisor + read_only (the management nav).
- **CONFIG** = owner_admin + scheduler + supervisor (settings).
- **Everyone** includes `staff`.

**Two domains:** marketing at `rxshift.io`; the app at `app.rxshift.io` (host rewrite → `/app/*`).
Local dev: `http://localhost:3200/app/...`.

---

## App — management

| Route | What it does | Who | Notes |
|-------|--------------|-----|-------|
| `/app/dashboard` | **Compliance overview + quick nav.** Stat cards (Current period, Deficient slots, Open flags, Pending requests) — all **clickable**, jumping to the offending slot/list — AI Insights (also clickable), Quick Actions, per-location cards. | MANAGE | **NOT live statuses.** This is an overview; live status lives on the Live Board / My Schedule. |
| `/app/schedule` | The one person-centric **schedule matrix** (build surface). Location pill = view filter; window selector week/2-week/month; Publish, Copy last week, Export CSV. Deficient slots show a red ⚠; constraint flags an amber ring. **Ask AI** bar on top (scoped to the working location + week). | MANAGE | Periods are invisible plumbing (auto-created). |
| `/app/board` | **Live Board** — per-location cards of who's on **right now**, grouped by role, with ratio status, a "✓ N can step away" headroom line, and manager status controls. Polls ~60s. | MANAGE (if `has_ratio`) | This is where live statuses live. Open the wall display from here. |
| `/app/display` | **Wall-display kiosk** — chrome-free, read-only board for an always-on monitor. `?location=<id>` pins one site; Fullscreen button; polls ~30s. | signed-in session | New route group `(kiosk)`. |
| `/app/me` | **My Schedule** (staff-facing, mobile-first). My Status Now (set live status when on shift), pharmacist "can I step away?" indicator, **What I'm doing now** (self-change work type), next 2 weeks, my requests, **Who's on this week** (home location). Self-refreshes. | Everyone | Live presence is schedule-derived (tenant tz). |
| `/app/requests` | **Time off / Callouts / Swaps.** Submitting/approving shows the **compliance impact first**; approving something that creates a ratio deficiency requires a logged reason. | Everyone (manage = approve) | |
| `/app/log` | **Compliance Record** — hourly per-location staffing + deficiency, week selector, **Acknowledged exceptions** (override reasons), "Save as PDF (official record)" + Export CSV (data). | MANAGE | PDF = print-to-PDF; carries override context. |
| `/app/log/overrides` | **Override Log** — every time someone proceeded past a warning (publish, or a PTO/swap approval that caused a deficiency): who, when, type, reason. Append-only. | MANAGE | |
| `/app/log/audit` | **Audit Log** — the full append-only action trail (edits, approvals, publishes, AI ops). Entries are never edited/deleted; managers can **append a note** for context. | MANAGE | The comprehensive trail (vs the Compliance Record's hourly staffing view). |
| `/app/reports` | xlsx exports: compliance log, staff roster, schedule, audit (owner-only). | MANAGE | Raw-data exports. |
| `/app/staff` | Staff directory — roles, cert tracking, avatars, offboarding. | MANAGE | |
| `/app/settings/*` | Locations & departments, ratio rules + formula, constraints, statuses, work types, branding, team, billing, import, privacy. | CONFIG | Owner-only for danger-zone/go-live/roles. |
| `/app/security-posture` | The app's SOC-2-style security stance (data, access, encryption, AI, audit, limits). | owner_admin | `LAST_REVIEWED` constant. |
| `/app/help` | Help articles (tenant-visible); platform-admin docs gated by RLS. | Everyone | |

## App — platform admin (RxShift operators)

| Route | What it does |
|-------|--------------|
| `/app/admin` | Admin Console — tenants list, email mode, billing, **Restore demo data**, **Demo clock** toggle, emulate-as-user, switch tenant. |
| `/app/admin/leads` | Internal CRM (website demo requests → leads + notes). |
| `/app/admin/emails` | Email log (every send + delivery status + rendered body). |
| `/app/admin/feedback` | In-app feedback / system-issue tracker. |

---

## The compliance engine (the differentiator)

- **Ratio is per location.** All counting staff at a location count together against the state rule
  (flat `P × n`, or California's additive `1 + 2(P−1)`).
- **Counting precedence:** non_counting staff → segment override → work-type default → role default. A
  **non-counting work type wins** over a counting status. Live presence + status adjust counting in real time.
- **Flags** are either **ratio** (a slot non-compliant / at the limit) or **constraint** (hours,
  availability, double-booking). Surfaced the same way on the schedule, dashboard, board, and compliance record.
- **Warn, never block; never contact a board.** RxShift surfaces risk and (for ratio deficiencies) requires
  a logged reason, but the human always decides.

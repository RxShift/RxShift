# RxShift — Feature Map (every screen, what it does, who sees it)

> Keep this current whenever a route is added/changed or a feature ships (it pairs with
> `DEMO-GUIDE.md`). Source of truth for *what exists* is the code + `CLAUDE.md`; this is the
> at-a-glance index. Last updated July 1, 2026.

**Roles:** `owner_admin`, `scheduler`, `supervisor`, `read_only`, `staff`.
- **MANAGE** = owner_admin + scheduler + supervisor + read_only (the management nav).
- **CONFIG** = owner_admin + scheduler + supervisor (settings).
- **Everyone** includes `staff`.

**Two domains:** marketing at `rxshift.io`; the app at `app.rxshift.io` (host rewrite → `/app/*`).
Local dev: `http://localhost:3200/app/...`.

**New July 1, 2026 — Susie's pass:**
- **Settings → Organization → Time format** (CONFIG): 12-hour AM/PM (default) or 24-hour military, applied
  app-wide (schedule, My Schedule, reports, wall board, audit timestamps).
- **Build Schedule → Unpublish** (CONFIG): a button + confirm that returns a published window to draft so staff
  stop seeing it — the reverse of Publish. Shown when the window has a published period.
- **Live Board → Status board** (MANAGE): managers change any on-shift person's status (already existed — now in
  the demo/docs).
- **Requests → Callouts** (Everyone/MANAGE): a logged call-out now drops the person from the live ratio board +
  Compliance Record for that day and flags their shift "Called out" on Build Schedule; a manager **or the person**
  can **Reverse** it.

**New June 23, 2026 — staff scheduling logic (CONFIG/MANAGE):**
- **Staff record slide-over** (`/app/staff` Edit, and clicking a name on **Build Schedule**) — notes,
  exclude-from-ratio flag, per-person constraints, **scheduling rules** CRUD, availability, and (from the
  builder) "rules for this week → Accept" proposals.
- **Build Schedule** — staff names now hover (notes/rules/limits) + click through; an **"Apply rules"**
  action proposes everyone's rule-driven week (Accept all / per person; unmet rules dismissible).
- **Reports** — **Schedule export** is now any date range × one/many/all locations (.xlsx with summary tabs)
  + a **Print view** (`/app/reports/print`, one location per page).
- **Settings → Organization** — **First day of the week** selector (`tenant.week_start_day`).

---

## App — management

| Route | What it does | Who | Notes |
|-------|--------------|-----|-------|
| `/app/dashboard` | **Compliance overview + quick nav.** Stat cards (Current period, Deficient slots, Open flags, Pending requests) — all **clickable**, jumping to the offending slot/list — AI Insights (also clickable), Quick Actions, per-location cards. | MANAGE | **NOT live statuses.** This is an overview; live status lives on the Live Board / My Schedule. |
| `/app/schedule` | **Build Schedule** — the person-centric **schedule matrix**, the build/edit surface. **Cadence-locked**: the window IS one build-cadence period (`tenant.schedule_cycle`); header reads "Building: <period>" with prev/today/next stepping by **period** — no span picker. Location pill filters; **Copy last <period>'s pattern**, Export CSV, Publish. Red ⚠ ring = hard conflict (ratio deficiency OR a shift on a PTO day); amber ring = constraint; **PTO blacked out**; **holiday columns tinted**. **Build mode** toggle collapses chrome into one command strip (date nav · period · location · status · Ask AI · publish · ⤢ Exit) for max rows. **Ask AI** (small button), **carry-forward** (one shift across following days). | CONFIG (owner_admin / scheduler / supervisor); others redirect to View | Periods are invisible plumbing (auto-created on save). A shift inherits its period's status on save — edit a published period → live immediately; build a draft → hidden until publish. Build cadence locked per tenant (Model B). |
| `/app/view-schedule` | **View Schedule** — read-only, **published-only** schedule for **everyone**. Week / 2-week / month **zoom** for looking; location pill + dept/work-type chip filters. PTO blacked out, holidays tinted. No editing, no build toolbar, no compliance rings (those are a Build concern). Shares `schedule-grid` with Build (no drift). | ALL roles | Shows only published shifts — drafts never leak here. The place staff/anyone see the whole pharmacy schedule. |
| `/app/board` | **Live Board** — per-location cards of who's on **right now**, grouped by role, with ratio status, a "✓ N can step away" headroom line, and manager status controls. Polls ~60s. | MANAGE (if `has_ratio`) | This is where live statuses live. Open the wall display from here. |
| `/app/display` | **Wall-display kiosk** — chrome-free, read-only board for an always-on monitor. `?location=<id>` pins one site; Fullscreen button; polls ~30s. | signed-in session | New route group `(kiosk)`. |
| `/app/me` | **My Schedule** (staff-facing, mobile-first). My Status Now (set live status when on shift), pharmacist "can I step away?" indicator — **shown only while the pharmacist's current status counts** (it disappears once they go non-counting), **What I'm doing now** (self-change work type), next 2 weeks, my requests, **Who's on this week** (home location). Self-refreshes. | Everyone | Live presence is schedule-derived (tenant tz). |
| `/app/requests` | **Time off / Callouts / Swaps.** Submitting/approving shows the **compliance impact first**; approving something that creates a ratio deficiency requires a logged reason. Approved time off writes durable `pto_day` records (blacked out on the grid). | Everyone (manage = approve) | A scheduler can also enter PTO directly from the schedule grid (PTO checkbox on the shift editor). |
| `/app/log` | **Compliance Record (as-worked)** — the immutable, hour-by-hour record of what *actually happened* per location (who was on + counting, ratio met/not), day selector, deficient hours highlighted, **append-only annotations** (+ Note) on any hour, "Save as PDF (official record)" + Export CSV. | MANAGE | Written by the finalize-compliance cron (`lib/compliance-record.ts`, migration 0029): reconstructs actual presence = published shift split by `live_status` history → `evaluateZone`. Frozen per hour, never edited, 2-year. |
| `/app/coverage-forecast` | **Coverage Forecast** — the schedule-derived *projection* ("are we **scheduled** to be in ratio?"), period selector, **Acknowledged exceptions** (override reasons). A planning aid. | MANAGE | The old `/app/log` view, relocated; regenerated-on-read via `buildComplianceRecords` (+ publish-time `compliance_snapshot`). NOT the audit. |
| `/app/log/overrides` | **Override Log** — every time someone proceeded past a warning (publish, or a PTO/swap approval that caused a deficiency): who, when, type, reason. Append-only. | MANAGE | |
| `/app/log/audit` | **Audit Log** — the full append-only action trail (edits, approvals, publishes, AI ops). Entries are never edited/deleted; managers can **append a note** for context. | MANAGE | The comprehensive trail (vs the Compliance Record's hourly staffing view). |
| `/app/reports` | xlsx exports: compliance log, staff roster, schedule, audit (owner-only). | MANAGE | Raw-data exports. |
| `/app/staff` | Staff directory — roles, **role type (pharmacist / tech / tech-in-training)**, CPhT cert tracking, avatars, offboarding. | MANAGE | `staff_type` drives the R072-25 trainee sublimit; `certified` drives Tennessee. |
| `/app/settings/*` | Locations & departments (**+ location type, drive-through, expected Rx**), ratio rules + formula (**+ state, incl. TN**), the **Nevada R072-25 toggle** + **Build cadence** + **Require-a-reason-on-PTO** (Organization), constraints, statuses, work types, **Holidays** (generate US federal + add/edit/remove), branding, team, billing, import, privacy. | CONFIG | Owner-only for danger-zone/go-live/roles. |
| `/app/security-posture` | The app's SOC-2-style security stance (data, access, encryption, AI, audit, limits). | owner_admin | `LAST_REVIEWED` constant. |
| `/app/help` | Help articles (tenant-visible); platform-admin docs gated by RLS. | Everyone | |

## App — platform admin (RxShift operators)

| Route | What it does |
|-------|--------------|
| `/app/admin` | Admin Console — tenants list, email mode, billing, **Restore demo data**, **Demo clock** toggle, emulate-as-user, switch tenant. |
| `/app/admin/leads` | Internal CRM (website demo requests → leads + notes). |
| `/app/admin/emails` | Email log (every send + delivery status + rendered body). |
| `/app/admin/feedback` | In-app feedback / system-issue tracker. |
| `/app/demo-prompter` | **Living demo prompter** (route group `(prompter)`, platform-admin only). The presenter script (v4.0, from `lib/demo/prompter-steps.ts`) — single/multi-location toggle, timer, keyboard nav. Popped out from the Admin Console ("Open demo prompter"). |

---

## The compliance engine (the differentiator)

- **Ratio is per location.** All counting staff at a location count together against the state rule
  (flat `P × n`, or California's additive `1 + 2(P−1)`).
- **Counting precedence:** non_counting staff → segment override → work-type default → role default. A
  **non-counting work type wins** over a counting status. Live presence + status adjust counting in real time.
- **Two deficiency kinds** (`compliance_record.flag_type`): **ceiling** (too many techs for the pharmacists on
  duty) and **floor** (a solo pharmacist without enough support — Nevada R072-25). Shown distinctly as "Over
  ceiling" vs "Under floor (understaffed)" on the Compliance Record + Coverage Forecast.
- **State overlays** (`lib/engine/rule.ts` `buildEngineRule`): current Nevada law (NAC 639.250, 1:3) always;
  **Nevada R072-25** behind `tenant.nevada_r072_25` (retail 4-tech ceiling, 2-trainee sublimit, solo-pharmacist
  floor ±drive-through); **California** additive (BPC 4115); **Tennessee** (6 non-certified per pharmacist,
  CPhT uncapped). Volume thresholds are **collect-only** — `location.expected_rx_*` is shown, never enforced.
- **Flags** are either **ratio** (a slot non-compliant / at the limit) or **constraint** (hours,
  availability, double-booking). Surfaced the same way on the schedule, dashboard, board, and compliance record.
- **Warn, never block; never contact a board.** RxShift surfaces risk and (for ratio deficiencies) requires
  a logged reason. A sustained run of deficient days alerts the pharmacy's own managers; the human always decides.

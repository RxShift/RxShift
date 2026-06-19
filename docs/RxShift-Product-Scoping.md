# RxShift Product Scoping Document
**Tag:** [JWC] | **Status:** Final, build-ready, v4 | **Date:** June 11, 2026

> **⚠️ Regulatory update (June 19, 2026):** every mention of **R113-24** below is superseded by **R072-25**
> (LCB File No. R072-25; public hearing June 4, 2026; not adopted). R072-25 raised the retail ceiling to 4
> technicians, added a solo-pharmacist *staffing floor*, and has **no** hourly-documentation mandate or
> 3-day board-notification trigger. RxShift implements it behind the `nevada_r072_25` toggle; volume
> thresholds are collect-only (never enforced). The build is documented in `docs/rxshift-r072-25-build.md` —
> read that for the current engine behavior. This scoping doc is retained as original-intent history.
**Purpose:** the single source of truth for the v1 build. Hand this to Claude Code as the build brief. It states what to build, why, the boundaries, the data model, and the build sequence. It does not contain code.
**Source inputs:** Optum prototype architecture, Southwest Medical Business Brief, Susie's requirements transcription and 11-point operational validation, pharmacy-scheduling research summary, and the working-session decisions through June 11.

---

## 1. Product thesis

RxShift is compliance-grade workforce scheduling for pharmacies. The wedge is not "scheduling." It is meeting the regulatory requirements around pharmacist-to-technician ratios and staffing hours, and generating the documentation a board of pharmacy expects, automatically, from the published schedule.

Two compliance dimensions, equal billing:
1. Ratio. Who counts on the floor, in which zone, at any moment, against the state limit.
2. Hours and labor rules. Per-diem caps, overtime thresholds, individual availability limits, and any per-person rule the pharmacy sets.

The product manages by exception: build a normal schedule, and RxShift flags anything that breaks a rule before publish, and keeps flagging it if a rule changes afterward. The headline artifact is an auto-generated hourly staffing compliance record with documented exceptions, designed to satisfy Nevada's proposed R113-24 if adopted and to provide staffing defensibility everywhere else. A simple pharmacy with no ratio still gets clean, cheap, pharmacy-aware scheduling. Ratio and the compliance record are the upsell and the moat.

## 2. The scoping principles

1. Build the mechanism, not the instance. Configurable primitives with defaults that collapse to the simplest case.
2. Separate always-on compliance from power-user compliance. Schedule-time validation is universal and frictionless. The live real-time ratio board is gated and off for pharmacies that do not need it.
3. Normalize, do not replicate. Capture the underlying need in a consistent structured way; one power user's spreadsheet habits do not become everyone's UI.
4. Trust is the product. Ratio math, hours, and PTO must be accurate and reliable, and the tool must stay faster than the spreadsheet it replaces. Friction or any discrepancy in hours or time off loses the pharmacy.
5. Deterministic logic owns compliance truth. AI drafts, explains, suggests, and surfaces patterns. Every compliance-affecting result is validated by the deterministic engine and confirmed by a human. AI never silently decides a ratio.

## 3. The two ends of the spectrum

| | Simple case (the market) | Complex case (Optum) |
|---|---|---|
| Locations | 1 to 3 | 2 (SMRX, SMMS) |
| Ratio zones | 1, or none | 3 (SMRX-Main, SMRX-SPC, SMMS) |
| Schedulers | 1 person, schedules everyone | 4, scoped by department |
| Schedule cycle | Weekly or biweekly | Monthly |
| Live ratio board | Not needed | Daily operational tool |
| Constraints | Few, simple | Rich, per-pharmacist, frequently changing |

The simple case is the default experience. The complex case is reachable by configuration, never imposed.

---

## 4. Core domain model (concepts)

- Tenant (Organization): the customer.
- Location: a physical site with operating hours. Most ratio rules key off physical location. Two ratio zones can be split by a wall in one building, or be geographically separate sites. Help docs must make this explicit.
- Ratio Zone: an independent compliance boundary. Usually equals a location; a location can hold more than one (an isolated sterile or compounding room).
- Department: an organizational grouping inside a location. "Pharmacy type" is a department label, cosmetic, no behavior keyed off it.
- Staff: a person with one primary type the system reasons about: counts as pharmacist, counts as technician, or never counts (cashier, driver, clerk, inventory-only, billing). Job titles are free-text labels on top.
- Work Type: the activity a person is in during a block. This, not the title, determines whether they count in that block. All ratio counting derives from here, never from code.
- Shift: one assignment, splittable into segments with different work types so part counts and part does not.
- Schedule period: the publishable unit. Weekly, biweekly, or monthly.
- Identity vs contact email: login email and work email are separate fields.

Hierarchy: Org > Location > Department for v1, with schema room to insert a location-group tier later without a painful migration.

---

## 5. In v1 (the one clean build)

"(config)" means a configurable mechanism with a sensible default.

**Organization and locations**
- Multi-tenant isolation (`tenant_id` on every table, all access scoped via row-level security).
- Multiple locations per tenant; ratio zones with isolation flag (config); departments (config); per-location operating hours (config).

**Roles and permissions**
- Owner/Admin, Manager/Scheduler (department-scopable), Approver/Supervisor, Read-only, Staff. Default for a small pharmacy is one Owner/Admin who does everything.
- PTO approver pool: a designated primary approver plus backups, so requests clear when the primary is out. Any designated approver can act.

**The ratio counting rule (heart of compliance)**
- A person counts only when physically present inside the pharmacy's badged walls and in a counting activity. Off the floor (huddle room, off-site) does not count, even on the clock.
- Pharmacists: a present pharmacist counts by default. Pharmacies utilize the license to cover techs whenever the pharmacist is in the building. Whether a given block counts is the pharmacy's configurable policy. The app provides configurable defaults and does not police the policy.
- Technicians: counting depends on the assigned work type for that block. Production and dispensing count; inventory, procurement, cleaning, and clerical do not. A technician can split a shift between counting and non-counting functions; the scheduler designates which.
- Non-counting staff never count regardless of presence.
- Any person can have a block marked non-counting. Default for a present pharmacist is counting; default for a technician follows the assigned work type.
- Context, not a hard rule: pharmacies tend to keep pharmacists counting when present and techs non-counting when on non-tech work, to maximize ratio headroom. Configurable per pharmacy, never baked in.

**Constraints and exception engine**
- Per-person and per-role rules that flag at scheduling time when violated (config). See Appendix C for the rule types.
- Each rule carries an effective date range: a start date and an optional end date that may be open or to-be-determined.
- Advisory and flagged, never auto-resolved, never hard-blocked.

**Continuous compliance monitoring**
- Validation is not only at build time. Adding or changing any rule, ratio, or cap re-checks already-published schedules and flags new conflicts.

**Work types and ratio configuration**
- Configurable work-type table driving all ratio counting. Per type: counts as pharmacist, technician, or none; counting default; time-window or blanket exclusions.
- Per-zone or per-tenant max ratio (config).
- Configurable ratio slot length chosen at onboarding (config): 15, 30, or 60 minutes; 30 default. The compliance record rolls up to hourly regardless.
- Seed library of common work types plus AI-suggested state ratio defaults.
- Scripts-per-hour volume captured as a data field. Nothing acts on it in v1; it keeps us forward-compatible with R113-24 and Tier C AI.

**Schedule building**
- Grid builder, create/edit/delete shifts, draft then publish.
- Configurable schedule cycle: weekly, biweekly, monthly (config). Biweekly tends to reduce unplanned callouts.
- Shift-level work-type assignment, including splitting a shift into counting and non-counting segments.
- Approved time-off overlay on the grid.
- Shift templates and copy-forward a prior period.
- Minimum-coverage flags (config), advisory.
- Export the schedule and any view to spreadsheet.

**Ratio compliance**
- Schedule-time validation: flag any non-compliant slot before publish. Always on for ratio pharmacies.
- Multiple independent zones evaluated at once; overnight spillover handled.
- Manager override of a warning, with required reason, logged. Never silent, never hard-blocked.
- Live real-time ratio board (config, gated). On only when onboarding answers "yes, we have a ratio."

**Staff self-service (mobile web)**
- "My schedule" view, responsive web. No native app in v1.
- View the team schedule for their location and department; submit time-off; log a callout; live status picker when the board is on.

**Requests and absences**
- Time-off request queue, approve/deny with notification. Free-text staff message preserved; manager handles any make-up shift manually.
- Callout logging with manager notification; callout surfaces the resulting ratio gap.
- Manager-mediated shift swap: two staff agree, a manager approves after seeing the effect on ratio, hour caps, and specialized coverage (IV room, hospice, home infusion). v1 leaves qualification matching to manager judgment.

**AI layer (Tier A and B, OpenAI, server-side)**
- Assistive (Tier A): AI-assisted onboarding that turns plain-English answers into configuration and proposes state ratio rules; a help assistant that answers from the in-app help articles; plain-language explanations of compliance flags with the exact fix named.
- Natural-language and proactive (Tier B): natural-language queries and edits ("who is short Thursday," "give Maria Fridays off for a month," "swap Tom and Lisa"), where AI proposes, the deterministic engine validates against ratio and caps, and the user confirms before anything commits; proactive insights that surface patterns and risks ("short on Tuesday mornings three of the last four weeks," "Maria is trending toward her cap," "six deficient hours this month").
- Provider: OpenAI, called server-side only, key held as a server env var (`OPENAI_API_KEY`), isolated to this project.
- Principle (Section 2.5) governs all of it: AI assists and proposes; deterministic logic decides compliance; humans confirm compliance-affecting changes.

**Security (Section 9 details the page)**
- Tenant isolation via Postgres row-level security; TLS in transit; encryption at rest; magic-link auth; least-privilege; full audit logging; secrets server-side only; rate limiting on auth. No PHI, no compensation, no credential data by design.

**Help center (Section 10 details)**
- In-app authenticated help index plus individual articles. Doubles as the knowledge base for the AI help assistant.

**Onboarding and multi-tenancy**
- AI-assisted self-serve onboarding wizard (Appendix B). People import with field mapping. Per-tenant timezone and branding (config). No pre-launch email allowlist.

---

## 6. The compliance engine (the marketing wedge)

- Hourly staffing compliance record, generated from the published schedule. Per hour and zone: the pharmacist on duty and each technician staffed, with deficient hours flagged. See Appendix D for the field spec.
- Documented exceptions, required not optional: a technician present but assigned a non-technician function (cleaning, procurement, clerical) still appears on the record, annotated as not performing technician functions and therefore not counted. This is the audit defense.
- Ratio compliance audit view and export; hours and caps exception report; override log.
- R113-24 is proposed, not adopted, as of June 2026. Build the record regardless; it sells on defensibility everywhere.

---

## 7. Normalize, do not replicate (confirmed)

Freeform spreadsheet color-coding; the four-level org hierarchy; the full job-title taxonomy as behavior; per-role multi-hop approval chains; pay and cost math; auto-coverage-finding on callouts; credential tracking and gating. All out or simplified.

---

## 8. Onboarding (a core product pillar, not a service)

The founder is never in the loop. A customer buys, clicks, and onboards through the AI-assisted wizard (Appendix B). People import via field mapping. No bulk historical-schedule seeding as a product feature. First customers, including Southwest Medical, onboard through this wizard, which is its first real test.

## 9. Security stance and page

- The build requirements in Section 5 are the posture.
- A short, high-level Security page on the public marketing site (a sales asset, because pharmacies and Optum-adjacent buyers run vendor security reviews), plus fuller detail available in-app once logged in. The public page states the posture in plain terms: data minimization (no PHI, no pay, no credentials), tenant isolation, encryption in transit and at rest, audit logging, reputable hosting. The in-app page adds specifics for customers.

## 10. Help center

In-app, authenticated, built in the product, no third-party tool. An index page links to individual articles: getting started, building a schedule, ratio setup, PTO requests, callouts, shift swaps, managing staff, the compliance record, settings. Content stored as help articles (Appendix A). It is the corpus the AI help assistant answers from.

## 11. Later (roadmap, with reasons)

- Tier C AI: full schedule generation and demand forecasting from script volume. Needs history and is an optimization problem with a high trust bar. Volume capture is in v1 so we are ready.
- SMS and push notifications (push needs a native app; SMS carries carrier overhead).
- PTO balance and accrual tracking (drags toward payroll).
- Per-staff work-type eligibility tags (IV room, hospice, home infusion) to warn on mismatches; v1 uses manager judgment.
- Native mobile app.
- Billing and plan tiers (bill first customers by hand; add Stripe or Chargebee later).
- Feature-request and upvote tool.

## 12. Out (not building)

Compensation and payroll logic. Credential storage, tracking, expiration warnings, and gating. Auto-coverage-finding and escalation. Per-role multi-hop approval chains. The four-level org hierarchy. Pharmacy-type-driven behavior. No personal or sensitive data beyond what scheduling requires.

---

# Appendix A. Core entities and key fields

Notation is conceptual, not final SQL. Every table carries `tenant_id` and is protected by row-level security, except global content noted as such.

- tenant: name, timezone, schedule_cycle, ratio_slot_minutes, has_ratio, branding (logo_url, primary_color), created_at.
- location: tenant_id, name, address, operating_hours (per-day open/close), timezone_override, created_at.
- ratio_zone: tenant_id, location_id, name, ratio_isolated, ratio_rule_id, created_at.
- department: tenant_id, location_id, name, created_at.
- staff: tenant_id, home_location_id, full_name, login_email, work_email, job_title, ratio_type (pharmacist | technician | non_counting), employment_type (full_time | part_time | per_diem | contractor_1099), active, created_at.
- staff_location: staff_id, location_id, is_home (floating support).
- app_user: supabase_user_id, staff_id, tenant_id, role (owner_admin | scheduler | supervisor | read_only | staff), scheduler_scope (department_ids), is_pto_approver, pto_approver_rank (primary | backup).
- work_type: tenant_id, name, counts_as (pharmacist | technician | none), counting_default, exclusion_rules (jsonb), is_specialized, created_at.
- shift: tenant_id, location_id, department_id, ratio_zone_id, staff_id, date, schedule_period_id, status (draft | published), notes, created_by, created_at.
- shift_segment: shift_id, start_time, end_time, work_type_id, counts_toward_ratio (override allowed). Handles within-shift splits and overnight spillover.
- schedule_period: tenant_id, location_id, cycle, start_date, end_date, status, published_at, published_by.
- time_off_request: tenant_id, staff_id, start_date, end_date, type, staff_message, status, approver_id, decided_at, created_at.
- callout: tenant_id, staff_id, shift_id, reason, logged_at, resulting_gap (computed).
- swap_request: tenant_id, requesting_staff_id, counter_staff_id, shift_a_id, shift_b_id, status (pending_peer | pending_manager | approved | denied), peer_accepted_at, manager_id, ratio_effect (computed at review), created_at.
- constraint_rule: tenant_id, scope_type (staff | role), scope_id, rule_type, params (jsonb), effective_start, effective_end (nullable), active, created_at. See Appendix C.
- ratio_rule: tenant_id (null for global seed), state, max_techs_per_pharmacist, trainee_sublimits (jsonb), composition_rules (jsonb), source_citation, notes. See Appendix E.
- live_status: tenant_id, staff_id, status (present_counting | on_lunch | off_floor | in_meeting | non_tech_function), work_type_id, effective_from, effective_to. Used only when the live board is on.
- volume_data: tenant_id, location_id, date, hour, script_count. Captured, not acted on in v1.
- notification: tenant_id, user_id, type, payload (jsonb), channel (email | in_app), read, created_at.
- activity_log: tenant_id, actor_user_id, action, entity_type, entity_id, detail (jsonb), created_at.
- override_log: tenant_id, actor_user_id, target (shift or slot), warning_type (ratio | cap | constraint), reason (required), created_at.
- help_article (global, not tenant-scoped): slug, title, body_markdown, category, sort_order, published, updated_at.

# Appendix B. Onboarding wizard flow

Each step writes the entity in parentheses. AI assists by interpreting plain-English answers and proposing configuration; the user confirms or edits everything.

1. Business name and timezone (tenant).
2. Locations: count, names, addresses, operating hours (location).
3. Ratio question: "Do you have a pharmacist-to-technician ratio requirement?" (has_ratio). If no, skip ratio steps and the live board. If yes, ask the state; AI proposes the ratio rule from the state seed; user confirms or overrides (ratio_rule). Ask whether any isolated rooms exist, for example a sterile or IV room (ratio_zone with ratio_isolated).
4. Ratio slot length: 15, 30, or 60, default 30 (ratio_slot_minutes). Only if has_ratio.
5. Schedule cycle: weekly, biweekly, monthly (schedule_cycle).
6. Departments, optional grouping (department).
7. Work types: seed common ones; user adjusts which count (work_type).
8. Staff import: upload a spreadsheet; map name, login email, work email, title, ratio type, employment type, home location; or add manually (staff).
9. Roles and approvers: designate admins, schedulers and scope, PTO approver primary and backups (app_user).
10. Branding: upload a logo and colors, or point at a website to pull them (tenant.branding).
11. Finish to the dashboard.

# Appendix C. Constraint rule types

All advisory and flagged, never blocking. Each rule has scope, params, effective_start, optional effective_end, active. Continuous re-validation: on rule create, update, or schedule change, re-evaluate affected published shifts and raise or clear flags; a flagged cell turns red with a plain-language explanation.

- hour_cap: maximum hours per period. params: hours, period (week | pay_period | year). Example: per diem 960 per year.
- overtime: flag hours over a threshold. params: threshold_hours, period (default week, 40).
- unavailable_window: cannot work given days and times. params: days, time_range.
- hard_stop: cannot work past a time on given days. params: time, days.
- recurring_unavailable: recurring pattern, for example every other Monday. params: recurrence.
- always_off: specific days always off, for example weekends. params: days.
- max_consecutive_days (optional): flag too many consecutive workdays. params: max_days.

# Appendix D. Compliance record output spec

Generated from the published schedule, retained as a snapshot at publish and re-generated on schedule change. Rolls up to hourly even when slots are finer.

Per row (date, hour, zone):
- pharmacists_on_duty: names.
- technicians_counting: names and count.
- technicians_present_non_counting: names, each annotated with the assigned non-technician function (cleaning, procurement, clerical). Required.
- ratio_status: compliant or deficient.
- deficiency_reason: when deficient.

Plus: consecutive-deficient-day counter and a board-report trigger surfaced after three consecutive deficient days (per R113-24 structure); two-year retention; export to PDF and spreadsheet; an override log cross-reference for any acknowledged warning.

# Appendix E. Nevada ratio seed (v1)

Encode current Nevada law as the editable default for state = NV; pharmacies can override.
- Default non-institutional retail: one pharmacist may supervise up to three technicians, or one technician plus two trainees (NAC 639.250). Base statutory default is 1:1 unless expanded by regulation (NRS 639.1371).
- Trainee sublimits modeled in trainee_sublimits.
- R113-24 (proposed, not adopted as of June 2026): volume-based pharmacist and technician minimums and an hourly documentation requirement. Do not enforce the volume minimums in v1; do build the hourly documentation record (Appendix D), which satisfies the documentation requirement if adopted and provides defensibility now.
- Confidence: current ratio (NAC 639.250, NRS 639.1371) is from verified primary sources. R113-24 status is medium confidence and should be reconfirmed before a customer relies on it. Verify any state's exact language before seeding it for a new tenant.

---

# Build approach (for Claude Code)

Stack: Next.js App Router, Supabase (Postgres, Auth, row-level security), Resend (email), OpenAI API (in-product AI, server-side only), Vercel hosting, Cloudflare DNS. One repo, two route groups, `(marketing)` for `rxshift.io` and `(app)` for `app.rxshift.io`, with host-based middleware. Auth and redirects on `app.rxshift.io`. Tooling note: Claude Code writes the code; the running app calls OpenAI for its AI features. They are unrelated.

Suggested build sequence:
1. Scaffold, auth (magic link), tenant model, row-level security.
2. Core scheduling: locations, zones, departments, staff, work types, shifts and segments, schedule periods, the grid builder, draft and publish.
3. Ratio engine: slot config, multi-zone evaluation, schedule-time validation, overnight handling.
4. Requests: time off, callouts, swaps; approver pool; notifications (email and in-app).
5. Constraints engine and continuous re-validation.
6. Compliance record, exports, override log.
7. Onboarding wizard, people import, branding.
8. AI layer (OpenAI, server-side): onboarding assist, help assistant, flag explanations, natural-language queries and edits with confirm, proactive insights.
9. Security page and help center.
10. Live ratio board (gated by has_ratio).

Guardrails: deterministic engine owns compliance truth; AI proposes and explains, never silently commits compliance-affecting changes; everything tenant-isolated via row-level security; no PHI, compensation, or credential data; secrets server-side.

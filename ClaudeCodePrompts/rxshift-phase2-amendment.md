# RxShift — Phase 2 Amendment & Marketing Alignment
**For Claude Code** | June 2026
**Supersedes:** Specific sections of `rxshift-phase2-build.md` as noted below.
**Read alongside:** `CLAUDE.md`, `Brand Items/DESIGN.md`, `rxshift-phase2-build.md`

---

## Why This Amendment Exists

A regulatory research review identified that `rxshift-phase2-build.md` included
marketing claims for features that are either (a) not yet built or (b) tied to a
proposed Nevada rule (R113-24) that has not been adopted. For a compliance-adjacent
product, marketing features that don't exist is a liability problem.

This file corrects those claims, provides updated copy for all affected pages, and
adds four code tasks that close the gap between marketing and reality.

**The position is not weakened by this.** RxShift still wins every comparison on
what's actually built. The copy changes make the claims provable.

---

## The Scope Call (log this in decisions.md)

> RxShift is a scheduling and ratio cap enforcement tool with compliance logging.
> It is not a full R113-24 compliance engine. Volume minimums and board-report
> triggers are deferred. The hourly log is the core documentation feature.
> R113-24 is urgency context, not a feature checklist.

---

## Summary of Changes

| Area | What changes |
|------|-------------|
| Nevada page copy | Remove R113-24 feature claims; reframe as urgency context |
| Battle card table | Remove 3 rows for unbuilt proposed-rule features |
| Pricing features list | Remove unbuilt items; add compliance export (new build) |
| Nevada comparison table | Remove proposed-rule feature claims |
| Code: deficiency flagging | Verify it exists; build it if not |
| Code: Tennessee cert flag | Add `certified` boolean to tech/staff schema |
| Code: California formula | Verify additive formula support in ratio engine |
| Code: Compliance export | New build — .xlsx export from compliance log |

---

## Part 1: Code Tasks

### Task 1A — Verify and fix deficiency flagging

**Check:** In the hourly compliance log, does each log entry compare actual staffing
to the required ratio for that hour and record whether the hour was compliant or
deficient? Or does it only record who was present?

**If deficiency comparison exists:** No code change needed. Confirm the field name
and use it in the export (Task 1D).

**If it does not exist:** Add it. Each compliance log entry needs:
- The required staffing level for that hour (based on state ratio config)
- The actual staffing for that hour
- A `status` field: `compliant | deficient | unconfigured`
- The delta (how many pharmacists or techs short, if deficient)

This is the feature that makes the log useful beyond just a staffing record.
It also enables the deficiency flagging claim in the battle card.

---

### Task 1B — Tennessee certification flag

**Check:** Does the staff/technician schema have a `certified` boolean (or equivalent)
field indicating whether a tech holds national certification (CPhT)?

**If not, add it:**

```sql
-- Migration: add certification flag to staff/tech table
ALTER TABLE staff ADD COLUMN certified boolean NOT NULL DEFAULT false;
-- or equivalent depending on actual table name
```

**Why this matters:** Tennessee's ratio rules are cert-dependent:
- Non-certified registered pharmacy technicians: 6:1 ratio cap (1 pharmacist per 6 techs)
- Certified pharmacy technicians (CPhT): no ratio ceiling applied

Without this flag, the ratio engine cannot calculate the correct Tennessee ceiling.
With this flag, Tennessee is a config change — no new features required.

**UI change:** Add a "Certified (CPhT)" toggle or checkbox to the staff member
edit/create form. Off by default. Visible for technician roles only.

---

### Task 1C — California formula verification

**Check:** Does the ratio engine support an additive formula, or only flat ratios?

California's formula (BPC 4115): `max techs = (2 × pharmacists_on_duty) − 1`
- 1 pharmacist → 1 tech maximum
- 2 pharmacists → 3 techs maximum
- 3 pharmacists → 5 techs maximum

This is different from a flat per-pharmacist cap. A flat "1 RPh : 3 techs" rule
means each pharmacist adds 3 to the pool. California's formula means the first
pharmacist adds 1 and each subsequent one adds 2.

**If the ratio config already supports formula-based rules:** Verify California's
formula is configured correctly. No schema change needed.

**If the config only supports flat ratios:** Extend the ratio config schema to support
an `additive_formula` type, then add California's formula as a state config entry.
This is a config extension, not a core engine rewrite.

**Target state of the config (pseudocode for clarity):**
```
Nevada:     flat ratio, 1 RPh : 3 techs max (non-hospital)
California: additive formula, first_rph_techs: 1, additional_rph_techs: 2
Tennessee:  cert-dependent, certified_techs: uncapped, non_certified_techs: 6 per RPh
```

---

### Task 1D — Compliance log export (.xlsx)

**Business outcome:** A managing pharmacist can select a date range and download
their compliance log as an Excel file for board submission, internal audit, or
record-keeping.

**Install:** `npm install xlsx`

**API route:** `app/api/reports/compliance-log/route.ts`

```typescript
// GET /api/reports/compliance-log?from=YYYY-MM-DD&to=YYYY-MM-DD&location_id=UUID
// Returns: .xlsx file download
// Auth: requires authenticated session (same auth pattern as rest of app)

import * as XLSX from 'xlsx';

// Query compliance log from Supabase for the given date range and location
// Build worksheet with columns:
//   Date | Hour | Pharmacist(s) | Technician(s) | Status | Notes
// Return as attachment: rxshift-compliance-log-[from]-to-[to].xlsx
```

**Worksheet columns:**

| Column | Content |
|--------|---------|
| Date | YYYY-MM-DD |
| Hour | 08:00–09:00 format |
| Pharmacist(s) | Full names, comma-separated |
| Technician(s) | Full names with cert status if applicable (e.g., "Jane Smith (CPhT)") |
| Required Ratio | e.g., "1 RPh : 3 tech max" |
| Status | COMPLIANT or DEFICIENT |
| Deficiency Notes | e.g., "1 tech short of required minimum" (blank if compliant) |

**UI:** On the Compliance Log page, add an "Export" button in the page header area
(right-aligned, secondary button style per DESIGN.md). On click, show a simple
date range selector (from/to date inputs) with a "Download" button. Generates and
downloads the .xlsx file client-side or via the API route.

**Note:** Full reports engine (staffing trends, multi-location summary, schedule
performance analytics) is deferred to a future phase. This export is the only
reports feature in this build.

---

## Part 2: Updated Marketing Copy

### 2A — Updated Nevada Page Copy (replaces Part 3 of rxshift-phase2-build.md)

The structure stays the same. These are the specific copy changes.

---

**H1 — KEEP AS IS:**
```
Nevada's proposed staffing rule requires
daily documentation software.
RxShift generates it automatically.
```

**Subhead — REPLACE WITH:**
```
Proposed rule R113-24 describes exactly the kind of hourly staffing
record that RxShift already generates from every published schedule.
Nevada pharmacies using RxShift today are in position before the
rule takes effect.
```

---

**"What R113-24 requires" section — KEEP THE LIST, UPDATE THE FRAMING**

Keep the four-item requirement list (hourly documentation, log deficient hours,
retain 2 years, notify Board after 3 consecutive deficient days). These are accurate
descriptions of the proposed rule.

**Replace the section intro body with:**
```
Nevada's Board of Pharmacy has been actively developing minimum staffing
rules under proposed R113-24. The rule's core documentation requirement —
a timestamped hourly staffing record — is exactly what RxShift generates
as a standard output of every published schedule.

Of the four requirements above, RxShift addresses the documentation piece
today. The volume minimums and board-notification triggers in R113-24 are
features we are tracking for a future release. What the rule asks for in
terms of daily documentation, you already have.
```

---

**Nevada comparison table — REPLACE WITH:**

| | RxShift today | What R113-24 will require |
|---|---|---|
| Hourly staffing record | ✓ Auto-generated | Required |
| Deficiency identification | ✓ Per hour | Required |
| Record retention | ✓ Stored, exportable | 2 years required |
| Volume-based staffing minimums | Roadmap | Required |
| Board notification trigger | Roadmap | After 3 consecutive deficient days |

Caption below table (Inter 400, 13px, steel, italic):
```
R113-24 remains in proposed status as of June 2026. When adopted,
volume minimums and notification triggers will be added to RxShift.
The documentation features exist today.
```

---

**"How RxShift handles it" section — THREE CARDS, REPLACE CARD 3:**

Card 1 (RATIO ENGINE) — keep as written.
Card 2 (HOURLY LOG) — keep as written.

**Card 3 — REPLACE with:**

Eyebrow: AHEAD OF THE RULE

Heading: Ready for R113-24 before it takes effect.

Body:
```
When R113-24 is adopted, the hourly documentation it requires will
already exist in your RxShift compliance log. Your scheduling workflow
doesn't change. The record that the rule asks for has been generating
since your first published schedule.

Volume minimums and board-report triggers are on our roadmap.
The documentation layer is live now.
```

---

**Remove entirely** from the Nevada page (was in Phase 2 spec):
- Any sentence claiming "automatic board-notification alerts"
- Any sentence claiming "3-consecutive-day deficiency triggers"
- The previous Card 3 content about board notifications

---

### 2B — Updated Battle Card Table (replaces the comparison table in Part 7 of rxshift-phase2-build.md)

**Remove these rows** (features not built; tied to proposed rule):
- ~~3-day consecutive deficiency alert~~
- ~~Board notification trigger~~
- ~~Nevada R113-24 ready~~ (replace with state-specific rows below)

**Replace the full table with:**

| Feature | RxShift | When I Work |
|---|---|---|
| **Built for pharmacy** | ✓ Pharmacy-specific | ✗ General workforce |
| **State ratio rules engine** | ✓ Configurable per state | ✗ Not available |
| **Real-time ratio enforcement during scheduling** | ✓ | ✗ |
| **Pharmacist-to-tech ratio tracking** | ✓ | ✗ |
| **Tech certification tracking** | ✓ (enables Tennessee compliance) | ✗ |
| **Hourly compliance log — auto-generated from schedule** | ✓ | ✗ |
| **Deficiency flagging per hour** | ✓ | ✗ |
| **Compliance log export (.xlsx)** | ✓ | ✗ |
| **Nevada compliance (NAC 639.250)** | ✓ | ✗ |
| **California compliance (BPC 4115)** | ✓ | ✗ |
| **Tennessee compliance (cert-dependent ratios)** | ✓ | ✗ |
| **Basic scheduling** | ✓ | ✓ |
| **Time-off requests** | ✓ | ✓ |
| **Staff management** | ✓ | ✓ |
| **Designed for 1–25 locations** | ✓ | ✓ |
| **Pharmacy-specific support** | ✓ | ✗ |

**Note on R113-24:** Remove the specific "Nevada R113-24 ready" row. The Nevada
compliance row (NAC 639.250 — current law) is accurate and stays. If the battle
card copy in the "The right tool" section references R113-24, update it to read:

```
Nevada is actively tightening documentation requirements under proposed
R113-24. RxShift already generates the hourly record the rule will
require. When I Work doesn't generate compliance documentation at all.
```

---

### 2C — Updated Pricing Page Features List (replaces Part 1 features in rxshift-phase2-build.md)

**Remove from the features list:**
- ~~Scripts-per-hour volume tracking~~ (not built; proposed-rule feature)
- ~~3-consecutive-day deficiency alerts~~ (not built)
- ~~Board notification triggers~~ (not built)

**Add to the features list (Documentation column):**
- Compliance log export (.xlsx)

**Updated Documentation column:**
- Automated hourly compliance log
- Deficiency flagging (per hour)
- 2-year record storage
- Compliance log export (.xlsx, date range selectable)

**Updated Coming Soon strip — REPLACE WITH:**
```
On the roadmap: PMS data import · Volume-based staffing minimums
· Board notification triggers · Float pool scheduling · Multi-location reporting
```

Note: "Volume-based staffing minimums" and "Board notification triggers" are now
correctly positioned as roadmap items rather than existing features.

---

## Part 3: No Changes Needed

The following sections of `rxshift-phase2-build.md` are unchanged by this amendment:

- Part 1: Pricing calculator logic and UI (no changes)
- Part 2: Leads / Supabase integration (no changes)
- Part 4: California state page copy (already appropriately scoped — does not claim R113-24 features)
- Part 5: Tennessee state page copy (no R113-24 claims; accurate as written)
- Part 6: Nav updates (no changes)
- Part 8: Internal linking (no changes)
- All design constraints (no changes)

The Lead Capture form, States dropdown, pricing calculator, and page scaffolding
can proceed as written in the Phase 2 spec.

---

## Part 4: Trainee Sub-limits

Do not include trainee sub-limits in any marketing, feature lists, or battle card.
Do not remove any existing schema fields if they are present in the codebase — just
leave them without surfacing them in marketing. This is a quiet omission, not a deletion.

---

## Execution Order for Claude Code

To avoid conflicts, build in this sequence:

1. Run code tasks 1A–1C (schema + engine verification/fixes) first
2. Run code task 1D (compliance export) after 1A (depends on deficiency flag field)
3. Apply marketing copy changes to Nevada page
4. Apply battle card table update
5. Apply pricing features list update
6. Build remaining Phase 2 items from `rxshift-phase2-build.md` (pricing page, lead capture, state pages, nav)

---

## Reminder: decisions.md

Log this in your local decisions.md:

```
[June 2026] Scope boundary: RxShift is a scheduling and ratio cap enforcement
tool with compliance logging. Not a full R113-24 compliance engine.
Volume minimums and board-report triggers are deferred to a future release.
R113-24 is urgency context in marketing, not a current feature checklist.
Hourly log + deficiency flagging + state ratio enforcement = the product today.
```

---

*This file supersedes specific copy sections and adds four code tasks.*
*Everything else proceeds as written in `rxshift-phase2-build.md`.*
*Reference `CLAUDE.md` for stack and architecture.*
*Reference `Brand Items/DESIGN.md` for all visual decisions.*

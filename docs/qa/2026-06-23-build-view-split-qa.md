# QA Report: Build/View Split + Scheduling Overhaul
**Date:** 2026-06-23
**Tester:** Platform admin (jamison@jamisonwest.com)
**Tenant:** Mesa Vista Pharmacy (demo, weekly cadence, 3 locations)
**Session:** Round 3 — Build/View split + scheduling overhaul
**Branch/Deploy:** app.rxshift.io (production demo)

---

## Summary

| # | Test Area | Result | Screenshot(s) |
|---|-----------|--------|---------------|
| 1 | Build Schedule — cadence, header, steppers, copy, no pills, edits, Ask AI | **PASS** (1 note) | ss_09247xkug |
| 2 | View Schedule — read-only, zoom, filters, published-only | **PASS** (2 notes) | ss_61135btda |
| 3 | Nav — both links, staff redirect from /app/schedule | **PASS** | — |
| 4 | PTO conflict — Ashley Dinh Fri Jun 26 ⚠ ring + Open Flags | **FAIL — DATA GAP** | — |
| 5 | Publish behavior — edits to published period appear immediately | **PASS** | ss_3249msgdt, ss_61135btda |
| 6 | Filters — two chip rows, no color legend at grid bottom | **PASS** | ss_7935a8gyq |

**5 PASS / 1 FAIL**

---

## Test #1 — Build Schedule (`/app/schedule`)

**What we checked:** Cadence-locking, header text, steppers, copy-forward button label, no zoom pills, editable cells, Ask AI.

**Repro steps:**
1. Navigate to `/app/schedule` as platform admin on Mesa Vista Pharmacy.
2. Confirm header period label and stepper behavior.
3. Confirm copy button label.
4. Confirm no Week/2-week/Month pills.
5. Click an empty cell — confirm shift editor opens.
6. Click "Ask AI" — confirm it works.

**Result: PASS**

- Header reads "Building: Jun 22 – Jun 28" — correct for weekly cadence tenant. (Monthly tenants would show "Building: June 2026"; weekly shows the date range. The task spec described monthly behavior, but Mesa Vista is weekly, so this is correct.)
- Steppers (← Prev / Next →) move one week at a time — correct.
- Copy button label: "Copy last week's pattern" — correct for weekly tenant. ("Copy last month's pattern" is the monthly-tenant label.)
- No Week/2-week/Month zoom pills present — confirmed.
- "Build mode" button present in toolbar (this is a separate control, not the old view toggle).
- Clicking Keisha Brown's empty Sat Jun 27 cell opened the shift editor correctly.
- Ask AI launched from Build Schedule — confirmed working.
- Two chip rows (DEPARTMENTS + WORK TYPES) present.
- No color legend at grid bottom.

**Note:** The "Build mode" button is present alongside the toolbar. Unclear if this is intentional for this release or a leftover; did not test its behavior as that was out of scope.

---

## Test #2 — View Schedule (`/app/view-schedule`)

**What we checked:** Read-only cells, Week/2-week/Month zoom, dept/work-type chip filters, published-only content, no build toolbar, no red/amber rings.

**Repro steps:**
1. Navigate to `/app/view-schedule`.
2. Click a shift cell — confirm no editor opens.
3. Click Week / 2 weeks / Month zoom buttons — confirm layout changes.
4. Click "Training" work-type filter — confirm only Training shifts shown.
5. Navigate to draft week (Jun 29–Jul 5) — confirm zero shifts shown.
6. Confirm no "Published ✓" / "Copy last week's pattern" / "Export CSV" toolbar.
7. Confirm no ⚠ rings on any cell.

**Result: PASS**

- Cell click: no shift editor opens — read-only confirmed.
- Week/2-week/Month zoom all function correctly.
- Training filter: shows only Miguel Santos and Tyler Brooks with TRAINING shifts — confirmed.
- Draft week (Jun 29–Jul 5): zero shifts displayed — published-only filter working.
- No build toolbar present (no Published button, no Copy pattern, no flag counter).
- No ⚠ red/amber rings on any cells.

**Note 1 (cosmetic):** Page title reads "Schedule — All locations" not "View Schedule — All locations". Minor cosmetic inconsistency; not a blocker.

**Note 2 (filter behavior):** The WORK TYPES chip row disappears when viewing the draft week (no shifts = no work types to filter). This appears to be by design but is worth confirming intentional.

---

## Test #3 — Nav

**What we checked:** Both "Build Schedule" and "View Schedule" in admin sidebar; staff user sees only View Schedule; direct navigation to `/app/schedule` as staff redirects to View Schedule.

**Repro steps:**
1. As platform admin, confirm both "Build Schedule" and "View Schedule" appear in Mesa Vista Pharmacy nav section.
2. Admin Console → emulate Jerome Williams (staff role).
3. Check sidebar — confirm Build Schedule is absent.
4. Navigate to `/app/schedule` directly — confirm redirect to `/app/view-schedule`.

**Result: PASS**

- Both "Build Schedule" and "View Schedule" visible in admin sidebar.
- Jerome Williams (staff) sidebar: shows View Schedule, My Schedule, Requests, Help. Build Schedule absent — correct.
- Emulation banner: "Viewing Mesa Vista Pharmacy as Jerome Williams (staff)" — displayed correctly.
- Direct `/app/schedule` navigation while emulating staff → auto-redirected to `/app/view-schedule` — confirmed.

---

## Test #4 — PTO Conflict Flag (Ashley Dinh, Fri Jun 26)

**What we checked:** On Build Schedule, Ashley Dinh's Fri Jun 26 shift should show a red ring + ⚠, appear in Open Flags, and block publish without a reason.

**Repro steps:**
1. On Build Schedule, look for Ashley Dinh in the staff list.
2. Check Fri Jun 26 cell for red ring + ⚠.
3. Open Open Flags panel — confirm PTO conflict flag is listed.
4. Attempt to publish — confirm blocked with reason required.

**Result: FAIL — Demo data gap**

**"Ashley Dinh" does not exist in Mesa Vista Pharmacy.** She is a staff member in the Optum Demo tenant only. The closest name in Mesa Vista is "Ashley Morales" — who has no PTO on Fri Jun 26.

The 14 open flags on Mesa Vista are:
- Ratio violation deficiency slots (Henderson Jun 25, North Las Vegas Jun 23)
- Overtime alerts (Jerome Williams, Keisha Brown, Carlos Rivera, Rachel Odom, and others after the test shift was added)

Zero PTO conflict flags exist. No ⚠ on any Fri Jun 26 cell for any staff member.

**Impact:** This scenario cannot be demoed on Mesa Vista Pharmacy as currently seeded. The PTO conflict feature itself may be functional — it just needs the correct demo data.

**Recommended fix:** Either add Ashley Dinh to Mesa Vista with a PTO entry on Fri Jun 26, or update the demo prompter script to direct presenters to the Optum Demo tenant for this step.

---

## Test #5 — Publish Behavior

**What we checked:** After publishing a period, adding/editing a shift in it — the change should appear immediately on View Schedule / Live Board without a separate re-publish action.

**Repro steps:**
1. Confirm Jun 22–28 week is published ("PUBLISHED — VISIBLE TO STAFF").
2. On Build Schedule, click Keisha Brown's empty Sat Jun 27 cell.
3. Set Work Type: Dispensing, time 09:00–17:00. Click "Save shift."
4. Immediately navigate to `/app/view-schedule` — no page refresh.
5. Locate Keisha Brown, Sat Jun 27 — confirm shift appears.

**Result: PASS**

- Jun 22–28 confirmed published.
- New Sat Jun 27 shift saved (09:00–17:00 Dispensing) via shift editor.
- Navigated to View Schedule — Keisha Brown's Sat Jun 27 cell immediately shows "09:00–17:00 DISPENSING."
- No additional publish action was required.
- View Schedule shows no ⚠ rings (clean display, flags are Build-only).

**Side effect observed:** Adding the Saturday shift pushed open flag count from 9 to 14 (new overtime / ratio alerts triggered). This is expected behavior; flag count is reactive.

---

## Test #6 — Filters

**What we checked:** Two chip rows (Departments + Work types) on both Build and View Schedule; no work-type color legend at bottom of grid on either.

**Repro steps:**
1. On Build Schedule, confirm two labeled chip rows above the grid.
2. Scroll to bottom of Build Schedule grid — confirm no color legend.
3. On View Schedule, confirm two labeled chip rows.
4. Scroll to bottom of View Schedule grid — confirm no color legend.

**Result: PASS**

**Build Schedule:**
- Row 1: DEPARTMENTS — Compounding, Drive-Thru, Retail Counter, Specialty
- Row 2: WORK TYPES — Dispensing (teal dot), Training (green dot)
- Bottom of grid: ends at Tyler Brooks row; no legend element present.

**View Schedule:**
- Row 1: DEPARTMENTS — Compounding, Drive-Thru, Retail Counter, Specialty
- Row 2: WORK TYPES — Dispensing (teal dot), Training (green dot)
- Bottom of grid: ends at Tyler Brooks row; no legend element present.

---

## Open Issues to Track

| # | Severity | Description |
|---|----------|-------------|
| 4a | HIGH | Ashley Dinh PTO conflict demo scenario missing from Mesa Vista — recommend seeding or redirecting to Optum Demo for this step |
| 2a | LOW | View Schedule page title shows "Schedule — All locations" not "View Schedule — All locations" |
| 2b | LOW | WORK TYPES chip row disappears on draft week (no shifts) — confirm this is intentional |
| 1a | LOW | "Build mode" button present in Build Schedule toolbar — confirm intended for this release |

---

## Resolution (Claude Code, 2026-06-23)

- **#4a (HIGH) — PTO conflict not demoable on Mesa Vista → FIXED in the seed.** The feature itself was
  verified working on the Optum tenant (Ashley Dinh, Fri Jun 26 → red ⚠ + Open Flags + publish gate);
  the gap was purely that Mesa Vista had no scheduled-on-a-day-off scenario. The seed now creates a
  **deliberate conflict: Keisha Brown (Henderson) has an approved day off this Friday but is kept on
  Friday's schedule** (she's intentionally excluded from `ptoExcluded`, so the shift stays and flags
  red). Prompter beat 6 updated to point at Keisha (Mesa Vista), not Ashley Dinh (Optum). **Requires a
  "Restore demo data" to take effect.**
- **#2a (LOW) — View title → FIXED.** View Schedule page title now reads "View Schedule — …" (matches nav).
- **#1a (LOW) — "Build mode" button → RENAMED to "⤢ Maximize"** (it's the chrome-collapse for laptop
  rows; "Build mode" was confusing now that Build is its own screen). Prompter beat updated.
- **#2b (LOW) — work-types chip row hides on an empty week → BY DESIGN.** The chips are derived from the
  work types actually present in the window; an empty (published-only) week has none, so the row is
  correctly absent. No change.

All other tests (Build cadence-lock, View read-only/zoom/published-only, nav + staff redirect,
publish-goes-live, filters) **passed** and need no change. `tsc` + build clean.

## Environment

- Platform admin: jamison@jamisonwest.com
- Tenant: Mesa Vista Pharmacy (demo)
- Demo clock: pinned to 2026-06-23 14:30
- Cadence: Weekly
- Locations tested: All (Henderson, North Las Vegas, Spring Valley)
- Tab ID: 1923000985

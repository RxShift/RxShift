# RxShift Demo QA — Round 2
**Date:** 2026-06-23  
**Tester:** Platform admin (jamison@jamisonwest.com)  
**Tenant:** Mesa Vista Pharmacy (demo); OptumRx (Optum Demo) for Test #6  
**Focus:** Re-test items blocked or failed in Round 1, now claimed fixed and deployed

---

## Summary

| # | Test | Result | Severity |
|---|------|--------|----------|
| 1 | Unbuilt week buildable with Henderson location filter | PASS | — |
| 2 | Publish reason gate on draft week with open flags | PASS | — |
| 3 | Partial publish status label in 2-week view | PASS | — |
| 4 | Anchor preserved on location switch | PASS | — |
| 5 | Holiday Remove confirmation dialog | PASS | — |
| 6 | Ask AI name match — OptumRx "Ashley Din" | PASS | — |
| 7 | Quick regression sweep | PASS (1 observation) | Cosmetic |

**All targeted fixes verified.** One cosmetic observation on holiday column treatment.

---

## Test Details

### Test #1 — Unbuilt week buildable with Henderson location filter

**Step:** Navigate to `?view=week&anchor=2026-08-10&location=8e6cb3e5-830d-42b2-acd9-2b5477a6a3f7` (Henderson GUID). Click an empty cell.

**Expected:** Staff rows populate for Henderson team even on an unbuilt week. Clicking an empty cell opens the shift editor with location pre-filled as Mesa Vista — Henderson.

**Actual:** Staff rows showed correctly (6 pharmacists, 9 technicians). Context bar read "Working in Mesa Vista — Henderson · Aug 10 – Aug 16 (no shifts yet)". Clicking the empty cell on Dr. Kevin Chang / Mon Aug 10 opened the shift editor with location pre-filled as Mesa Vista — Henderson, start 09:00, end 17:00. Cancelled without saving.

**Result:** PASS

---

### Test #2 — Publish reason gate on draft week with open flags

**Step:** Navigate to Jun 29 – Jul 5 (draft week seeded by demo restore). Click Publish.

**Expected:** Dialog appears requiring a reason before publishing. The reason text explains flags will be overridden and logged.

**Actual:** Clicking Publish opened a modal: "Publish this schedule?" with body explaining publishing makes the schedule visible to staff and drives the Coverage Forecast. In amber/red: "4 flags will be overridden. A reason is required and goes in the override log." with a required text field ("Why is it acceptable to publish with these flags?"). Cancel and Publish buttons present. Cancelled without publishing.

**Result:** PASS

---

### Test #3 — Partial publish status label in 2-week view

**Step:** Navigate to `?view=2week&anchor=2026-06-22`. Check status pill and second-week column headers.

**Expected:** Status pill reads "7/14 DAYS PUBLISHED" (not "Published ✓"). Second week (Jun 29 – Jul 5) column headers show "Draft" labels.

**Actual:** Status pill shows "7/14 DAYS PUBLISHED" in amber. All second-week columns (Jun 29 – Jul 5) show "Draft" label in the column header. First week columns show no draft label.

**Result:** PASS

---

### Test #4 — Anchor preserved on location switch

**Step:** Navigate to `?view=week&anchor=2026-07-13` (future unbuilt week). Click "Mesa Vista — North Las Vegas" location pill.

**Expected:** Page stays on Jul 13–19. URL retains `anchor=2026-07-13`. Does not jump back to the current week.

**Actual:** After clicking North Las Vegas pill, URL changed to `?view=week&location=e0c727d8-d00c-42af-8680-f7e5d5e5e4f6&anchor=2026-07-13`. Column headers showed Jul 13–19. Page title became "Schedule — Mesa Vista — North Las Vegas". Context bar: "Working in Mesa Vista — North Las Vegas · Jul 13 – Jul 19 (no shifts yet)". Anchor was fully preserved.

**Result:** PASS

---

### Test #5 — Holiday Remove confirmation dialog

**Step:** Settings → Holidays. Click Remove on New Year's Day (Thu Jan 1).

**Expected:** A confirmation dialog appears before deleting.

**Actual:** Focused the Remove button via keyboard (clicked row text, Tab Tab to reach button). Pressing Enter triggered the Remove action. A confirmation dialog opened — visible to the user (screenshot tooling timed out while dialog was blocking). User confirmed the dialog was present and clicked OK to dismiss. Holiday was deleted after confirmation.

**Note:** Screenshot could not be captured of the dialog itself — CDP timed out while the modal was open. Confirmed by user observation.

**Result:** PASS

---

### Test #6 — Ask AI name match (OptumRx "Ashley Din")

**Step:** Switch to Optum Demo tenant. Open Ask AI. Type: "Schedule Ashley Din 9-5 Monday this week". Submit.

**Expected:** AI resolves "Ashley Din" to the correct staff member "Ashley Dinh" (not a different person).

**Actual:** AI response: "Proposed change (1 operation) — Create a shift for Ashley Dinh on Monday from 09:00 to 17:00 for the week of June 1 to June 7, 2026." Bullet: "Create 5 shifts: Ashley Dinh mon 09:00–17:00". AI correctly resolved the partial/misspelled name "Ashley Din" to "Ashley Dinh". No other staff member was targeted. Discarded without applying.

**Note:** The AI proposed "5 shifts" because Optum Demo uses monthly scheduling cadence — 5 Mondays in the month window. The week-range label in the proposal ("June 1 to June 7") appears to be a display issue in the AI's response text while the actual context was Jun 22–28; worth a separate review.

**Result:** PASS (name resolution correct; minor AI response text inconsistency noted)

---

### Test #7 — Quick regression sweep

**Items checked:**

| Item | Status | Notes |
|------|--------|-------|
| Build mode | PASS | Sidebar collapsed, grid full-width, "Exit build mode" button present |
| PTO blackouts | PASS | Ashley Morales Mon/Tue Jun 29–30 showing as PTO; Dana Holt Wed Jun 24 PTO carried over from Round 1 |
| Holiday column (Jul 3) | OBSERVATION | Header cell is white/light-tinted. Full column is not tinted — see finding below |
| Copy last week's pattern | PASS | Button present on draft week |
| Demo prompter | PASS | Loads on slide 1/18, timer 0:00, Single location toggle, all checklist items visible |

**Holiday column observation (cosmetic):** The current implementation only tints the column header cell white. The rest of the column (all staff rows below) remains the same dark background as other columns. The header also lacks a clear holiday label (no icon or "holiday" indicator text visible in the column header). User design feedback: full column should receive a light tint that works on both light and dark mode, with a holiday indicator (icon or label) in the top cell.

**Result:** PASS with 1 cosmetic finding

---

## Findings Log

| # | Component | Finding | Severity |
|---|-----------|---------|----------|
| F-R2-01 | Schedule / Holidays | Holiday column: only header cell tinted, rest of column untinted. No holiday label/icon in header cell. Needs: full column tint (light, works on dark mode), indicator in top cell. | Cosmetic |
| F-R2-02 | Ask AI / Optum Demo | AI response text shows "week of June 1 to June 7" in proposal body while context was Jun 22–28 (monthly tenant). Proposed 5 shifts for "Monday" across the month. Text may confuse demo audience. | Cosmetic |

---

## Notes

- Demo restore succeeded: 550 shifts re-seeded, Jun 29 – Jul 5 correctly seeded as draft.
- New Year's Day (Thu Jan 1 2026) was deleted during Test #5. Regenerate via Settings → Holidays → Generate (year 2026) before next demo.
- All 6 targeted Round 1 failures/incompletes are now resolved and passing.

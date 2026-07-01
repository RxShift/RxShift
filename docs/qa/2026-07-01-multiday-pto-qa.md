# RxShift QA — Multi-Day PTO Entry

**Date:** 2026-07-01
**Tester:** Claude (Cowork), acting as platform admin (dr.monahanwest@outlook.com)
**Environment:** app.rxshift.io, Mesa Vista Pharmacy demo tenant
**Prep:** Admin Console → Mesa Vista → Restore demo data, run before testing.
**Today's date / schedule window at test time:** 2026-07-01 (Wed). Current published week: Jun 29 – Jul 5. Next week (Jul 6 – Jul 12) exists as an unpublished draft, already built with shifts.

## Result summary

| # | Item | Result |
|---|------|--------|
| 1 | Single-day PTO (regression) | Pass |
| 2 | Multi-day PTO block (5-7 days) | Pass |
| 3 | Shifts removed in range | Pass |
| 4 | Extends beyond visible week | Pass |
| 5 | Through-date before start date | Pass (handled gracefully) |
| 6 | Require a reason on PTO | Pass |

Multi-day PTO entry works end to end. One caveat below on the date-field UX that's worth a look, even though it's not a functional bug in the feature itself.

## 1. Single-day PTO (regression)

Build Schedule → Dr. Lena Park, Sat Jul 4 (had an existing 9:00 AM-7:00 PM shift). Ticked PTO, left "through this date" on 07/04/2026, reason "sick," saved.

Result: only Sat Jul 4 blacked out to "PTO." Sun Jul 5 and the rest of her week were untouched. Old single-day behavior still works.

## 2. Multi-day PTO block (5-7 days)

Build Schedule → Dr. Marcus Webb, Mon Jun 29. Ticked PTO, set "through this date" to 07/05/2026 (7 days total, Mon through Sun), reason "vacation," saved.

Result: all 7 days (Mon Jun 29 through Sun Jul 5) showed "PTO" for Dr. Webb after one save. Confirmed by reloading the page and re-checking the row.

**Note on how I set the date:** my first attempt at this test (on a different pharmacist, Dr. Patricia Nguyen) only produced a single day of PTO instead of the full range. On inspection, that was caused by how I typed into the date field, not the app itself: clicking into the field can land focus on the day segment instead of the month segment, so typing a full date string like "07/05/2026" doesn't fill the field the way you'd expect from a plain text box. Setting the date directly (as the browser's date picker would) worked correctly every time after that. Flagging this only because a human tester who "types over" the pre-filled date without paying attention to which segment is focused could hit the same false negative — not a bug in your PTO logic, but worth a one-line QA note if you write a script for regression testing this later.

## 3. Shifts removed in range

Same action as #2 covered this: Dr. Marcus Webb had real shifts every day that week (Spring Valley, 11:00 AM-7:00 PM Mon-Fri, 9:00 AM-5:00 PM Sat). After saving the PTO block, all of those shifts were gone — replaced by "PTO," not just visually overlaid. No leftover shift times anywhere in the range.

## 4. Extends beyond the visible week

Build Schedule → Dr. Owen Fitzgerald, Fri Jul 3 (had a 2:00 PM-7:00 PM shift, viewing the Jun 29 – Jul 5 week). Ticked PTO, set "through this date" to 07/07/2026 — two days past the end of the visible week — reason "vacation - beyond window test," saved.

Result: Fri Jul 3 through Sun Jul 5 blacked out in the current week view, as expected. Navigated forward to the Jul 6 – Jul 12 week (still in draft) and confirmed Mon Jul 6 and Tue Jul 7 also showed "PTO" for Dr. Fitzgerald, replacing his existing Henderson shifts on those two days. The block was not capped to the week that was on screen when I saved it.

## 5. Through-date before start date

Build Schedule → Dr. Sunita Patel, Mon Jul 6 (viewing the Jul 6 – Jul 12 draft week). Ticked PTO, set "through this date" to 07/01/2026 — five days before the start day — reason "edge case test," saved.

Result: no crash, no error dialog. It saved as a single-day PTO entry on Mon Jul 6 only. Tue Jul 7 (her next shift) was left completely untouched. This is the "clear, graceful" outcome the ask called for — RxShift silently treats an invalid range as a single day rather than erroring or corrupting data. If you want an explicit inline warning here instead of silent fallback, that'd be a product call, not a bug — right now it just does the sensible thing without telling the user why the through-date didn't take.

## 6. Require a reason on PTO

Found this setting already turned ON by default in the Mesa Vista demo tenant (Settings → Organization → "Require a reason on PTO"), so I left it as-is rather than toggling it and changing baseline config.

Tested by opening a fresh cell for Amanda Cole (Tue Jun 30, no existing shift), ticking PTO, and trying to save with the reason field blank. Result: save was blocked, the button changed color, and a clear inline message appeared: "A reason is required for PTO at this pharmacy." No silent failure, no partial save.

## State after testing

Ran Restore demo data again at the end. Confirmed the Jun 29 – Jul 5 week is back to its original 10-open-flags baseline with no PTO entries left over from testing (checked Lena Park, Marcus Webb, Patricia Nguyen, Owen Fitzgerald, and Sunita Patel individually). Demo tenant should be clean for the next person.

---

## Resolution (Claude Code, 2026-07-01)

All 6 items passed — feature verified. Both caveats reviewed; **no code change**:

- **Date-field typing quirk (test #2 note).** Native `<input type="date">` segment behavior, not app logic. The
  field already carries `min={date}`, so choosing from the calendar (the normal path) can't produce a bad range.
  A one-line note for future regression scripts: set the through-date via the picker, not by typing over the
  pre-filled value.
- **Before-start through-date → silent single-day (test #5).** The `min={date}` attribute blocks this on the
  picker path; the client also clamps `end = through >= date ? through : date`, and the server rejects
  `end_date < start_date`. The silent single-day fallback only occurs when the `min` guard is bypassed
  (automation/manual typing), so an explicit inline warning isn't warranted. Left as-is by design.

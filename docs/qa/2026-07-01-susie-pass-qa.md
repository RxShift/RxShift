# RxShift QA Pass — July 1 Build

**Date:** 2026-07-01
**Tester:** Claude (Cowork), acting as platform admin (dr.monahanwest@outlook.com)
**Environment:** app.rxshift.io, Mesa Vista Pharmacy demo tenant
**Prep:** Admin Console → Mesa Vista → Restore demo data, run before testing. Baseline period Jun 29 – Jul 5, already published with 10 pre-existing open flags (unrelated demo data).

## Result summary

| # | Item | Result |
|---|------|--------|
| 1 | Time format (12h/24h) | Pass |
| 2 | Unpublish | Pass |
| 3 | Manager status → ratio update | Pass |
| 4 | Call-out → reverse | Pass, with one flag for the team |

All four items behaved correctly. Details and one open question below.

## 1. Time format

Settings → Organization → Time format, toggled 12-hour → 24-hour → Save.

- Saved correctly, confirmation "Saved." shown.
- Build Schedule: shift times switched to military (e.g. 09:00-17:00). Confirmed on the all-locations grid.
- View Schedule: same, confirmed military format.
- My Schedule: RxShift's own login isn't tied to a staff record, so `/app/me` shows "Your sign-in isn't linked to a staff record yet" for the platform admin. Used Admin Console → View as a user → Jerome Williams (staff) to check this screen. Confirmed 9-17 format there.
- Toggled back to 12-hour, saved, and confirmed AM/PM returned on Build Schedule.

No issues. Note for future QA passes: testing "My Schedule" as the admin account directly isn't possible unless the admin's login email is set on a staff profile. Emulation via "View as a user" is the workaround and works well.

## 2. Unpublish

Build Schedule, current published week (Jun 29 – Jul 5).

- Confirmed the week was visible on View Schedule before making changes.
- Clicked Unpublish → confirmation modal appeared with clear copy ("This returns this window to draft for every location... shifts are kept"). Confirmed.
- Schedule flipped to "DRAFT — NOT VISIBLE TO STAFF YET" and shifts disappeared from View Schedule immediately (only a couple of PTO entries remained, which is expected since PTO isn't tied to publish state).
- Republished to restore the original state. Publishing required an override reason because of the 10 pre-existing open flags ("10 flags will be overridden. A reason is required and goes in the override log.") — this is correct behavior and worth knowing: any republish on this demo tenant will prompt for a reason as long as those flags exist.

No issues.

## 3. Manager status → ratio update

Live Board → Status board, Mesa Vista — Henderson.

- Before: 2 pharmacists counting, 3 techs, "1 pharmacist can step away and stay compliant."
- Set Dr. Sunita Patel to Lunch. Ratio card updated instantly: 1 pharmacist counting, banner changed to "At the ratio limit — no pharmacist can step away right now." Dr. Patel moved to a "Not counting right now" line with her status shown.
- Reverted to Working. Card returned to baseline (2 pharmacists, compliant) instantly.

No issues. Update is live with no refresh needed.

## 4. Call-outs

Requests → Callouts → Log Callout, for Dr. Sunita Patel (on shift Wed Jul 1, Henderson), tied to her actual shift so RxShift could compute the ratio gap.

- The modal previewed the impact before submission: "This callout would create 10 deficient ratio slots on 2026-07-01." Good — this is a real-time preview, not just a log-it-blind action.
- After logging: Live Board showed Dr. Patel under "Off shift" with a red "Called out" tag, and the Henderson ratio card dropped to 1 pharmacist counting with the "at the ratio limit" banner, same as the manager-status test.
- Build Schedule: her Wed Jul 1 shift cell was flagged "CALLED OUT" in red.
- Reversed with "I'm back." Row updated instantly to "Reversed — back at work," and Live Board / Build Schedule both returned to normal (pharmacist back on the ratio count, shift back to a normal cell).

**One thing to flag for the team:** the callout modal warned of "10 deficient ratio slots," and the Live Board correctly reflected the deficiency in real time. But the Dashboard's "Deficient Slots" tile (top of `/app/dashboard`) stayed at 6 the entire time — it didn't pick up the 10 slots from the callout, before or after reversal. I didn't check whether that tile is meant to be point-in-time (recalculated on next schedule edit) rather than live, but if a manager glances at the Dashboard during a call-out, the top-line number won't reflect what's actually happening on the floor. Worth a quick gut-check with the team on whether that's expected or a gap. I'm not confident either way — flagging rather than calling it a bug.

## State after testing

Everything was restored to baseline before finishing: time format back to 12-hour, schedule republished, Dr. Patel's status back to Working, and her call-out reversed. Demo tenant should be clean for the next person who opens it.

---

## Resolution (Claude Code, 2026-07-01)

- **Dashboard "Deficient slots" tile during a call-out — by design, no change.** That tile is computed by
  `validateBundle` over the current *published schedule* period (`app/app/(shell)/dashboard/page.tsx`) — it's the
  planned-schedule deficiency count, intentionally distinct from the Live Board's real-time state. A call-out is a
  live-floor event, so it correctly updated the Live Board (and the Compliance Record for the day) but not the
  schedule-plan metric. The Live Board / wall display is the surface managers watch for live floor status. Left
  as-is; flagged to Jamison in case a separate live indicator on the Dashboard is ever wanted.
- **Separately shipped this pass (not from this QA):** multi-day PTO entry ("through this date" on the shift
  editor) — Susie's "must enter one day at a time" item — plus help-article updates (migration 0041) for
  call-outs, statuses, time format, and the PTO/unpublish workflows.

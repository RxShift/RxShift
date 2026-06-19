# RxShift Full Product + Demo QA Report
**[RxShift] [JWC]** · QA pass June 19, 2026 · Local dev (localhost:3200), R072-25-on Mesa Vista demo tenant, demo clock pinned 14:30, emulating Frank DiMaggio / Patricia Nguyen. Repo treated read-only; demo app tested live and reset at the end.

---

## Context summary

RxShift is a multi-tenant B2B SaaS that builds state pharmacist-to-technician ratio compliance into the schedule for retail pharmacies (1-25 locations), surfacing deficiencies before they become violations and never blocking the pharmacy or contacting a board. The three-artifact model: the **Schedule** is the plan; the **Coverage Forecast** (`/app/coverage-forecast`) projects the published schedule ("are we *scheduled* to be in ratio?"); the **Compliance Record** (`/app/log`) is the immutable, hour-by-hour as-worked record of what actually happened, finalized hour by hour, retained two years, annotatable but never edited. The recently built **R072-25** work adds, behind the `nevada_r072_25` tenant toggle, a retail 4-tech ceiling (or 2 techs + 2 trainees), a solo-pharmacist staffing floor (>=1 support, >=2 with a drive-through), a 2-trainee sublimit, plus Tennessee certified-tech-uncapped enforcement and collect-only expected-Rx volumes. All confirmed live in the build.

---

## R072-25 features found

| Route | Feature | State | Gated as "proposed"? |
|-------|---------|-------|----------------------|
| `/app/settings` (Organization) | "Apply Nevada R072-25 rules (proposed - not yet adopted)" toggle | Functional, ON for demo | **Yes - excellent.** Copy: "Current Nevada law (NAC 639.250) is always enforced... R072-25 had its public hearing in June 2026 and is not yet law - leave this off until it's adopted." |
| `/app/settings/ratio` | State selector (NV), rule type (flat/additive), max techs per pharmacist = 3 (NAC 639.250 base), notes cite NAC 639.250 / NRS 639.1371 | Functional | Base rule is current law; R072-25 overlays the ceiling at engine level |
| `/app/settings/locations` | `location_type` (all Retail), drive-through (Spring Valley = Yes), expected Rx per location | Functional | Informational |
| `/app/schedule` | Per-day "Rx N" expected-volume labels in the grid header | Functional | Informational, never enforced (verified - collect-only) |
| `/app/staff` | `staff_type` (pharmacist / tech / tech-in-training); Tyler Brooks + Miguel Santos are trainees | Functional | n/a |
| Engine (Live Board, Ask AI, Compliance Record) | 4-tech ceiling + solo-pharmacist floor proven live | Functional | n/a |

Floor rule verified working two ways: (1) Ask AI "schedule Dr. Fitzgerald Mon-Fri 9-5" on an empty week flagged **80 deficient slots** (lone pharmacist, no support); (2) approving the lone tech's (Jerome) PTO flagged a floor deficiency. Ceiling verified via the seeded Henderson Thursday gap. **Gating is correct everywhere I looked** - R072-25 is consistently labelled proposed/not-adopted and current law (NAC 639.250) is what's claimed.

---

## Bugs and blockers

**1. Coverage Forecast period/location dropdown navigates to the wrong screen.** *(Degrades demo - functional)*
On `/app/coverage-forecast`, changing the period/location dropdown navigates to `/app/log?period=<id>` (the **Compliance Record** route) instead of staying on Coverage Forecast. The `?period=` param is then ignored and the page resets to today's Compliance Record. Reproducible every time. Effect: from the dropdown you can only ever see the default (Spring Valley, current week); any other period/location dumps you into the Compliance Record. Direct URL `/app/coverage-forecast?period=<id>` works, which is how I confirmed Henderson's forecast + the Acknowledged Exceptions section. Should: stay on `/app/coverage-forecast` and load the selected period.

**2. Live Board / wall display ratio label says "(3/pharmacist)" while the limit is computed at 4.** *(Degrades demo - undercuts the R072-25 story)*
With R072-25 on, each location card shows e.g. Spring Valley "limit **12** (3/pharmacist)" (3 pharmacists x 4), Henderson "limit **8** (3/pharmacist)", North Las Vegas "limit **4** (3/pharmacist)". The limit *number* correctly uses the R072-25 4-tech ceiling, but the parenthetical descriptor still prints the stored base rule (3). Root cause confirmed in Settings -> Ratio (base rule = 3 = NAC 639.250; engine overlays 4). Same bug on the kiosk `/app/display`. Should: when R072-25 is active, the label should read "(4/pharmacist)" (or whatever the effective ceiling is), matching the limit.

**3. Email Log detail view crashes with a runtime error.** *(Functional - platform-admin only, not customer-facing)*
Clicking any row in `/app/admin/emails` opens `/app/admin/emails/[id]` and throws a Next.js Runtime Error: *"Jest worker encountered 2 child process exceptions, exceeding retry limit."* The rendered email HTML never displays. I could not verify the branded-HTML rendering because of this. Platform-admin only, so not a prospect-facing demo blocker, but it's a real crash.

**4. New compliance-record notes and audit-log entries are attributed to the role, not the person.** *(Cosmetic / degrades demo)*
A note I added to a deficient hour (emulating Frank, owner_admin) saved as **"owner_admin - 6/19/2026"**, sitting directly beneath the seeded note attributed to **"Frank DiMaggio."** The Audit Log "WHO" column likewise shows "owner_admin" for live actions. The Override Log resolves the display name correctly ("Frank DiMaggio"). So display-name resolution is inconsistent across surfaces - the June 18 fix reached the Override Log but not the compliance-note / audit-log paths. Side-by-side mismatch looks sloppy on the Compliance Record.

**5. Next.js dev error overlay ("1 Issue" red badge) is visible on every screen, including the kiosk wall display.** *(Cosmetic - but visible in demo)*
A red "N - 1 Issue" pill sits bottom-left on every page. It's the dev overlay flagging a React hydration mismatch on the `<html>` className (caused by the no-flash theme/sidebar-collapse inline script). Dev-only, harmless to function, but a red "1 Issue" badge on a customer's always-on wall monitor looks bad. Fix by running a production build for demos (or `suppressHydrationWarning` on `<html>`).

**6. "Restore demo data" gives no success confirmation or row count.** *(Minor / cosmetic)*
The reset link just reverts to its idle label with no toast, count, or spinner. The QA asks to "note the row count returned" - none is surfaced in the UI. I verified the reset worked by inspecting the Compliance Record afterward. A confirmation toast ("re-seeded N rows / finalized ~294 hours") would make it obvious the reset ran.

---

## Script vs. reality discrepancies

**Live Board deficiency only appears on a Thursday, not "whenever the clock is pinned into the window."** DEMO-GUIDE says (s2): *"Henderson shows Deficient during the Thursday 2-4pm gap... if 'now' lands there"* and (s3): *"With the Demo clock pinned into that window, it also shows on the Live Board."* In reality the demo clock only sets the **time of day on today's real date**. Today is Friday (June 19); the deficiency is anchored to **Thursday** June 18. At clock 14:30 the Live Board shows Henderson **COMPLIANT NOW** (Patel + Fitzgerald both on a Friday shift). The live-board deficiency beat is only reproducible if the demo is run on a Thursday. The Compliance Record (June 18) shows it correctly regardless. **Update the guide and/or the demo script** so no one promises a live-board deficiency on a non-Thursday.

**Demo clock persists through reset (the guide implies it may not).** QA step 3.13 says "DEMO-GUIDE.md says it doesn't - verify." Observed: after a full Restore demo data, the clock stayed **"Pinned to 14:30."** Tenant config is preserved, and `demo_clock` is tenant config, so it persists. This is convenient, but the script/guide should state it plainly.

**Neither seeded pending PTO is a clean "safe" approval.** QA step 3.10 expects Jerome Williams' pending PTO to "approve cleanly." It does not: approving it flags **"Creates 2 deficient ratio slots on 2026-07-03"** and requires a logged reason - because Jerome is the lone tech and his absence leaves a solo pharmacist with no support (the R072-25 floor). Patricia's submitted PTO likewise flagged 4 slots. There is no seeded request that approves without a reason, so the "clean approve, no reason needed" path can't be demoed from seed data. (The reason-required gate itself works perfectly.)

**Admin Console controls open via "Edit," not by clicking the tenant row.** DEMO-GUIDE s0 says "Click the Mesa Vista row to expand its controls." The row name isn't clickable; the **Edit** link (which toggles to "Close") opens the lifecycle / email / Restore-demo-data / Demo-clock panel. Minor wording fix.

**Frank shows as an email in the emulate dropdown.** In Admin -> View as a user, Frank is listed as "frank@mesavistarx.com (owner_admin)" while Jerome and Patricia show full names. The emulation **banner** correctly reads "Frank DiMaggio," so only the dropdown label is inconsistent.

---

## Website copy issues

**Homepage hero (`components/hero.tsx`, lines 17-18) - regulatory overclaim.** The subhead says RxShift produces *"the hourly **documentation regulators require**."* Per the R072-25 build, **there is no hourly-documentation mandate** in current Nevada law (NAC 639.250); the hourly-doc requirement belonged to the proposed/superseded R113-24, which the build explicitly stripped out everywhere else. This line slipped through the reframe. Reword to something accurate, e.g. "...the hour-by-hour record an inspection asks for..." (value framing, not a mandate claim).

**Homepage intro - borderline volume-enforcement implication.** "...and the math changes when volumes shift." R072-25 volume is **collect-only** (expected Rx shown, never enforced). This phrasing implies prescription volume changes the required ratio. Soften so it doesn't imply volume enforcement.

**Accurate / clean (verified):**
- Pricing is correct: `lib/pricing.ts` -> standard **$199**, growth **$169**, enterprise **$149** monthly ($1,990 / $1,690 / $1,490 annual). Matches the 1-4 / 5-9 / 10+ tiers.
- Nevada page: "Publish the schedule, and the Compliance Record writes itself - **hour by hour**." The "hour by hour" qualifier makes this honest (no instant-record overclaim). R072-25 framed as proposed/forward-context, current law = NAC 639.250.
- Features card "An automated hourly Compliance Record" copy is accurate (as-worked, hour by hour, never contacts your board) - though its **image** is stale (see Imagery).
- **No** stale "Compliance Log" in `app/`, `components/`, or `lib/` (the one `app/about` grep hit was "compliance **logic**"). **No** live "R113-24" - the only match in `supabase/` is an explanatory comment in migration `0033` describing what it removed; live help content was rewritten.

---

## Imagery status

All five files in `public/images/screenshots/` were captured **June 17**, before the as-worked Compliance Record rebuild (June 18) and R072-25 (June 19). Every one predates the current sidebar (they all lack **Coverage Forecast** and **Audit Log** in the COMPLIANCE nav).

| Image | Location (page / component) | Shows | Current app state | Status | If stale - what's wrong / should show |
|-------|------------------------------|-------|-------------------|--------|----------------------------------------|
| `compliance-record.jpg` | Homepage features (`components/features.tsx`); Nevada callout (`components/nevada-callout.tsx`) | Old "Compliance Record - Jun 15-Jun 21" **date-range** view: period dropdown, "Hours & caps flags", all-COMPLIANT Spring Valley rows, DATE column, "Print report" button | Compliance Record is now **single-day, as-worked**: Henderson Thursday 14:00-16:00 DEFICIENT "Over ceiling", Frank's annotation inline, "Save as PDF (official record)" | **STALE (most severe)** | Recapture the new as-worked record on June 18 (Henderson) showing a deficient hour + the attached note. The current screenshot is actually the *Coverage Forecast* layout mislabeled "Compliance Record" - directly contradicts the (accurate) feature copy beside it. |
| `schedule-all-locations.jpg` | Homepage **hero** (`components/hero.tsx`); features | All-locations week grid, "8 open flags", role bands, red Thursday rings | No **"Rx N"** volume labels in day headers; flag count differs (R072-25 floor adds slots); sidebar missing Coverage Forecast/Audit Log | **STALE** | Recapture with R072-25 expected-Rx labels and current nav. It's the homepage hero, so highest visibility. |
| `dashboard.jpg` | Homepage features | "Deficient slots **4**", Insights, Quick actions | "Deficient slots **6**" (R072-25 adds the NLV floor gap); quick-action card now "What actually happened, hour by hour"; sidebar missing 2 items | **STALE (moderate)** | Recapture; "Insights" label is already correct. |
| `live-board.jpg` | Live-board showcase (`components/live-board-showcase.tsx`) | Spring Valley "limit **9** (3/pharmacist)", NLV "limit 3", Henderson "limit 6"; headroom lines present | Limits now 12 / 4 / 8 (R072-25 4-tech ceiling); sidebar missing 2 items; staffing differs | **STALE** | See recapture caution below. Headroom feature is intact in the image. |
| `live-board.gif` | Live-board showcase (`components/live-board-showcase.tsx`) | Headroom count-down animation, same June-17 vintage/sidebar | Same R072-25 / sidebar deltas as `live-board.jpg` | **STALE (assumed - same capture batch)** | Re-record with the headroom demo on the current build (and the label fix). |

**Files to regenerate (clean list for `scripts/capture-screenshots.ts`):**
1. `compliance-record.jpg` - highest priority (wrong artifact + contradicts copy)
2. `schedule-all-locations.jpg` - homepage hero
3. `dashboard.jpg`
4. `live-board.jpg`
5. `live-board.gif`

**Recapture caution (important):** the demo tenant currently has **R072-25 ON**, so any recapture from it will show the proposed 4-tech ceiling (limit 12/8/4) and the "(3/pharmacist)" label bug. But the marketing site deliberately leads with **current law (NAC 639.250 = 3 techs/pharmacist)**. So before regenerating: (a) fix bug #2 (the label), and (b) decide whether marketing imagery should reflect current law (toggle R072-25 off for the capture, giving the "correct" 3/pharmacist numbers the old `live-board.jpg` happens to show) or the proposed rule. Capturing R072-25 numbers into marketing while the page claims only current law would itself be an overclaim.

---

## What's working well (demo-ready as-is)

- **Compliance engine + Ask AI** are the standout. Ask AI returned an accurate non-compliance summary, did an exact extend (Patel Thu 09:00-14:00 -> 09:00-16:00 with "removes 4 deficient slots"), worked on an empty future week (created 5 shifts + the period on confirm, with the required acknowledgment checkbox), and the floor rule fired correctly (80-slot warning).
- **Compliance Record (as-worked)** is excellent: correct heading, accurate framing, June 18 Henderson 14:00-16:00 DEFICIENT "Over ceiling" with Frank's annotation inline, append-only "+ Note" that saves, timestamps, and survives refresh.
- **Live Board headroom + live status** recalculates instantly (set Fitzgerald to Lunch -> Henderson dropped from "1 can step away" to "at the limit", Fitzgerald moved to "Not counting"). Status board grouped by location + Off-shift group. Kiosk `/app/display` opens chrome-free with location switcher + Fullscreen.
- **Schedule**: role-banded rows, red-ring+warning ratio channel vs amber constraint ring both visible at once (Jerome Saturday overtime), immediate engine re-eval on add/delete, deep-links from the dashboard land on the exact slot/date.
- **Override Log** correctly attributes "Frank DiMaggio" with the full Patel narrative; **Requests** show compliance impact before submit and require a logged reason to approve a deficiency-causing PTO.
- **Emulation banner** shows the person's name ("Frank DiMaggio"); Platform nav hidden while emulating; demo sub-banner hides the redirect address from prospects; empty week shows disabled Publish (not "Published checkmark").
- **R072-25 toggle gating** and the **marketing copy reframe** are largely done right (current law claimed, R072-25 proposed, pricing correct, no live R113-24, no instant-record overclaim).
- **Demo reset** is reliable - restored the seeded deficiencies + annotations and wiped all my test data (notes, PTO, future shifts).

---

## Recommended fix priority (before the next live demo)

1. **Coverage Forecast dropdown routing (bug #1)** - it breaks a core compliance screen; switching period/location bounces you into the Compliance Record.
2. **Live Board "(3/pharmacist)" label (bug #2)** - visible on the board and the kiosk wall display; it undercuts the R072-25 ceiling story and will leak into any recaptured screenshot.
3. **Regenerate the 5 marketing screenshots**, `compliance-record.jpg` first (wrong artifact + contradicts its own copy) and the hero `schedule-all-locations.jpg` second - after #2 is fixed and after deciding current-law vs R072-25 numbers.
4. **Homepage hero copy** - drop the "hourly documentation regulators require" mandate claim and soften "the math changes when volumes shift."
5. **Email Log detail crash (bug #3)** - platform-admin only, so lower demo urgency, but it's a hard runtime error.
6. **Attribution consistency (bug #4)** - resolve display_name for compliance notes + audit entries so they match the Override Log.
7. **Run a production build for the demo** (or suppress the hydration warning) so the red "1 Issue" dev badge doesn't show on screens / the wall display.
8. **Update DEMO-GUIDE / demo script**: clock persists through reset; live-board deficiency only reproduces on a Thursday; neither seeded PTO is a clean approve; controls open via "Edit"; no row-count on reset.

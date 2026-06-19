# RxShift — R072-25 Compliance Engine + Schema Build

**Shipped:** June 19, 2026 · **Entity:** JWC LLC · **Migrations:** 0032, 0033

## Why

Nevada's proposed rule **R072-25** (LCB File No. R072-25; public hearing June 4,
2026; **not adopted**) supersedes the earlier R113-24 we had been referencing.
The regulation (`docs/PublicHearingNotice.R072-25.pdf`) changes the staffing math
and invalidates the R113-24 marketing copy. This build implements R072-25 behind a
tenant toggle, adds Tennessee, removes every R113-24 reference, and rewrites the
Nevada marketing to lead with **current** law (NAC 639.250).

Key facts read from the regulation:
- **Sec 10 (amends NAC 639.250) — ceiling:** retail non-institutional → **4
  technicians** per pharmacist (was 3), *or* **2 techs + 2 techs-in-training**;
  telepharmacy / remote / satellite → **3**; institutional → 3.
- **Sec 2.3 — floor (a new kind of check):** when a pharmacy is staffed by
  **exactly one** pharmacist, it must also have **≥1** support person (no
  drive-through) or **≥2** (with a drive-through). Under-staffing, not over-.
- **Sec 2.2 — volume:** prescription-volume thresholds. **Collect data only — do
  NOT enforce** (Decision 4).
- **No** hourly-documentation mandate and **no** 3-consecutive-day board trigger
  (those were R113-24). The Compliance Record stays valuable (audit/inspection),
  but its regulatory framing changed: sustained-deficiency alerts are an internal
  heads-up to the pharmacy's own managers; RxShift never contacts a board.

**Tennessee** (confirmed, Tenn. Comp. R. & Regs. 1140-02-.02): ceiling of **6
non-certified** technicians per pharmacist; **certified (CPhT) techs are uncapped**.

## The engine model

Everything R072-25 is gated behind one tenant toggle, **`tenant.nevada_r072_25`**
(default off), applied per location by **`location.location_type`**. A pure
mapper, **`lib/engine/rule.ts` `buildEngineRule(rule, ctx)`**, turns the stored
`ratio_rule` (+ location context) into the engine rule:

- **Ceiling:** NV retail + toggle on → 4 techs, `max_trainees_per_pharmacist = 2`;
  telepharmacy/institutional or toggle off → the stored cap. TN (`rule.state ===
  'TN'`) → `certified_uncapped = true` (only non-certified techs count against the
  cap).
- **Floor:** NV retail + toggle on → `floor_min_support = hasDriveThrough ? 2 : 1`;
  else `null` (off).

`evaluateZone` (`lib/engine/ratio.ts`) splits counting techs into trainee/
non-trainee and certified/non-certified, then evaluates **ceiling** (techs with no
pharmacist; counting techs over the cap, TN counts only non-certified; trainees
over the sublimit) and **floor** (`floor_min_support` set, exactly one counting
pharmacist, support present < the minimum). Each slot carries a **`flag_type`**
(`ceiling` | `floor` | `both`); `generateComplianceRecord` rolls it up per hour;
the finalizer persists it on `compliance_record.flag_type`.

**Default behavior is unchanged:** with the toggle off, a retail location, and a
non-TN state, `buildEngineRule` returns exactly the pre-R072-25 rule — the existing
55 engine tests stay green. 19 new tests in
`lib/engine/__tests__/floor-and-r072.test.ts` cover the floor (±drive-through),
the 4-tech ceiling, the 2-trainee sublimit, TN certified-uncapped, and a
`flag_type = both` hourly roll-up.

Every caller of `evaluateZone` now passes per-location context via
`engineRuleForLocation(rule, location, tenant)` (or `buildEngineRule` directly in
the tsx-safe finalizer): `validateBundle`, `buildComplianceRecords`,
`lib/compliance-record.ts`, `lib/board-data.ts`, `lib/live-board.ts`,
`lib/actions/requests.ts` (callout gap), and `lib/actions/ai.ts`.

## Schema (migration 0032)

- `location`: `location_type` enum (`retail` | `telepharmacy` | `institutional`,
  default `retail`), `has_drive_through boolean default false`, `expected_rx_mon..
  sun int` (nullable, informational).
- `staff`: `staff_type` enum (`pharmacist` | `tech` | `tech_in_training`),
  backfilled from `ratio_type` (+ `job_title ~* 'train'` → `tech_in_training`),
  NOT NULL default `tech`. `staff.certified` is unchanged (drives TN).
- `tenant`: `nevada_r072_25 boolean default false`.
- `compliance_record`: `flag_type text check (flag_type in
  ('ceiling','floor','both'))` (nullable).

Migration **0033** refreshes the legacy `compliance-record` help article (it
predated the per-location rebuild and still said "ratio zone" + R113-24
board-report) and cleans the same drift from three other help articles.

## Settings + product UI

- **Settings → Organization:** the `nevada_r072_25` toggle ("Apply Nevada R072-25
  rules (proposed — not yet adopted)").
- **Settings → Ratio:** the state selector already offered TN; a TN-specific note
  now explains certified-tech-uncapped.
- **Settings → Locations:** `location_type` select, `has_drive_through` checkbox,
  and seven `expected_rx_*` fields per location.
- **Staff directory:** a `staff_type` ("Role type") select alongside "Counts as",
  plus an "In training" badge in the list.
- **Schedule:** an informational **"Rx N"** per-day label in the grid header
  (location-scoped, or summed across locations). Never enforced.
- **Compliance Record + Coverage Forecast:** deficient hours show a distinct flag —
  "Over ceiling (too many techs)" vs "Under floor (understaffed)" vs both.

## Sustained-deficiency reframe (was R113-24 board trigger)

`deficiencyStreaks` now exposes `sustainedDeficiency` (threshold-parameterized,
default `SUSTAINED_DEFICIENCY_DAYS = 3`) instead of `boardReportTriggered`. The
publish-time alert and the Coverage Forecast banner read as an internal heads-up to
the pharmacy's own managers — no "board report may be required" language anywhere.

## Marketing

- `app/(marketing)/nevada/page.tsx` — full rewrite leading with NAC 639.250 (current
  law, enforced every shift, flagged before publish) + the hourly Compliance Record
  for inspections; R072-25 only as forward context ("public hearing June 2026; not
  adopted; RxShift updates automatically when it passes"). Rules table = current vs
  proposed. No hourly-doc mandate, no volume-enforcement claim, no scripts/hr.
- `components/nevada-callout.tsx`, `app/(marketing)/vs/when-i-work/page.tsx`,
  `app/layout.tsx` meta, `components/features.tsx` — all reframed off R113-24.
- Zero "R113-24" remain in `app/ components/ lib/ supabase/` and the live help
  corpus.

## Demo (Mesa Vista)

R072-25 is **on** for the demo tenant. All three locations are retail; **Spring
Valley** has a drive-through (staffed to stay compliant under the floor of 2);
Tyler Brooks and Miguel Santos are `tech_in_training`; expected Rx volumes are
seeded. Two distinct deficiencies in the current week, both finalized into the
immutable Compliance Record:
- **Ceiling** — Henderson, Thursday 2–4 PM (Dr. Patel left at 2:00, float held at
  Spring Valley until 4:00 — techs counting with no pharmacist). `flag_type =
  ceiling`.
- **Floor** — North Las Vegas, Tuesday 9–10 AM (a tech called out; Dr. Chang
  opened solo with no support). `flag_type = floor`.

Both are annotated with a documented note and survive `--reset`.

## Verification (June 19, 2026)

- `tsc --noEmit` clean; `vitest` 74/74 green; `next build` clean.
- 0032 applied; 0033 applied. `--reset` → exactly 3 deficient hours (2 ceiling
  Henderson + 1 floor NLV), confirmed in `compliance_record.flag_type` via SQL.
- Live DB confirmed: `nevada_r072_25 = true`, SV `has_drive_through = true`, all
  retail, expected Rx populated, 2 `tech_in_training`.

## Flags for review

- **Regulatory copy ships on push.** R072-25 is *proposed, not adopted* — only NAC
  639.250 (and CA BPC 4115, TN 1140-02-.02) is claimed as current law. The Nevada
  positioning and the Terms/Privacy retention wording should get Susie/attorney
  review before being relied on.
- Volume thresholds (Sec 2.2) are **collect-only** — the schedule shows expected
  Rx; nothing enforces a minimum. Don't let copy imply enforcement.
- v1 approximations: "one pharmacist" = one *counting* pharmacist; floor "support
  present" = techs/trainees on a covering shift (intern pharmacists not modeled);
  30-minute slot granularity.

# Spec (PROPOSED) — As-worked compliance: the defensible audit record

> **Status: PROPOSED — design only, NOT built. Pending regulatory validation by Susie / the Nevada Board of
> Pharmacy before any implementation.** Raised in the June 18, 2026 demo debrief. This file is the inbox spec;
> do not build from it until Jamison + Susie confirm the regulatory shape (esp. retention + required fields).

## The problem (confirmed in code)

Today RxShift's compliance record is **as-scheduled**, not **as-worked**:

- `/app/log` (`app/app/(shell)/log/page.tsx`) calls `buildComplianceRecords(bundle, tenant)`
  (`lib/schedule-data.ts` → `lib/engine/compliance.ts`), which **regenerates the hourly record on every view
  from the currently *published* shifts** (+ approved PTO).
- At publish, `publishPeriod` / `publishWindow` (`lib/actions/schedule.ts`) write an immutable
  `compliance_snapshot` row per location — again, a snapshot of **the plan**.
- Live status (lunch / stepped away / callout) drives **only** the Live Board badge and the
  `live-ratio-check` alert cron (`lib/live-board.ts`, `app/api/cron/live-ratio-check/route.ts`). It is
  **never written into the hourly compliance record.**
- The Mesa Vista Henderson 2–4pm deficiency is **schedule-driven**: the seed publishes Dr. Patel's Thursday
  shift shortened to 14:00 and the float starting 16:00, and the engine flags those slots. It is not produced
  by a live event.

**Why this is not defensible.** A compliance *audit* must show what **actually happened** hour by hour. A
schedule-derived record proves intent, not adherence — a pharmacy could publish a compliant schedule, send the
pharmacist home, and the record would still read "compliant." It does not capture late arrivals / early
departures, live lunch / non-counting changes, or post-publish callout gaps. Before a paying pharmacy relies
on RxShift for board defense, the record it produces must be the **as-worked** one.

## The three artifacts (keep them distinct)

1. **Change / audit log** — *who did what, who changed what, when.* We have a foundation: append-only
   `activity_log` + `/app/log/audit` + append-note (`activity_log_note`). Needs to comprehensively capture
   publishes, edits, approvals, callouts, and **live-status changes**.
2. **As-scheduled forecast** — *what we have at `/app/log` today.* Genuinely useful for planning ("are we
   covered?"). **Keep it, relabel it clearly as a forecast.**
3. **As-worked audit (NEW)** — the immutable, hour-by-hour record of **actual** counting staff and whether
   ratio was met, regardless of the schedule. **This is the legally defensible artifact and the gap.**

## Regulatory grounding (honest confidence)

- **High confidence (principle):** the ratio is a *maintained-on-duty* condition — Nevada frames technicians
  *per pharmacist on duty* ([NRS 639.1371](https://law.justia.com/codes/nevada/chapter-639/statute-639-1371/)),
  i.e. a real-time operating requirement, and board inspections check *actual* staffing and records. An audit
  is about demonstrated adherence over time.
- **Medium confidence — MUST be confirmed with Susie / the Board before building:** the precise **form,
  required fields, and retention period** of an actual-staffing record. Do **not** hard-code a retention
  window or "official format" from assumption. Open questions below.

## Proposed mechanism (sketch — for review, not final)

- **Capture actuals.** Source of truth for "who was actually present and counting" = a **history of
  `live_status`** over time. (Verify: the table already has `effective_from`/`effective_to`; the board reads
  the current row. If history is retained, it's the seed of this — otherwise add an immutable status-event
  log.) Combine with the published shift (scheduled presence) so "no status set" can default sensibly, and
  with clock-in/out if/when that exists.
- **Freeze each hour.** An **end-of-hour job** (cron) — or on-status-change writes — materializes an
  **immutable** `as_worked_compliance` row per location per hour: actual counting RPh / techs (names), ratio
  met/deficient, and any documented reason. Once written for a past hour, it is never recomputed from the
  schedule.
- **Relabel `/app/log`.** Present the current regenerated view as the **as-scheduled forecast**; make the
  **as-worked** record the official audit + PDF. Keep the publish-time `compliance_snapshot` as the "what was
  planned at publish" artifact.
- **Harden the change log** so every staffing-affecting action (incl. live-status changes and post-publish
  edits) lands in `activity_log`.

### Data-model sketch (illustrative; finalize after regulatory review)
- `as_worked_compliance` (immutable): `tenant_id`, `location_id`, `date`, `hour`, `pharmacists_on_duty[]`,
  `technicians_counting[]`, `ratio_status`, `reason`, `recorded_at`. Append-only (no update/delete).
- `live_status_event` (if `live_status` history isn't sufficient): append-only status changes with
  `effective_from`, so the hourly job can reconstruct actual presence.

## Demo-data implications
- Mesa Vista would need seeded **as-worked** rows for past hours (current week's elapsed days) so a demo can
  show a real "we were compliant 9–2, deficient 2–4 (documented), compliant 4–7" record — distinct from the
  schedule. The Henderson Thursday story becomes an *actual* recorded gap, not just a scheduled one.

## Open questions for Susie / the Board (block the build)
1. What exactly must an hour-by-hour actual-staffing record contain to be board-defensible in NV (and CA)?
2. Retention period? Format (is print-to-PDF acceptable, or is a specific export required)?
3. Is "scheduled presence + live-status adjustments" an acceptable proxy for "actual presence," or is
   explicit clock-in/out required?
4. How should documented exceptions (the Patel emergency) attach to the as-worked record vs the schedule?

## Scope
**No code in this task.** This spec exists so Jamison + Susie can validate the regulatory shape. On greenlight,
it moves through the normal spec workflow (build → reconcile → archive). See `docs/decisions.md` for the
decision record.

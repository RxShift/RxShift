# RxShift QA Report — Round 3: Staff Scheduling Logic
**Date:** 2026-06-23  
**Tester:** Platform admin (jamison@jamisonwest.com), administering Mesa Vista Pharmacy  
**Environment:** app.rxshift.io (production, Vercel deploy pushed 2026-06-23)  
**Demo clock:** pinned 14:30 on 2026-06-23  
**Scope:** New staff-scheduling-logic surfaces shipped June 23

---

## Summary

| Area | Result |
|------|--------|
| Staff list → Edit slide-over (notes, exclude, constraints, rules, availability) | PASS |
| Build Schedule — hover tooltip | PARTIAL (DOM-confirmed, not visually captured) |
| Build Schedule — name click → slide-over + Accept | PASS |
| Build Schedule → Apply rules (proposals, Accept, unmet warning) | PASS with BUG |
| Amanda Cole — Excluded from ratio | PASS |
| Settings → Organization: First day of week | PASS |
| Reports: Schedule export (.xlsx) | PASS |
| Reports: Print view pagination | PASS |

**1 confirmed bug:** Dismiss on scheduling rule warnings causes renderer freeze (CDP timeout). Action never reaches server.

---

## Test 1 — Staff list → Edit slide-over

**Path:** Staff → select any staff member → Edit button  
**Result: PASS**

The slide-over opens as a full-detail record editor. All required sections present and functional:

**Scheduling notes** — free-text field. Populated with notes (e.g., Carlos Rivera: "Mon-Fri availability. Prefers morning shifts. Has been asking for lead tech promotion."). Visible as contextual text in the slide-over header area.

**Exclude from ratio calculations** — checkbox. Toggling changes the value; save persists. Amanda Cole confirmed checked (see Test 4).

**Constraints (Guards)** section:
- Lists existing constraints with type, value, and date range
- Add New Constraint button opens an inline form with 7 constraint types: Hour cap, Overtime threshold, Unavailable window, Hard stop time, Recurring unavailability, Always off, Max consecutive days
- Edit and Delete actions present per constraint (no Pause on constraints)
- Constraint creation confirmed working: test constraint created for Amanda Cole (Hour cap 40hr/wk, 2026-06-24 open)
- **Note:** Delete on constraints also causes a CDP renderer timeout (same failure mode as Dismiss — see Bug section). Test constraint may persist on Amanda Cole's record.

**Scheduling rules** section:
- Lists active rules with description, status badge (Active/Paused)
- Add New Rule button opens form for pattern-based rules
- Edit, Pause, and Delete actions present per rule
- Carlos Rivera has "Mon-Fri, 09:00–17:00, Dispensing" active rule
- Dr. Lena Park has "Every other Monday, 08:30–16:00, Training" and "3rd Thursday, 12:00–13:00, Training" rules

**Availability summary** — shows a read-only weekly summary of current scheduled hours and upcoming constraints.

**Save behavior** — Save button refreshes the record in place without full page reload. No navigation away.

---

## Test 2 — Build Schedule: Hover tooltip

**Path:** Build Schedule → current or near-future week → hover staff name in grid  
**Result: PARTIAL — DOM-confirmed, not visually captured in screenshot**

Hovering over staff names in the schedule grid is expected to show a tooltip with notes + rules + limits. Visual tooltip popups were not captured in screenshots (tooltip renders as floating layer that may not appear in static captures).

DOM inspection confirmed tooltip content is present as accessible names on the staff name buttons. The content matches the scheduling notes and rule summaries from their records.

**Verified via DOM:** Tooltip content tied to accessible button labels on staff name elements.

---

## Test 3 — Build Schedule: Name click slide-over + Accept

**Path:** Build Schedule → navigate to unbuilt week (Jul 13–19 or Jul 20–26) → click staff name  
**Result: PASS**

Clicking a staff name in the schedule grid opens the staff slide-over in a variant form that includes a **"RULES FOR THIS WEEK → Accept"** panel at the top, in addition to the standard record sections.

**Confirmed on Jul 20–26 (Dr. Lena Park):**
- Top panel shows "Rules for week of Jul 20" with a proposal: Monday Jul 20, 8:30am–4pm, Training
- This is the "ON" Monday in her every-other-Monday alternating pattern (Jul 13 = OFF, Jul 20 = ON)
- Accept button is present and active

**Accept behavior:**
- Clicking Accept adds the shift directly to the schedule grid
- No confirmation dialog — action is immediate
- Ratio flags update in real-time after Accept (deficient ratio slot indicator appears if pharmacist coverage is missing for those hours)
- Shift appears in grid with correct time range and work type

**Alternating Monday pattern validation:**
- Jul 13 = OFF Monday → no proposal shown for that date
- Jul 20 = ON Monday → proposal shown with 8:30am–4pm Training
- Pattern confirmed correct

---

## Test 4 — Build Schedule: Apply Rules

**Path:** Build Schedule → navigate to unbuilt week → Apply rules button  
**Result: PASS with BUG (Dismiss)**

**"Apply rules"** button label: "Propose shifts from each person's scheduling rules."

### Behavior on seeded weeks (Jun 22 – Jul 12)
All rules already satisfied by existing shifts → dialog shows only "No unmet rules" or satisfied indicators. No proposals generated for already-covered shifts.

### Behavior on unbuilt weeks (Jul 13+)

Navigating to Jul 13–19 (completely unbuilt week) generates a full proposals dialog grouped by person:

**Carlos Rivera — Weekday pattern**
- Proposals for Mon Jul 14 through Fri Jul 18 (9:00–17:00, Dispensing)
- All 5 days shown as individual Accept proposals
- Accept per-shift and Accept All both functional

**Dr. Lena Park — Every-other-Monday + 3rd-Thursday**
- Jul 13 week: 3rd Thursday of July = Jul 16 → Training 12pm–1pm proposal present ✓
- Jul 13 Monday = OFF in alternating pattern → no Monday proposal ✓
- Jul 20 Monday = ON → Training 8:30am–4pm proposal present ✓
- Pattern math confirmed correct

**Accept all / per-person behavior:**
- Accept All button accepts every proposal across all staff in one action
- Per-person Accept accepts only that staff member's proposals
- Each accepted shift drops to the grid immediately with correct data
- Ratio flags recalculate after each acceptance

**Ashley Morales — Monthly inventory quota (unmet warning)**
- Quota-based rule: "Monthly inventory count — once per month"
- No specific shift time to propose → shows as ⚠ unmet warning with Dismiss
- **BUG: Dismiss is non-functional (see Bug section below)**

---

## Bug: Dismiss on scheduling rule warnings causes renderer freeze

**Severity:** High — feature is present in UI but completely non-functional  
**Reproducible:** 100% — confirmed in both Apply rules dialog and per-person slide-over panel  

**What happens:**
1. Click Dismiss on any scheduling rule unmet-quota warning
2. CDP sendCommand times out after 30,000ms
3. Browser renderer freezes; page fails screenshots with "page still loading" for ~90 seconds
4. Recovery: navigate directly to any URL (e.g., `/app/schedule?anchor=2026-06-29`)

**Audit log verification:**
- After recovery, checked `/app/log/audit` → no "dismiss rule" entry exists
- The action never reached the server; freeze occurs in the client renderer

**Pattern:** Identical failure mode to Delete on constraints (prior session). Both involve write actions on scheduling rule/constraint objects that trigger a renderer crash.

**Affected surfaces:**
- Apply rules dialog → Dismiss button on quota-type unmet warnings
- Per-person slide-over Rules panel → Dismiss button

**Workaround:** None — the Dismiss button must be avoided. Users cannot acknowledge unmet quota warnings.

---

## Test 5 — Amanda Cole: Excluded from ratio

**Path:** Staff → Amanda Cole → Edit; Live Board; Compliance Record  
**Result: PASS**

**Staff record:**
- "Exclude from ratio calculations" checkbox is checked ✓
- No scheduling constraints or active rules on record (by design — she's excluded from ratio tracking)

**Live Board:**
- Amanda Cole does not appear in any ratio coverage columns
- She is absent from pharmacist:technician ratio counts entirely
- "Present, Not Counting" column exists on the Live Board for ratio-excluded staff who have active shifts — this column is present and correctly scoped

**Compliance Record:**
- Amanda Cole does not appear in the numerator or denominator of any ratio calculation
- She would appear in "Present, Not Counting" column only if she had an active shift during a coverage window — she has no shifts in the demo data
- The distinction between "excluded and present" vs. "excluded and absent" is handled correctly

---

## Test 6 — Settings: First day of the week

**Path:** Settings → Organization tab  
**Result: PASS**

**Mesa Vista Pharmacy organization settings:**

| Setting | Value |
|---------|-------|
| Organization name | Mesa Vista Pharmacy |
| Timezone | America/Los_Angeles |
| Build cadence | Weekly |
| **First day of the week** | **Monday** |
| Ratio slot length | (visible, not tested) |

"First day of the week = Monday" confirmed in dropdown. Setting description: "Sets the schedule grid column order, weekly/biweekly period boundaries, and reporting week grouping."

Additional settings visible on page: Default unpaid break, pharmacist:technician ratio toggle, require reason on PTO, Nevada R072-25 preview toggle (off), accent color / logo branding.

---

## Test 7 — Reports: Schedule export

**Path:** Reports → Schedule export  
**Result: PASS**

**Interface:**
- FROM / TO date pickers (default: 2026-05-28 to 2026-06-24)
- Location checkboxes: Mesa Vista — Henderson, Mesa Vista — North Las Vegas, Mesa Vista — Spring Valley
- "Leave all unchecked for every location" note
- Download .xlsx and Print view buttons

**Download .xlsx test:**
- All 3 locations checked
- Endpoint: `GET /api/reports/schedule-range?from=2026-05-28&to=2026-06-24&locations=all`
- File verified via in-browser SheetJS parse

**Sheet names (exact):**
1. `Schedule`
2. `Hours by staff`
3. `Hours by location`

**Schedule sheet structure:**
- 315 rows (across 3 locations, ~4 weeks)
- Columns: Date, Day, Staff, Role, Location, Start, End, Hours, Work type(s), Break (min), Compliance, Flags
- Sample row: `2026-05-28 | Thu | Dr. Owen Fitzgerald | pharmacist | Mesa Vista — Henderson | 14:00 | 19:00 | 5 | | 0 | | `

**Hours by staff sheet:**
- 15 rows (one per staff member)
- Columns: Staff, Role, Total hours, Shifts

**Hours by location sheet:**
- Present (structure consistent with spec)

---

## Test 8 — Reports: Print view

**Path:** Reports → Print view button  
**Result: PASS**

**URL:** `/app/reports/print?from=2026-05-28&to=2026-06-24&locations=all`  
**Header:** "Schedule — print view, May 28 – Jun 24"  
**Actions:** Back button + Print / Save as PDF button

**Three location sections confirmed in page:**
1. Mesa Vista — Henderson
2. Mesa Vista — North Las Vegas
3. Mesa Vista — Spring Valley

**Pagination structure:**
- Henderson section parent: `class="print:break-after-page"` ✓
- North Las Vegas section parent: `class="print:break-after-page"` ✓
- Spring Valley section (last): no break-after (correct — no page break needed after last location)

Tailwind `print:break-after-page` utility applies `break-after: page` in `@media print`, ensuring each location starts on a new printed page. The on-screen view shows locations as continuous sections; page boundaries only activate on actual print.

Each location section shows a weekly grid (Mon start per org setting) with staff grouped as Pharmacists and Technicians, showing work type labels under each shift time.

---

## Regression notes

No regressions observed against Round 1, 2, or 2.5 findings during this session. The following previously-confirmed behaviors remained stable:
- Platform admin banner and Exit tenant link present throughout
- Demo pharmacy warning banner present
- Navigation sidebar items all reachable
- Demo clock held at 14:30 on 2026-06-23

---

## Open bugs from this session

| # | Description | Severity | Reproducible |
|---|-------------|----------|--------------|
| B-01 | Dismiss on scheduling rule unmet-quota warning causes CDP renderer timeout; action never reaches server; no audit log entry | High | 100% |
| B-02 | Delete on staff constraints causes same CDP renderer timeout (carryover from prior session) | High | 100% (prior session) |

Both B-01 and B-02 share the same failure signature: CDP sendCommand timeout on write operations that touch the constraint/rule layer. Likely a single root cause.

---

## Resolution — Claude Code, 2026-06-24

**Root cause (confirmed): native browser dialogs.** The single shared cause CoWork suspected was
correct — all three affected buttons called the browser's built-in `confirm()` / `prompt()`:

- B-01 Dismiss → `prompt()` for the reason (`rule-proposals-section.tsx:81`)
- B-02 Delete constraint → `confirm()` (`staff-record-panel.tsx:264`)
- (also) Delete rule → `confirm()` (`staff-record-panel.tsx:194`)

Native dialogs halt the page's JS thread and **cannot be driven by CDP/headless automation**, which is
exactly the 30s `sendCommand` timeout + renderer freeze CoWork hit. (For a live human these dialogs *do*
work — but they freeze any automated/scripted run, are off-brand, and behave inconsistently across
browsers, so they were the wrong tool here.)

**Fix:** replaced all three with the app's existing `components/ui/modal.tsx` —
- Delete rule / Delete constraint → a branded confirm Modal (Cancel + destructive **Delete**), naming the
  item being removed.
- Dismiss → a Modal with a required **Reason (logged)** textarea (still writes to `override_log`,
  `warning_type='rule'`); Dismiss is disabled until a reason is entered.

Swept the whole `app/` + `components/` tree — these were the **only** native dialogs; no third one lurks.
`tsc --noEmit` clean; scheduling-rules vitest 12/12. **Re-run B-01 + B-02 (now driveable via the DOM) to
close them out.**

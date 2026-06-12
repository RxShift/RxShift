You are working on RxShift, a pharmacy workforce scheduling SaaS built on 
Next.js and Supabase Postgres. The application is fully functional with a 
complete schema and multi-tenant architecture. Before doing any work, 
inspect the database schema fully so you understand the exact table 
structure, column names, relationships, and existing tenant modes. Do not 
assume anything about naming — read the schema first.

---

## YOUR TASK

Implement three things:

1. A new tenant mode called "demo" (alongside existing modes)
2. A fully seeded demo tenant for Mesa Vista Pharmacy
3. A reset mechanism that restores the demo tenant to its baseline state

---

## PART 1: DEMO TENANT MODE

The app already has a concept of tenant modes (e.g., onboarding, trial, 
production). Add "demo" as a new mode with these behavioral rules:

- Demo mode suppresses ALL outbound emails from the system — no email 
  reaches any user address stored on demo tenant staff or schedules
- Instead, ALL system emails that would normally be sent are redirected 
  to a single "demo admin email" address stored on the tenant record. 
  This field should be configurable per tenant. It defaults to empty. 
  When populated, redirected emails go there. When empty, emails are 
  suppressed entirely.
- Demo tenants are never promoted to production and never appear in 
  billing or usage metrics
- Demo tenants should be clearly labeled in any admin UI

Do this in a way that is consistent with how trial mode already works. 
Follow existing patterns exactly.

---

## PART 2: SEED DATA — MESA VISTA PHARMACY

Create a demo organization named "Mesa Vista Pharmacy" with three 
Nevada locations. This is a fictional independent pharmacy group. 
All people, emails, and data are entirely fictional. No real people 
are represented.

### The Organization

- Name: Mesa Vista Pharmacy
- Tenant mode: demo
- State: Nevada
- Active ratio rules: Nevada NAC 639.250 (current law) and proposed 
  R113-24 minimums where applicable
- Demo admin email: (leave configurable/empty — Jamison will set it)

### The Three Locations

**Location 1 — Spring Valley**
Main location. Highest volume. ~25-28 scripts/hour at peak. This 
location should be fully staffed and fully compliant — it is the 
"everything working correctly" showcase location in demos.

**Location 2 — Henderson**
Mid-volume location. ~15-18 scripts/hour. This is the deficiency 
story location. One Thursday this week, 2:00–4:00 PM, the location 
ran with only 1 tech when volume required 2. This should be clearly 
visible in the compliance log, flagged on the dashboard, and 
documented as a deficiency. The deficiency reason: tech callout 
(Miguel Santos, unavailable). This should NOT have triggered a 
3-consecutive-day board report — it was one isolated incident this 
week, showing the early-warning story.

**Location 3 — North Las Vegas**
Newest location, lower volume, ~8-10 scripts/hour. Smaller team, 
fully compliant, gives the demo a "we're growing" narrative.

### Staff Roster

Seed the following fictional staff across the three locations. Use 
@mesavistarx.com as the fictional email domain for all staff. These 
emails do not exist and will never receive mail.

**Spring Valley**
- Dr. Patricia Nguyen, RPh — Managing Pharmacist / PIC
- Dr. Marcus Webb, RPh — Staff Pharmacist
- Carlos Rivera, CPhT — Lead Certified Tech
- Ashley Morales, CPhT — Certified Tech
- Dana Holt, CPhT — Certified Tech
- Tyler Brooks — Pharmacy Trainee

**Henderson**
- Dr. Sunita Patel, RPh — Staff Pharmacist
- Dr. Owen Fitzgerald, RPh — Float (shared Spring Valley / Henderson)
- Jerome Williams, CPhT — Certified Tech
- Keisha Brown, CPhT — Certified Tech
- Miguel Santos — Pharmacy Trainee (the callout — mark as called 
  out for the Thursday deficiency window)

**North Las Vegas**
- Dr. Kevin Chang, RPh — Staff Pharmacist
- Rachel Odom, CPhT — Certified Tech
- Destiny Freeman, CPhT — Certified Tech

**Organization admin (demo login)**
- Frank DiMaggio — Owner / Admin (non-pharmacist)
- Email: frank@mesavistarx.com
- This is the primary demo login account

Staff certifications, hire dates, and any credential fields should 
be seeded with plausible fictional data consistent with their roles. 
Trainees should be marked as trainees with appropriate sub-ratio 
classification per Nevada rules. Certified techs should be marked 
as CPhT-certified.

### Schedules

Seed 6 weeks of schedule data: 4 weeks of history (now in the past), 
the current week (active), and 2 weeks forward. 

IMPORTANT: Do not hardcode any dates. Anchor all schedule dates 
relative to the Monday of the current week at runtime. Past weeks 
are computed as negative offsets, future weeks as positive offsets. 
This ensures schedule data never goes stale regardless of when the 
seed or reset runs.

Schedules should reflect:
- Standard pharmacy operating hours (Mon–Sat, 9am–7pm typical retail)
- Realistic shift patterns: morning and afternoon shifts, pharmacist 
  overlap windows
- Staffing levels consistent with scripts-per-hour volumes and 
  Nevada ratio rules at each location
- The Henderson Thursday deficiency baked into the current week 
  schedule (2:00–4:00 PM, insufficient tech coverage for volume)
- PTO: seed one approved PTO request and one pending PTO request 
  across the roster — these should be visible as real use cases 
  in the schedule view

### Compliance Log

Seed an hourly compliance log for each location covering the 
current week and the 4 weeks of history. Format should match 
however the compliance log is structured in the app.

Each log entry represents one hour of operation and should record:
- The pharmacist(s) on duty that hour
- The tech(s) on duty that hour
- Calculated ratio
- Compliant / deficient status

For Henderson, Thursday of the current week, 2:00–4:00 PM: mark 
these two hours as DEFICIENT. Log entries should show 1 tech present, 
2 required for the volume level. This is the only deficiency in the 
current week. Historical weeks should be entirely compliant.

### Scripts-Per-Hour Volume

Seed scripts-per-hour volume data for each location for the full 
6-week window. Use realistic retail pharmacy patterns:

- Spring Valley: 20–28 scripts/hour during peak hours 
  (triggers R113-24 2 RPh + 3 tech minimums at peak)
- Henderson: 13–18 scripts/hour (triggers 1-2 RPh, 2 tech minimums)
- North Las Vegas: 6–10 scripts/hour (lower minimum thresholds)

Volume data should follow realistic intraday curves (higher midday, 
lower at open/close) and realistic week patterns (busier 
Mon/Tue/Fri, quieter Wed/Sat).

---

## PART 3: RESET MECHANISM

Build a reset function that restores the demo tenant to its exact 
baseline seeded state. This should be invocable in two ways:

**1. Admin UI button**
In the application's admin or settings interface, add a 
"Restore Demo Data" button that is visible only to users on a 
demo-mode tenant (or a platform superadmin). It should require 
a confirmation step before executing. When confirmed, it runs 
the full reset and displays a success/failure result.

**2. Script**
The same reset logic should be available as a runnable script 
(npm run or similar) for command-line use during development.

**What reset does:**
- Deletes all schedule, compliance log, staff, and location data 
  for the Mesa Vista Pharmacy demo tenant
- Re-seeds it entirely from scratch using the same seed logic 
  from Part 2
- Recomputes all dates from current week Monday at time of reset — 
  so the schedule always appears current
- Preserves the org/tenant record itself and the demo admin email 
  setting (does not wipe tenant configuration, only data)
- Preserves any demo user accounts (Frank DiMaggio login) so 
  credentials do not change

---

## CONSTRAINTS AND STANDARDS

- Follow all existing patterns in the codebase. Do not introduce 
  new architectural patterns — use what is already there.
- Inspect the schema before writing any insert logic. Column names 
  and relationships in seed data must exactly match the schema.
- All fictional emails use @mesavistarx.com and will never be 
  contacted by the system.
- No real person is represented. All names, credentials, and 
  identifiers are invented.
- The seed script should be idempotent — running it twice should 
  not create duplicate data. Check for existing demo tenant before 
  inserting.
- Log clearly what was created when the seed runs.

---

## SUCCESS CRITERIA

When complete, the following should be true:

1. I can log in as frank@mesavistarx.com and see Mesa Vista Pharmacy 
   with three locations and a full populated schedule for the current 
   week plus history
2. The Henderson location shows a compliance alert on the dashboard 
   for Thursday 2–4 PM
3. The compliance log for Henderson shows two deficient hours this 
   week with the correct staffing detail
4. Scripts-per-hour data is visible and drives the ratio calculations 
   I can see in the schedule view
5. All staff appear with correct roles, cert status, and location 
   assignments
6. I can click "Restore Demo Data" in the admin UI and the tenant 
   resets to this exact baseline within a few seconds, with dates 
   re-anchored to today
7. No emails are sent to any @mesavistarx.com address at any point
8. The demo tenant does not appear in any billing, usage, or 
   production metrics
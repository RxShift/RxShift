# RxShift — Phase 2 Build Instructions
**For Claude Code** | June 2026 | Extends: CLAUDE.md

---

## Read This First

Before writing any code:
1. Read `CLAUDE.md` in the project root — stack, architecture, design tokens, what not to do
2. Read `Brand Items/DESIGN.md` — every color, font, spacing, and component spec
3. The site is already running with a homepage and basic structure. You are adding to it, not replacing it.

This file specifies four additions: a pricing page, Supabase lead capture, state-specific pages (Nevada live, CA and TN as stubs), nav updates, and a battle card comparison page. Ask no questions — execute from the spec. Where the spec is silent, use CLAUDE.md and the brand system.

---

## Business Context

RxShift is pre-launch, piloting in Nevada. These additions move the site from a credibility page to a conversion funnel:

- **Pricing page** → answers the "how much does it cost" question with a clean interactive calculator, shows the full feature set, captures intent
- **Lead capture → Supabase** → every form submission on the site stores a lead record for manual follow-up (no CRM yet — email notification + database row is sufficient)
- **Nevada state page** → primary SEO and sales page targeting Nevada pharmacies facing R113-24 compliance requirements
- **CA and TN state pages** → stubs that establish the "state-by-state" content pattern and signal multi-state coverage
- **Battle card** → SEO-indexed competitive comparison page for "RxShift vs When I Work" search intent

---

## Part 1: Pricing Page (`/pricing`)

### Business Outcome

A pharmacy manager arrives at `/pricing` and immediately sees what RxShift costs for their number of locations, in either monthly or annual billing. They should be able to see both price options simultaneously (no hidden states), understand what they get, and book a walkthrough. No Stripe integration — the CTA goes to the lead capture form.

### URL and Nav

Route: `/pricing`
Nav: Add "Pricing" link to main navigation between States dropdown and the CTA button.

### Pricing Logic

Three volume tiers, automatic (not user-selectable):

| Locations | Monthly (per location) | Annual (per location/yr) | Effective monthly |
|-----------|----------------------|--------------------------|-------------------|
| 1–4 | $199 | $1,990 | $166 |
| 5–9 | $169 | $1,690 | $141 |
| 10–25 | $149 | $1,490 | $124 |

Annual = exactly 10× monthly. "2 months free" framing. Volume tier is determined by location count input — no manual tier selection.

### Interactive Calculator Component

Build as a React component (`components/pricing-calculator.tsx`).

**Layout:**
- Location count input at top: label "How many locations?", number input, min=1 max=25, default=1, increment/decrement buttons on either side
- Below input: two price cards side by side (monthly | annual), always both visible simultaneously
  - **Monthly card** (default selected): large price display "$X/location/month", total below "Total: $X/month"
  - **Annual card**: large price display "$X/location/year", effective monthly below "~$X/month", amber "Save 2 months" badge in top-right corner of card
  - Selected card: amber border (#F07C30) 2px, slight shadow lift. Unselected: standard card border, full opacity — both prices are always legible
  - Clicking either card selects it (toggle behavior)
- Below cards: prominent total line — "Your total: $X/month" or "Your total: $X/year"
- If annual selected, show savings line: "You save $X/year compared to monthly"
- CTA button below total: "Schedule a Walkthrough" → scrolls to lead form or /#demo

**Pricing function:**
```typescript
function getPricing(locations: number) {
  const tier = locations >= 10 ? 'enterprise' : locations >= 5 ? 'growth' : 'standard';
  const monthly = { standard: 199, growth: 169, enterprise: 149 }[tier];
  const annual = { standard: 1990, growth: 1690, enterprise: 1490 }[tier];
  return {
    tier,
    monthly,
    annual,
    annualEffectiveMonthly: Math.round(annual / 12),
    annualSavingsVsMonthly: (monthly * 12 - annual),
    monthlyTotal: monthly * locations,
    annualTotal: annual * locations,
    annualTotalSavings: (monthly * 12 - annual) * locations,
  };
}
```

Show the tier name subtly (e.g., "Growth pricing" in small steel text) when a tier threshold is crossed, so the user understands why the price changed.

**Note on 25+ locations:** If user enters 26+, show: "For 26+ locations, contact us for custom pricing." → mailto:info@rxshift.io. Cap the input at 99 practically.

### What's Included Section

Below the calculator. Heading: "Everything included. One plan."

Subhead (Inter 400, 15px, steel): "RxShift doesn't have tiers, add-ons, or compliance features locked behind a higher plan. Every pharmacy gets the full product."

Four-column feature checklist on desktop, 2-column on tablet, 1-column mobile.

**Column 1 — Scheduling**
- Schedule generation
- Shift coverage management
- Time-off request handling
- Staff availability tracking
- Pharmacist + tech + trainee role management

**Column 2 — Compliance Engine**
- State ratio rules configuration
- Real-time pharmacist-to-tech ratio enforcement
- Certified vs. non-certified tech tracking
- Trainee and intern supervision limit tracking
- Scripts-per-hour volume input

**Column 3 — Documentation**
- Automated hourly compliance log
- Deficiency flagging (per hour)
- 3-consecutive-day deficiency alerts
- Board notification triggers
- 2-year record retention
- Compliance export (board-ready format)

**Column 4 — Management**
- Multi-location management (up to 25 locations)
- Staff directory with cert expiration tracking
- Location-level reporting
- Admin controls

**Coming Soon row** (full-width, below columns, grey/cloud background strip, Space Grotesk 600 13px steel):
"On the roadmap: PMS data import · Float pool scheduling · Volume forecasting · Additional state configurations"

### Page Copy

**Eyebrow (amber uppercase):** PRICING

**H1 (Space Grotesk 700, 36px navy):**
```
Simple pricing for pharmacies of any size.
No setup fees. No compliance add-ons.
```

**Subhead (Inter 400, 18px steel):**
```
Per-location pricing that scales with your operation.
Everything is included at every tier.
```

[Calculator component]

[What's Included section]

**Bottom CTA section (cloud bg, py 64px, centered):**

Heading: "Ready to see it working?"
Body: "We'll walk through your current scheduling process and show you how RxShift handles ratios, documentation, and compliance. About 20 minutes."
Button: "Schedule a Walkthrough" → /#demo or /pricing#demo-form
Subtext: "Currently piloting in Nevada. Pilot pricing available for early participants."

---

## Part 2: Lead Capture — Supabase Integration

### Business Outcome

When a user submits any "Schedule a Walkthrough" form on the site (homepage, pricing page, Nevada page, state pages), two things happen:

1. A lead record is written to a Supabase `leads` table
2. A notification email is sent via Resend to `info@rxshift.io` with the submission details

No CRM. No redirect to an external tool. The response to the user is a confirmation message inline (replace form with "Thanks — we'll be in touch within one business day.").

### What to Build

**Design and create the `leads` Supabase table.** Use your best judgment on schema — capture what a sales person following up manually would need: name, pharmacy name, state, email, optional message, source page (which page the form was submitted from), and standard timestamps. Add any fields that make operational sense. Use UUIDs for primary keys.

**API route:** `app/api/contact/route.ts` (may already exist — extend it or replace it)

The route should:
- Validate required fields (name, pharmacy, state, email)
- Insert to Supabase `leads` table
- Send Resend notification to `info@rxshift.io` with formatted lead details
- Return `{ success: true }` or an error

**Form component:** `components/contact-form.tsx` — a reusable component used on multiple pages. Accept a `source` prop (string) that gets passed to the API to populate the `source_page` field. Existing form instances on homepage should be updated to use this component if they aren't already.

**Resend notification email format:**
```
Subject: New Demo Request — [Pharmacy Name] ([State])

Name: [name]
Pharmacy: [pharmacy]
State: [state]
Email: [email]
Message: [message or "(none)"]
Source: [source_page]
Submitted: [timestamp]

Reply directly to this email to respond.
```

Set `replyTo` to the submitter's email address.

**Environment variables needed:**
```
RESEND_API_KEY=          # already configured
CONTACT_TO_EMAIL=info@rxshift.io
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # for server-side inserts
```

---

## Part 3: Nevada State Page (`/nevada`)

### Business Outcome

A Nevada pharmacy manager — arriving from Google, from a direct link in an email, or from the nav — lands on a page that demonstrates RxShift knows Nevada's specific regulatory situation in detail. The page should rank for "Nevada pharmacy staffing compliance," "R113-24 pharmacy," and related terms. The CTA is to schedule a walkthrough.

### SEO

Page title: `Nevada Pharmacy Compliance Scheduling | RxShift`
Meta description: `RxShift automates the hourly compliance documentation Nevada's proposed R113-24 requires. Built for Nevada pharmacies. Currently piloting in Las Vegas.`

### Page Layout

Same nav and footer as the rest of the site. No sidebar.
Source prop for lead form: `"nevada-page"`

### Full Copy

---

**Eyebrow (amber uppercase):** NEVADA PHARMACIES

**H1:**
```
Nevada's proposed staffing rule requires
daily documentation software.
RxShift generates it automatically.
```

**Subhead:**
```
Proposed rule R113-24 creates a daily documentation burden that
spreadsheets and generic scheduling tools cannot meet.
RxShift was built for exactly this.
```

CTA button: "Schedule a Walkthrough" → #demo-form on this page

---

**Section: What R113-24 requires**

Eyebrow: THE RULE

Heading: The documentation requirement is the issue.

Body:
```
Nevada's Board of Pharmacy has been advancing minimum staffing rules
that go beyond ratio compliance. Under proposed R113-24, the managing
pharmacist must:
```

Styled requirement list (not a plain bullet list — use brand status-badge style cards or a visually distinct block):
- Maintain **hourly documentation** naming each pharmacist and technician on duty
- **Log every deficient hour** when staffing falls below required minimums
- **Retain those records for two years**
- **Notify the Board** after three consecutive days of deficient staffing

Body continuation:
```
This isn't a quarterly audit requirement. It's a daily operational burden —
one that creates new administrative work on every shift, every day your
pharmacy is open. A managing pharmacist running two shifts a day at a busy
retail location is looking at 14 hourly log entries before the week is out.
```

---

**Section: Current ratio rules + R113-24 additions**

Eyebrow: THE RULES

Heading: Nevada's staffing requirements, current and proposed.

Render as a styled comparison table (use brand data table styles from DESIGN.md):

| | Current (NAC 639.250) | Proposed R113-24 |
|---|---|---|
| Base ratio (non-hospital) | 1 RPh : 3 techs max | Retained |
| With trainees | 1 tech + 2 trainees max | 1 tech + 2 trainees max |
| Volume minimum — pharmacists | None | 2 RPhs at 20+ scripts/hr; +1 per additional 20/hr |
| Volume minimum — techs | None | 1 tech at 5–9 scripts/hr; 2 at 10–19; 3 at 20+; +1 per additional 20/hr |
| Hourly documentation | Not required | Required — every shift |
| Record retention | Not specified | 2 years |
| Board notification | Not required | After 3 consecutive deficient days |

Below table (Inter 400, 13px, steel):
```
Source: NRS 639.1371, NAC 639.250, Proposed R113-24.
R113-24 was noticed for hearing in 2025 and remains in active rulemaking.
RxShift handles both the current rules and the proposed additions.
When R113-24 is adopted, nothing in your workflow changes.
```

---

**Section: Why generic tools fail here**

Eyebrow: THE PROBLEM

Heading: A schedule is not a compliance record.

Body:
```
Generic scheduling tools track who's on shift. They don't know your
pharmacist-to-tech ratio, whether your Tuesday tech is certified or
non-certified, or that Nevada's supervision cap differs between hospital
and non-hospital settings.

R113-24 doesn't ask for a schedule. It asks for a compliance record —
a timestamped hourly log that accounts for every position, every hour,
and every deficiency. Building that manually adds meaningful administrative
time to every shift.

When a board inspector requests documentation, "we use When I Work"
is not an answer.
```

---

**Section: How RxShift handles it**

Eyebrow: THE SOLUTION

Heading (navy, 28px): When you publish a schedule, the compliance log is already written.

Three-column feature grid (use same card styles as homepage features section):

**Card 1 — Eyebrow: RATIO ENGINE**
Heading: Every shift, every rule applied.
Body: RxShift applies Nevada's pharmacist-to-tech ratio rules to every schedule you build — accounting for certified, non-certified, trainee, and intern counts separately, because NAC 639 requires it.

**Card 2 — Eyebrow: HOURLY LOG**
Heading: The R113-24 record, auto-generated.
Body: Every published schedule produces a timestamped hourly record: pharmacist and tech names per hour, deficiency flags when coverage falls short, and automatic board-report triggers after three consecutive deficient days. Retained for two years, exportable on demand.

**Card 3 — Eyebrow: ZERO EXTRA WORK**
Heading: Nothing new to do after you schedule.
Body: The compliance documentation comes out of the schedule you were already building. No separate logging. No end-of-day forms. No spreadsheet to fill in. Publish the schedule — the record exists.

---

**Section: Pilot**

Full-width navy background section.

Heading (white): Currently piloting with Nevada pharmacies.

Body (rgba white 0.8):
```
RxShift is actively piloting with Optum-affiliated and independent
pharmacies in the Las Vegas area. Nevada pharmacies that join during
the pilot period receive early access pricing.
```

---

**Lead capture form section** (id="demo-form")

Heading: See it working in your pharmacy.
Body: We'll walk through your current scheduling process and show you how RxShift handles Nevada's requirements. About 20 minutes.

Use the shared `ContactForm` component with `source="nevada-page"`.

---

## Part 4: California State Page (`/states/california`) — Stub

### Business Outcome

Establishes RxShift's California presence for SEO. Signals the state-by-state content pattern. Provides enough accurate regulatory content to be useful, not just a placeholder.

### SEO

Page title: `California Pharmacy Ratio Compliance Scheduling | RxShift`
Meta description: `California's pharmacist-to-tech ratio rules are complex. RxShift applies BPC 4115 automatically and documents your staffing decisions.`

### Full Copy

**Eyebrow:** CALIFORNIA PHARMACIES

**H1:**
```
California's ratio rules are more complex than most states.
RxShift handles the math automatically.
```

**Subhead:**
```
Under BPC 4115, each additional pharmacist on duty changes your
supervision capacity. RxShift tracks this in real time so you're
always operating within California's rules.
```

---

**Section: California's ratio framework**

Eyebrow: THE RULES

Heading: How California's pharmacist-to-tech ratios work.

Body:
```
California's ratio system is additive, not flat. Under Business and
Professions Code 4115:
```

Styled list (same visual treatment as Nevada requirement blocks):
- The first pharmacist on duty may supervise up to **1 technician**
- Each additional pharmacist adds supervision capacity for **2 more technicians**
- Clerical staff are exempt from ratio calculations
- AB 1503 allows the pharmacist in charge to set staffing levels within these limits — but the rules still apply

Body continuation:
```
In practice, this means your ratio changes with every pharmacist on the
schedule. A shift with two pharmacists allows up to 3 technicians.
Three pharmacists allows up to 5. RxShift recalculates this automatically
as you build the schedule.
```

---

**Section: What documentation matters in California**

Body:
```
California doesn't currently impose the same hourly documentation
requirements Nevada is moving toward. But California boards can and
do conduct compliance audits — and pharmacies that can demonstrate
documented, ratio-compliant scheduling are in a significantly better
position when they do.

RxShift produces that documentation as a natural output of your
published schedule.
```

---

**Lead form section** (same component, `source="california-page"`)

Heading: Managing a California pharmacy?
Body: We'd like to understand your scheduling workflow. Schedule a 20-minute conversation.

---

## Part 5: Tennessee State Page (`/states/tennessee`) — Stub

### Business Outcome

Same as California — establishes the state pattern, provides accurate regulatory content, SEO-indexable.

### SEO

Page title: `Tennessee Pharmacy Ratio Compliance Scheduling | RxShift`
Meta description: `Tennessee requires 1:2 base pharmacist-to-tech ratios, expandable with certified techs. RxShift tracks certification mix and enforces the right ratio automatically.`

### Full Copy

**Eyebrow:** TENNESSEE PHARMACIES

**H1:**
```
Tennessee's ratio rules depend on your tech certification mix.
RxShift tracks it automatically.
```

**Subhead:**
```
A base 1:2 ratio expands to 1:4 when your technicians are board-certified.
RxShift knows the difference and applies the right rule to every shift.
```

---

**Section: Tennessee's ratio framework**

Eyebrow: THE RULES

Heading: How Tennessee's pharmacist-to-tech ratios work.

Styled list:
- Base ratio: **1 pharmacist to 2 technicians**
- With board-certified technicians: expandable to **1 pharmacist to 4 technicians** (board approval required)
- Mix matters: if your shift has both certified and non-certified techs, the lower ratio applies

Body:
```
Tennessee's ratio system means your compliance posture can change
shift to shift based on which technicians are scheduled. A shift where
your certified techs have the day off may require an additional
pharmacist to stay compliant.

RxShift tracks each staff member's certification status and applies
the correct ratio rule automatically when you build the schedule.
A non-compliant shift is flagged before it's published.
```

---

**Lead form section** (`source="tennessee-page"`)

Heading: Managing a Tennessee pharmacy?
Body: We'd like to understand your scheduling workflow. Schedule a 20-minute conversation.

---

## Part 6: Nav Updates

### States Dropdown

Add a "States" dropdown to the main nav, positioned between the logo and the "Pricing" link.

```
Nav order (left to right):
[Logo + wordmark] — [States ▾] — [Pricing] — [Schedule a Walkthrough button] — [Log in]
```

**States dropdown contents:**

```
States
├── Nevada          → /nevada
├── California      → /states/california  (small "Coming Soon" badge in amber)
└── Tennessee       → /states/tennessee   (small "Coming Soon" badge in amber)
```

"Coming Soon" badge: Space Grotesk 700, 9px, amber, bg=rgba(amber,0.12), px=6 py=2, radius=4px.

Nevada links are fully active. California and Tennessee pages exist and are accessible — the badge signals content is being actively developed, not that the page is broken. All three are real routes.

Dropdown style: white background, 1px #DDE5EF border, shadow-dropdown, radius=8px. Hover state on items: bg=#F2F5FA (cloud). Active/current page item: navy text bold.

Mobile: States expands inline in the hamburger menu as a nested list.

**Note on URL structure:** California and Tennessee are at `/states/[slug]` to establish the pattern. Nevada is at `/nevada` for backward compatibility with any existing links. Add a redirect from `/states/nevada` to `/nevada` to keep both paths working.

---

## Part 7: Battle Card (`/vs/when-i-work`)

### Business Outcome

SEO-indexed competitive comparison page targeting users researching "RxShift vs When I Work" or evaluating both products. The page establishes that When I Work is a general scheduling tool and RxShift is a pharmacy compliance product — different categories, not just a feature gap.

### SEO

Page title: `RxShift vs. When I Work — Pharmacy Compliance Scheduling Comparison`
Meta description: `When I Work handles the calendar. RxShift handles the compliance. See how they compare for pharmacy scheduling, ratio enforcement, and documentation.`

### Nav / Footer Placement

**Not in main nav.** Add to footer under a "Resources" column:
```
Footer columns:
Product: [Features] [Pricing] [States ▾]
Resources: [RxShift vs. When I Work]
Company: [info@rxshift.io]
```

Also add a subtle internal link on the pricing page, below the pricing calculator:
"See how RxShift compares to generic scheduling tools →" linked to `/vs/when-i-work`

### Page Layout

Same nav + footer. Max-width 900px on desktop.

### Full Copy

---

**Eyebrow (amber uppercase):** RXSHIFT VS. WHEN I WORK

**H1:**
```
When I Work handles the calendar.
RxShift handles the compliance.
```

**Subhead:**
```
When I Work is a general-purpose scheduling tool built for restaurants,
retail, and service businesses. It does not know your state's
pharmacist-to-tech ratio rules, and it does not produce the compliance
documentation your board may require. RxShift does both.
```

---

**Comparison Table**

Full-width table, uses brand data table styles from DESIGN.md.

| Feature | RxShift | When I Work |
|---|---|---|
| **Built for pharmacy** | ✓ Pharmacy-specific | ✗ General workforce |
| **State ratio rules engine** | ✓ Configurable per state | ✗ Not available |
| **Real-time ratio enforcement** | ✓ Enforced during scheduling | ✗ |
| **Certified vs. non-certified tech tracking** | ✓ | ✗ |
| **Trainee supervision limit tracking** | ✓ | ✗ |
| **Hourly compliance log generation** | ✓ Auto-generated from schedule | ✗ |
| **Deficiency flagging per hour** | ✓ | ✗ |
| **3-day consecutive deficiency alert** | ✓ | ✗ |
| **Board notification trigger** | ✓ | ✗ |
| **2-year record retention** | ✓ | ✗ |
| **Nevada R113-24 documentation** | ✓ | ✗ |
| **Basic schedule building** | ✓ | ✓ |
| **Time-off requests** | ✓ | ✓ |
| **Staff management** | ✓ | ✓ |
| **Designed for 1–25 locations** | ✓ | ✓ |
| **Pharmacy-specific support** | ✓ | ✗ |

Table column header styling: RxShift header in navy with amber accent. When I Work header in standard steel.
✓ cells: #2E7D5E (compliant green). ✗ cells: #C0392B (deficiency red). Use colored text not icons if icon support is complex.

---

**Section: The right tool for the right job**

Eyebrow: THE DIFFERENCE

Heading: General scheduling is not compliance scheduling.

Body:
```
When I Work is a good product for businesses where scheduling is purely
a logistics problem. For restaurants, retail stores, and service
businesses with no regulatory requirements, it does the job well.

Pharmacy isn't that category. Your state likely requires documented
proof that every shift ran at the right pharmacist-to-tech ratio.
Some states are moving toward daily hourly logging. When that
documentation doesn't exist, the exposure sits with your managing
pharmacist personally — not your software vendor.

RxShift wasn't built to compete with When I Work on general scheduling
features. It was built to close the compliance gap that general
scheduling tools cannot fill.
```

---

**Section: If you're already using When I Work**

Eyebrow: SWITCHING

Heading: The transition is straightforward.

Body:
```
RxShift handles schedule generation, time-off requests, and staff
availability — everything When I Work does for your pharmacy — plus
the compliance layer it doesn't.

Your staff learns one tool. Your managing pharmacist stops maintaining
a separate spreadsheet for documentation. Your compliance record
generates itself.
```

---

**Lead form section** (`source="vs-when-i-work"`)

Heading (navy): See the compliance layer working.
Body: We'll walk through your current scheduling process and show you what RxShift adds. About 20 minutes.

CTA button: "Schedule a Walkthrough"

---

## Part 8: Internal Linking Summary

Changes to make across existing pages:

**Homepage footer:** Add Resources column with "RxShift vs. When I Work" link.

**Pricing page:** Add link below calculator: "See how RxShift compares to general scheduling tools →" → `/vs/when-i-work`

**Nevada page:** In the "why generic tools fail" section, the phrase "When I Work" can be linked to `/vs/when-i-work`.

**Main nav:** "Pricing" link added. "States" dropdown added. These are the only nav changes.

---

## Design Constraints (do not violate)

These override any default framework styling or component library defaults:

- **Colors:** Only values from `Brand Items/DESIGN.md`. No Tailwind default blues, grays, or greens.
- **Fonts:** Space Grotesk (brand) and Inter (body) only. Load via `next/font/google`.
- **Buttons:** Primary = amber (#F07C30) bg, white text, Space Grotesk 700 14px, radius 6px. No Tailwind `btn-primary` unless it matches this exactly.
- **Status/comparison indicators:** ✓ = #2E7D5E. ✗ = #C0392B. Never use Tailwind green/red defaults.
- **Section backgrounds follow the visual rhythm from CLAUDE.md:** white → cloud → navy → white → navy (footer). Don't break the rhythm on new pages.
- **No generic SaaS language:** "Powerful," "seamless," "AI-powered," "next-generation," "game-changing" — none of these appear anywhere on the site.
- **No stock photography.** No images of pharmacists, pills, white coats, or lab settings.
- **The Schedule Grid mark is always pure geometry.** Never add a container, badge, or shadow to it.
- **Brand name is always `RxShift`:** capital R, lowercase x, capital S. One word.

---

## Deferred (do not build yet)

- Interactive demo embed on homepage — depends on a demo tenant being built first
- Additional state pages beyond Nevada, California, Tennessee
- Stripe / Chargebee payment integration
- CRM integration (HubSpot or similar)
- `/vs/schedule360` or additional battle cards

---

*Reference `CLAUDE.md` for stack, API route patterns, environment variables, and local dev setup.*
*Reference `Brand Items/DESIGN.md` for all visual decisions.*

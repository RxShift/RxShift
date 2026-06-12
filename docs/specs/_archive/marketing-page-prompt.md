# RxShift — Build Specification
**For Claude Code** | Last updated: June 2026 | Repo: github@rxshift.io

This file tells Claude Code what to build, how to build it, and why every decision was made.
Read it fully before writing any code.

---

## What This Is

RxShift is a B2B SaaS product for pharmacy workforce scheduling with built-in state ratio
compliance and hourly documentation. It replaces Excel for independent and regional pharmacies
(1–25 locations). This is a pre-launch product with a working pilot at an Optum-affiliated
pharmacy in Las Vegas, Nevada.

This repo contains both the marketing website (rxshift.io) and the application
(app.rxshift.io) in a single Next.js deployment.

**Current build task:** The marketing homepage at rxshift.io. The app is not yet built.

---

## Architecture & Stack

```
rxshift.io           → marketing site (Next.js, this repo, root routes)
app.rxshift.io       → application (Next.js, this repo, /app routes or separate later)
```

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | Next.js 14+ | App Router. TypeScript throughout. |
| Styling | Tailwind CSS | Use CSS custom properties from DESIGN.md for brand tokens. |
| Fonts | Space Grotesk + Inter | Load via next/font/google. See DESIGN.md for weights. |
| Email | Resend | API key in env. Sending domain: rxshift.io. Already verified. |
| Database | Supabase | Postgres. Not needed for homepage build. |
| DNS/Domain | Cloudflare | Already configured. |
| Hosting | Vercel | Pending account auth. Dev locally on localhost:3000 for now. |

### Environment Variables (create .env.local)
```
RESEND_API_KEY=         # from Resend dashboard (resend@rxshift.io account)
CONTACT_TO_EMAIL=info@rxshift.io
```

---

## Design System

The full design system lives in `Brand Items/`. Read `Brand Items/DESIGN.md` before
writing any component. Do not invent colors, fonts, or spacing — everything is specified.

**Quick reference (do not use values not in DESIGN.md):**
```css
--color-navy:   #1C2F5E   /* primary brand, headlines, nav */
--color-amber:  #F07C30   /* CTA buttons, active states, accents */
--color-steel:  #4A5B7A   /* secondary text, labels */
--color-cloud:  #F2F5FA   /* section backgrounds */
--color-border: #DDE5EF   /* dividers, card borders */
--color-bg:     #F8FAFC   /* page background */

Brand font:  Space Grotesk (weights 500, 700, 800)
Body font:   Inter (weights 400, 500)
```

**Logo files:** Use SVGs from `Brand Items/`. For the nav, use
`rxshift-horizontal-light.svg` (or inline SVG equivalent). Never use a badge or
container shape around the grid mark — it stands alone.

**Primary button:** bg=#F07C30, text=white, Space Grotesk 700 14px, radius=6px, px=20 py=10.
Hover: bg=#D96A22.

---

## File Structure to Build

```
/
├── app/
│   ├── layout.tsx              ← root layout, fonts, metadata, global CSS
│   ├── page.tsx                ← homepage (assembles section components)
│   ├── pricing/
│   │   └── page.tsx            ← pricing stub (minimal, see spec below)
│   ├── features/
│   │   └── page.tsx            ← features stub (minimal, see spec below)
│   └── api/
│       └── contact/
│           └── route.ts        ← Resend contact form handler
├── components/
│   ├── nav.tsx                 ← top navigation
│   ├── hero.tsx                ← hero section
│   ├── problem.tsx             ← problem section (no header)
│   ├── features.tsx            ← 3-column features grid
│   ├── nevada-callout.tsx      ← R113-24 specific callout (navy bg)
│   ├── works-everywhere.tsx    ← no-ratio states pitch
│   ├── pricing-signal.tsx      ← pricing/size signal section
│   ├── contact-form.tsx        ← demo request form (Resend-powered)
│   ├── footer.tsx              ← minimal footer
│   └── rxshift-mark.tsx        ← inline SVG of the schedule grid mark
├── public/
│   └── brand/                  ← copy Brand Items/ SVGs here for public access
├── Brand Items/                ← brand assets (source of truth)
├── DESIGN.md                   ← design system (symlink or copy of Brand Items/DESIGN.md)
├── CLAUDE.md                   ← this file
├── .env.local                  ← environment variables (never commit)
└── [standard Next.js config]
```

---

## Contact Form API Route

File: `app/api/contact/route.ts`

```typescript
import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { name, pharmacy, state, email, message } = await request.json();

    if (!name || !pharmacy || !state || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    await resend.emails.send({
      from: 'RxShift <noreply@rxshift.io>',
      to: process.env.CONTACT_TO_EMAIL || 'info@rxshift.io',
      replyTo: email,
      subject: `Demo Request: ${pharmacy} — ${state}`,
      html: `
        <h2>New Demo Request</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Pharmacy:</strong> ${pharmacy}</p>
        <p><strong>State:</strong> ${state}</p>
        <p><strong>Email:</strong> ${email}</p>
        ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
```

Install Resend: `npm install resend`

---

## Homepage — Complete Section Spec

The homepage has one job: when a Nevada pharmacy owner or manager lands here
(typically via referral), they leave believing RxShift is a real, established,
pharmacy-specific product — and they schedule a demo.

**Visual rhythm:** white → white → **navy** (Nevada callout) → cloud → **amber/navy** (CTA)
→ navy (footer). This creates clear visual breaks and gives the navy sections authority.

---

### 1. Nav

```
Layout:    full-width, white bg, border-bottom 1px #DDE5EF, height 64px, px 24-32px
Left:      RxShift mark + wordmark (inline SVG, links to /)
Right:     "Log in" link (Inter 500 14px #4A5B7A, links to https://app.rxshift.io,
           mr-4) then "Schedule a Demo" button (primary amber, links to #demo anchor)
Mobile:    hamburger menu, "Log in" link + CTA button
```

The "Log in" link points to app.rxshift.io even though the app is not yet built.
This is intentional — it signals an established product. When the app exists, the
link will work. Until then it can show a simple "Coming soon" page or redirect back.

No other nav items. The homepage is single-page with anchor links.

---

### 2. Hero

```
Layout:    centered, max-width 720px, py 96px on desktop, py 64px mobile
Background: #F8FAFC (page bg)
```

**Headline (H1, Space Grotesk 700, 48px desktop / 36px mobile, #1C2F5E):**
```
Your schedule knows the ratios.
So you don't have to.
```

**Subhead (Inter 400, 18px, #4A5B7A, max-width 540px, line-height 1.7):**
```
RxShift generates compliant pharmacy schedules automatically — tracking
pharmacist-to-tech ratios, producing the hourly documentation regulators
require, and handling the staffing math that spreadsheets get wrong.
```

**CTA:**
- Primary button: "Schedule a Demo" → scrolls to #demo
- Below button, small text (Inter 13px, #4A5B7A):
  "Piloting now with Nevada pharmacies."

---

### 3. Problem (no section header — prose strip)

```
Layout:    full-width, white bg, py 48px, centered, max-width 680px
Style:     three short statements, each on its own line with subtle visual
           separation. Space Grotesk 500 18px #1C2F5E. Not a bulleted list —
           treat as three short paragraphs or a styled prose block.
```

**Copy:**
```
Pharmacy scheduling isn't like other scheduling. Your state has ratio rules.
Those ratios depend on whether your techs are certified, non-certified,
or trainees — and the math changes when volumes shift.

Generic scheduling tools don't know any of this. Excel doesn't flag when
you're about to run a shift one tech short of compliant.

RxShift does.
```

---

### 4. Features (3-column grid)

```
Layout:    3 equal columns, white bg, py 80px, gap 32px, max-width 1040px centered
Cards:     bg=white, border=1px #DDE5EF, radius=10px, shadow=--shadow-card, p=28px
Mobile:    stack to 1 column
```

Each card:
- Eyebrow label (Space Grotesk 700, 10px, #F07C30, UPPERCASE, letter-spacing 1.8px)
- Heading (Space Grotesk 700, 18px, #1C2F5E, mb 8px)
- Body copy (Inter 400, 14px, #4A5B7A, line-height 1.65)

**Feature 1 — Eyebrow: SCHEDULING**
```
Heading: Ratio-aware schedule generation
Body:    Configure your state's pharmacist-to-tech rules once.
         RxShift applies them to every shift — accounting for certified,
         non-certified, trainee, and intern staffing in real time.
         When volume or composition changes, coverage recalculates automatically.
```

**Feature 2 — Eyebrow: COMPLIANCE**
```
Heading: Automated hourly compliance logs
Body:    Every published schedule produces a timestamped record:
         pharmacist and tech names per hour, deficiency flags,
         and automatic board-report triggers after 3 consecutive
         deficient days. Retained for two years, exportable on demand.
```

**Feature 3 — Eyebrow: BUILT FOR YOUR SIZE**
```
Heading: Designed for 1–25 locations
Body:    Not enterprise software. Not a generic scheduling tool
         with compliance bolted on. RxShift is built for independent
         pharmacies and regional chains — up and running in under an
         hour, with no implementation fee and no six-month onboarding.
```

---

### 5. Nevada Callout (the wedge — most important section)

```
Layout:    full-width, bg=#1C2F5E (navy), py 80px, text centered, max-width 720px
Eyebrow:   Space Grotesk 700, 10px, #F07C30, UPPERCASE, letter-spacing 1.8px
Heading:   Space Grotesk 700, 32px, white
Body:      Inter 400, 16px, rgba(255,255,255,0.8), line-height 1.7
Box:       a slightly lighter navy inset box (#243F7A or rgba(white,0.06))
           containing the documentation requirement verbatim
CTA text:  amber-colored link or button
```

**Eyebrow:** IF YOU'RE IN NEVADA, THIS MATTERS NOW

**Heading:**
```
Proposed rule R113-24 changes everything
about pharmacy staffing documentation.
```

**Body:**
```
Nevada's Board of Pharmacy has been advancing minimum staffing rules
that would require managing pharmacists to maintain hourly documentation
of every pharmacist and technician on duty — every shift, every day.
```

**Inset requirement box (Inter 500, 14px, white, bg=rgba(white,0.06), p=20px, radius=8px):**
```
Under proposed R113-24:
• Hourly record naming each pharmacist and technician on duty
• Every deficient hour logged
• Records retained for 2 years
• Board notification required after 3 consecutive deficient days
```

**Continuation body:**
```
RxShift generates that record automatically from every published schedule.
No extra steps. No new forms. Done before the shift starts.
```

**Bottom CTA text** (Inter 500, 14px, rgba(white,0.6)):
```
Currently piloting with Nevada pharmacies. Questions about how R113-24
affects your operation?
```
→ "Schedule a demo" link (amber color, underline on hover, scrolls to #demo)

---

### 6. Works Everywhere

```
Layout:    full-width, bg=#F2F5FA (cloud), py 72px, max-width 720px centered
```

**Eyebrow (amber, uppercase):** ALL 50 STATES

**Heading (Space Grotesk 700, 28px, navy):**
```
Most states don't have fixed ratios.
Every state expects documented judgment.
```

**Body (Inter 400, 16px, steel):**
```
In states without hard ratio rules, pharmacy boards still expect
pharmacists in charge to document that staffing decisions were made
professionally — and to defend them if challenged.

RxShift produces that record too. Whether you're navigating Nevada's
ratios or Arizona's professional-judgment standard, your staffing
decisions are documented, timestamped, and exportable.
```

**Three stat-style callouts (inline, flex, centered):**
```
~24 states          ~18 states          All states
No fixed ratio      Hard ratio rules    Documentation matters
```
Style: Space Grotesk 700 28px #1C2F5E for the number/stat,
       Inter 400 12px #4A5B7A for the label below.

---

### 7. Pricing Signal

```
Layout:    white bg, py 72px, max-width 680px centered
```

**Eyebrow (amber):** PRICING

**Heading (Space Grotesk 700, 28px, navy):**
```
Built for your size.
Not enterprise software.
```

**Body (Inter 400, 16px, steel):**
```
RxShift is priced per location, per month — with no setup fee and no
long-term contract required to get started. Volume pricing is available
for groups of 5+ locations.
```

**Comparison block (Inter 500, 15px, steel, py 24px, border-top + border-bottom 1px #DDE5EF):**
```
When I Work doesn't know your state's ratio rules.
Legion's implementation alone runs five to fifty thousand dollars.
RxShift is built specifically for pharmacies your size — without the enterprise price tag.
```

**Pilot note (Inter 400, 13px, #D4860A — alert amber, warm not alarming):**
```
We're currently piloting with Nevada pharmacies.
Pilot participants receive early pricing. Talk to us before rates are published.
```

**Link:** "See pricing details →" → /pricing (the stub page)

---

### 8. Demo CTA Section (id="demo")

```
Layout:    full-width, bg=#1C2F5E (navy), py 96px, max-width 560px centered
```

**Heading (Space Grotesk 700, 32px, white):**
```
See RxShift working in your pharmacy.
```

**Subhead (Inter 400, 16px, rgba(white,0.7)):**
```
We'll walk through your current scheduling process and show you
how RxShift handles it — ratios, documentation, and all.
About 20 minutes.
```

**Form (bg=rgba(white,0.06), p=32px, radius=12px, mt=32px):**

Fields (labels: Space Grotesk 700 11px UPPERCASE #F07C30, inputs: standard brand style):
- First name (required)
- Pharmacy name (required)
- State (required — text input or select with US states)
- Email (required)
- Message (optional, placeholder: "Anything specific you'd like to see?", textarea)

Submit button: full-width, primary amber style, label: "Schedule a Demo"

**Success state (replace form after submit):**
```
Thanks, [first name]. We'll be in touch within one business day.
```
Style: white text, centered, Space Grotesk 600 18px

**Error state:** "Something went wrong. Email us directly at info@rxshift.io"

---

### 9. Footer

```
Layout:    bg=#1C2F5E (navy), py 32px, px 24-32px
Style:     flex, space-between on desktop, stack on mobile
```

**Left:** RxShift mark (inline SVG, dark variant, small — ~60px wide)

**Center (or below mark on mobile):**
```
Compliance-ready pharmacy scheduling
```
Inter 400, 13px, rgba(white,0.5)

**Right:**
```
Log in  ·  © 2026 RxShift  ·  rxshift.io  ·  info@rxshift.io
```
Inter 400, 13px, rgba(white,0.4)
"Log in" links to https://app.rxshift.io — same as nav, same intent signal.

---

### 10. Pricing Page Stub (/pricing)

Very minimal. Shows the same nav + footer. Content:

**Heading:** Pricing for 1–25 locations.

**Body:**
```
RxShift is priced per location, per month. Volume pricing available
for groups of 5+ locations.

We're currently in pilot with Nevada pharmacies. Pilot participants
receive early pricing.

Talk to us about your specific setup.
```

**CTA button:** "Schedule a Demo" → goes to rxshift.io/#demo

---

### 11. Features Page Stub (/features)

Very minimal. Same nav + footer. Content:

**Eyebrow (amber):** HOW IT WORKS

**Heading:** Everything your pharmacy schedule needs to be compliant.

**Three short sections (not cards — just headed paragraphs, max-width 680px):**

**Ratio-aware scheduling**
RxShift applies your state's pharmacist-to-tech ratio rules to every shift as you
build it. Certified, non-certified, trainee, and intern counts are tracked separately
because the math is different for each — and most states require it.

**Automated compliance documentation**
Every published schedule produces a timestamped hourly log: the pharmacist and each
technician on duty per hour, deficiency flags when coverage falls short, and automatic
notification triggers for extended deficiencies. Records are retained for two years and
exportable on demand.

**Designed for small groups, not enterprises**
No implementation project. No dedicated IT. RxShift is configured for your locations,
your state rules, and your staff in under an hour. Pricing is per location per month —
not per employee, not per feature tier.

**CTA button:** "See it working — Schedule a Demo" → rxshift.io/#demo

**Note at bottom** (Inter 400, 13px, steel):
"Have a specific workflow question? Email us at info@rxshift.io"

---

## The RxShift Mark Component

Build `components/rxshift-mark.tsx` as an inline SVG component so it renders
without an img tag (better for nav/footer). Accept props for `size` (default 109×80)
and `variant` ("light" | "dark", default "light").

```
Light variant:  col1/4=#C4D2E2, col2=#8FAABB, col3=#F07C30 (amber)
Dark variant:   col1/4=#3B5785, col2=#557AB0, col3=#F07C30 (amber)
```

Grid: 4 cols × 3 rows, cells 22×22px, gap 7px, corner-radius 4px.
Full dimensions: 109×80px. Scale proportionally via size prop.

---

## What NOT to Do

- **No stock photography.** No images of pharmacists, pills, mortars, white coats, or lab settings. The brand voice is data and scheduling, not healthcare imagery.
- **No "AI-powered" language.** Never use "AI-powered", "intelligent", "smart", or "revolutionary." Describe what the product does specifically.
- **No startup language.** No "we're excited to introduce", "game-changing", "seamless", or "unlock." Write like an established pharmacy software company.
- **No gradients on the logo.** The grid mark is flat color only.
- **No hero illustration.** The page doesn't need a product screenshot in the hero — the copy carries it. If you want a visual element in the hero, use a subtle grid-pattern background or a clean geometric abstraction.
- **No emoji.** Anywhere on the page.
- **Do not use a mailto link for the CTA.** Use the Resend-powered contact form at #demo.
- **Do not invent colors.** Use only values from DESIGN.md.
- **Do not skip the Nevada callout section.** It is the most important section on the page.

---

## Responsive Behavior

| Breakpoint | Notes |
|------------|-------|
| Mobile (<640px) | Single column throughout. Hero headline 36px. Feature cards stacked. Reduce section padding to 48px. |
| Tablet (640–1024px) | 2-column features, full nav. |
| Desktop (>1024px) | 3-column features, centered max-widths throughout. |

---

## Local Dev

```bash
npm install
cp .env.local.example .env.local   # add RESEND_API_KEY and CONTACT_TO_EMAIL
npm run dev
# → http://localhost:3000
```

The contact form will send live emails in dev if RESEND_API_KEY is set.
To test without sending, mock the route or use Resend's test mode.

---

## When Vercel Is Ready

1. Push repo to GitHub (github@rxshift.io account)
2. Connect GitHub repo to new Vercel account
3. Add environment variables in Vercel dashboard
4. Add domains: rxshift.io and app.rxshift.io
5. Configure Cloudflare DNS: CNAME rxshift.io → cname.vercel-dns.com
6. Done — deploy is automatic on push to main

---

## Notes for Future App Build (app.rxshift.io)

The app is not yet built. When it is:
- Routes under `/app/*` or a separate Next.js config using the `app.rxshift.io` domain
- Supabase for auth, database, storage
- The nav in the marketing site should add a "Sign in" link (top right) pointing to `app.rxshift.io/login`
- The brand system in Brand Items/ applies to the app UI as well
- See Brand Items/DESIGN.md for full app UI component patterns

---

*This file is the single source of truth for this Claude Code session.*
*Reference Brand Items/DESIGN.md for all visual decisions.*
*Do not deviate from the copy without flagging it — the wording is deliberate.*

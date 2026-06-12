# RxShift Design System
**Brand:** RxShift | **Domain:** rxshift.io | **Version:** 1.1 | **Date:** June 2026
**Tagline:** Compliance-ready pharmacy scheduling

---

## Overview

RxShift is a B2B SaaS product for retail pharmacy workforce scheduling with built-in state ratio compliance and hourly documentation. The brand serves independent pharmacists and small chain operators (1–25 locations). The visual identity must read as credible to a 55-year-old independent pharmacy owner AND a 30-year-old chain manager — neither too startup, nor too enterprise.

**Product type:** Web SaaS (Next.js, light mode, responsive)
**Core user:** Managing pharmacist / pharmacy owner
**Emotional register:** Calm authority under regulatory pressure

---

## The Mark

The RxShift mark is **The Schedule Grid** — a 4-column × 3-row array of rounded rectangles where column 3 is always Shift Amber. It is 100% geometric vector: no typeface, no licensing concern for the icon. The grid reads as a schedule at a glance.

**Column meaning:**
- Col 1 (#C4D2E2): Past or far-future — inactive
- Col 2 (#8FAABB): Upcoming — approaching active
- Col 3 (#F07C30): **The active shift** — live, must be compliant
- Col 4 (#C4D2E2): Future — not yet in scope

**Grid spec:**
- Cells: 22×22px, corner radius: 4px, gap: 7px
- Full mark: 109×80px (4 cols × 22 + 3 × 7 = 109 wide; 3 rows × 22 + 2 × 7 = 80 tall)
- Minimum size: 20×15px (below this, use favicon-16 or amber fallback)

**Logo files included:**
| File | Use |
|------|-----|
| rxshift-mark-light.svg | Icon only — light/transparent background |
| rxshift-mark-dark.svg | Icon only — navy background |
| rxshift-horizontal-light.svg | Primary lockup — light background |
| rxshift-horizontal-dark.svg | Primary lockup — dark/navy background |
| rxshift-stacked-light.svg | Stacked lockup with tagline — light |
| rxshift-stacked-dark.svg | Stacked lockup with tagline — dark |
| rxshift-wordmark-navy.svg | Wordmark only (no mark) — plain-text contexts |
| rxshift-wordmark-white.svg | Wordmark only — reversed on dark |
| rxshift-favicon-32.svg | Full 4×3 grid at 32px |
| rxshift-favicon-16.svg | Simplified 2×2 grid at 16px |
| rxshift-favicon-amber.svg | Solid amber square — absolute fallback |

---

## Color System

### Primary Palette

| Token | Name | Hex | RGB | Role |
|-------|------|-----|-----|------|
| `--color-navy` | Navy Anchor | `#1C2F5E` | 28, 47, 94 | Primary brand — headlines, nav, dark surfaces |
| `--color-amber` | Shift Amber | `#F07C30` | 240, 124, 48 | Accent — CTAs, active states, wordmark dot |
| `--color-steel` | Steel | `#4A5B7A` | 74, 91, 122 | Secondary text, labels, captions |
| `--color-cloud` | Cloud | `#F2F5FA` | 242, 245, 250 | Light surfaces, table fills, page bg |
| `--color-white` | White | `#FFFFFF` | 255, 255, 255 | Reversed text, card surfaces |
| `--color-border` | Border | `#DDE5EF` | 221, 229, 239 | Dividers, input borders, table rules |
| `--color-bg` | Background | `#F8FAFC` | 248, 250, 252 | Page background |

### Grid Mark Colors (mark SVG use only — do not use in UI or copy)

| Token | Hex | Use |
|-------|-----|-----|
| `--color-grid-inactive` | `#C4D2E2` | Cols 1 & 4 on light background |
| `--color-grid-upcoming` | `#8FAABB` | Col 2 on light background |
| `--color-grid-dark-inactive` | `#3B5785` | Cols 1 & 4 on navy background |
| `--color-grid-dark-upcoming` | `#557AB0` | Col 2 on navy background |

### Status Colors (product UI only — never use in marketing)

| Token | Name | Hex | Use |
|-------|------|-----|-----|
| `--color-compliant` | Compliant | `#2E7D5E` | Pass states, ratio-met badges |
| `--color-alert` | Alert | `#D4860A` | Warning — ratio approaching limit |
| `--color-deficiency` | Deficiency | `#C0392B` | Violation flags, deficient hours |

### CSS Custom Properties

```css
:root {
  /* Brand */
  --color-navy:    #1C2F5E;
  --color-amber:   #F07C30;
  --color-steel:   #4A5B7A;
  --color-cloud:   #F2F5FA;
  --color-white:   #FFFFFF;
  --color-border:  #DDE5EF;
  --color-bg:      #F8FAFC;

  /* Grid mark (SVG only) */
  --color-grid-inactive:      #C4D2E2;
  --color-grid-upcoming:      #8FAABB;
  --color-grid-dark-inactive: #3B5785;
  --color-grid-dark-upcoming: #557AB0;

  /* Status (product UI only) */
  --color-compliant:   #2E7D5E;
  --color-alert:       #D4860A;
  --color-deficiency:  #C0392B;

  /* Derived status backgrounds */
  --color-compliant-bg:   #EDF7F2;
  --color-alert-bg:       #FEF7ED;
  --color-deficiency-bg:  #FEF0EF;
}
```

---

## Typography

### Typefaces

| Role | Family | Source | Weights |
|------|--------|--------|---------|
| Brand | Space Grotesk | Google Fonts | 500 (medium), 700 (bold), 800 (extrabold) |
| Body / Data | Inter | Google Fonts | 400 (regular), 500 (medium) |

**Fallback stacks:**
```css
--font-brand: 'Space Grotesk', 'DM Sans', -apple-system, 'Helvetica Neue', sans-serif;
--font-body:  'Inter', -apple-system, 'Helvetica Neue', sans-serif;
```

### Type Scale

| Role | Font | Size | Weight | Color | Notes |
|------|------|------|--------|-------|-------|
| Logo display | Space Grotesk | 36px | 800 (Rx) / 500 (Shift) | #1C2F5E / #F07C30 (·) | Wordmark only |
| H1 | Space Grotesk | 28px | 700 | #1C2F5E | letter-spacing: -0.3px |
| H2 | Space Grotesk | 20px | 600 | #1C2F5E | letter-spacing: -0.2px |
| H3 / subhead | Space Grotesk | 16px | 600 | #1C2F5E | |
| Eyebrow / label | Space Grotesk | 11px | 700 | #F07C30 | UPPERCASE, letter-spacing: 1.8px |
| CTA button | Space Grotesk | 14px | 700 | #FFFFFF on amber | |
| Nav item | Space Grotesk | 14px | 500 | varies | |
| Tagline | Space Grotesk | 12px | 500 | #4A5B7A | sentence case |
| Body copy | Inter | 15px | 400 | #4A5B7A | line-height: 1.65 |
| Data / table | Inter | 13px | 500 | #1C2F5E | compliance logs, schedule entries |
| Caption / help | Inter | 12px | 400 | #4A5B7A | |
| Code / mono | JetBrains Mono | 12px | 400 | #1C2F5E | rule identifiers, time ranges |

### CSS Typography Tokens

```css
:root {
  --text-h1:      700 28px/1.2 var(--font-brand);
  --text-h2:      600 20px/1.3 var(--font-brand);
  --text-h3:      600 16px/1.4 var(--font-brand);
  --text-label:   700 11px/1   var(--font-brand);
  --text-button:  700 14px/1   var(--font-brand);
  --text-nav:     500 14px/1.4 var(--font-brand);
  --text-body:    400 15px/1.65 var(--font-body);
  --text-data:    500 13px/1.5  var(--font-body);
  --text-caption: 400 12px/1.5  var(--font-body);
}
```

---

## Spacing

4px base unit. Use multiples throughout.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
}
```

---

## Border Radius

```css
:root {
  --radius-sm:   4px;   /* schedule grid cells, badges */
  --radius-md:   6px;   /* buttons, inputs */
  --radius-lg:   10px;  /* cards */
  --radius-xl:   12px;  /* modals, dialogs */
  --radius-full: 9999px; /* pills */
}
```

---

## Shadows

```css
:root {
  --shadow-card:     0 1px 3px rgba(28, 47, 94, 0.08);
  --shadow-dropdown: 0 4px 16px rgba(28, 47, 94, 0.12);
  --shadow-dialog:   0 8px 32px rgba(28, 47, 94, 0.16);
}
```

---

## Component Patterns

### Buttons

```
Primary:     bg=#F07C30  text=white    font=Space Grotesk 700 14px  radius=6px  px=20 py=10
Primary hover: bg=#D96A22 (darken 10%)
Secondary:   bg=white    text=#1C2F5E  border=1.5px #DDE5EF         radius=6px
Ghost:       bg=transparent  text=#4A5B7A  no border
Destructive: bg=#C0392B  text=white    (deficiency-level actions only)
Disabled:    opacity=0.4
```

### Status Badges

```
Compliant:   bg=#EDF7F2  text=#2E7D5E  border-left=3px #2E7D5E  font=Space Grotesk 700 10px UPPERCASE
Alert:       bg=#FEF7ED  text=#D4860A  border-left=3px #D4860A
Deficiency:  bg=#FEF0EF  text=#C0392B  border-left=3px #C0392B
Neutral:     bg=#F2F5FA  text=#4A5B7A  border-left=3px #DDE5EF
```

### Schedule Grid Cells (core product UI pattern)

These power the schedule builder and compliance view. The grid marks in the logo are the visual shorthand for this.

```
Compliant slot:   bg=#EDF7F2  radius=4px
Deficient slot:   bg=#FEF0EF  border-left=3px #C0392B
Alert slot:       bg=#FEF7ED  border-left=3px #D4860A
Unfilled slot:    bg=#F2F5FA  border=1.5px dashed #DDE5EF
Current shift:    ring=2px solid #F07C30 (amber outline, inset)
Staff label:      Inter 12px 500 #1C2F5E
Time label:       Space Grotesk 10px 700 #4A5B7A UPPERCASE
```

### Compliance Log Row (hourly documentation)

```
Format:    [08:00–09:00]  ·  [1 RPh]  ·  [2 Tech]  ·  [status badge]
Row font:  Inter 13px 500 #1C2F5E
Time cell: Space Grotesk 11px 600 #4A5B7A
Deficient row: bg=#FEF0EF, entire row tinted
Border:    border-bottom 1px #DDE5EF
```

### Data Tables

```
Header:    bg=#F2F5FA  font=Space Grotesk 700 9.5px UPPERCASE  color=#4A5B7A  letter-spacing=1px
Row:       border-bottom=1px #DDE5EF  hover=bg rgba(28,47,94,0.02)
Data cell: Inter 13px  color=#1C2F5E  padding=10px 12px
```

### Navigation Sidebar

```
Width:        240px  fixed
Background:   #1C2F5E (Navy Anchor)
Logo area:    bg=#162650 (navy -5% lightness)  height=60px  padding=0 20px

Active item:  bg=rgba(240,124,48,0.15)  text=#F07C30  border-left=3px solid #F07C30
Inactive item: text=rgba(255,255,255,0.65)  hover=bg rgba(255,255,255,0.06)
Icon:         16px  margin-right=10px
Font:         Space Grotesk 14px 500

Section label: Space Grotesk 9.5px 700 rgba(255,255,255,0.35) UPPERCASE letter-spacing=1.5px  padding=20px 20px 8px
```

### Page Header Bar

```
Height:       60px
Border-bottom: 1px #DDE5EF
Background:   white
Title:        Space Grotesk 18px 700 #1C2F5E
Actions area: right-aligned, flex gap=12px
```

### Cards

```
Standard:    bg=white  border=1px #DDE5EF  radius=10px  shadow=--shadow-card  padding=24px
Elevated:    bg=white  shadow=--shadow-dropdown  no border
Highlighted: border-left=4px #F07C30  (use for priority items)
Stat card:   label Space Grotesk 10px 700 #4A5B7A UPPERCASE  value Space Grotesk 28px 700 #1C2F5E
```

### Form Inputs

```
Border:     1.5px #DDE5EF  radius=6px
Focus:      border-color=#1C2F5E  box-shadow=0 0 0 3px rgba(28,47,94,0.10)
Error:      border-color=#C0392B  box-shadow=0 0 0 3px rgba(192,57,43,0.10)
Label:      Space Grotesk 11px 700 #4A5B7A UPPERCASE  letter-spacing=0.5px  margin-bottom=6px
Helper:     Inter 12px 400 #4A5B7A  margin-top=4px
Placeholder: #9BAABB
```

### Modal / Dialog

```
Backdrop:   rgba(28,47,94,0.4)
Panel:      bg=white  radius=12px  shadow=--shadow-dialog  max-width=480px  padding=32px
Header:     Space Grotesk 18px 700 #1C2F5E  margin-bottom=8px
Body:       Inter 14px 400 #4A5B7A
Footer:     border-top=1px #DDE5EF  padding-top=20px  flex justify-end gap=12px
```

---

## App Layout

### Core Pages

| Page | Route | Description |
|------|-------|-------------|
| Dashboard | `/dashboard` | Compliance status overview — location cards, deficiency flags |
| Schedule Builder | `/schedule` | Week-view staff scheduling with live ratio overlay |
| Compliance Log | `/log` | Hourly documentation — RPh + tech per hour, deficiency export |
| Staff Directory | `/staff` | Pharmacists, techs, trainees — cert tracking, active status |
| Settings | `/settings` | Ratio rules per state, location management, notification config |

### Page Layout Pattern

```
┌─────────────────────────────────────────────────────┐
│  Sidebar (240px fixed)  │  Main content (flex 1)    │
│                         │  ┌─────────────────────┐  │
│  [Logo area 60px]       │  │ Page header (60px)  │  │
│  ─────────────          │  ├─────────────────────┤  │
│  [Nav items]            │  │                     │  │
│                         │  │  Content (scroll)   │  │
│                         │  │  padding: 32px      │  │
│  [Bottom: user/org]     │  │                     │  │
└─────────────────────────────────────────────────────┘
```

---

## Logo Usage Rules

- **Brand name:** Always `RxShift` — capital R, lowercase x, capital S. One word. Never "RX Shift", "rxshift", "Rx Shift".
- **Column 3 of the mark:** Always `#F07C30`. Changing it breaks the schedule metaphor.
- **No badges or containers:** The grid mark stands alone — no drop shadows, background shapes, or glow effects.
- **Clearspace:** Minimum 1 grid-cell height (22px) on all four sides.
- **Minimum mark size:** 20×15px. Below this, use favicon-16 or favicon-amber.
- **Never pair with pharmacy imagery:** No pills, mortar, caduceus, or lab imagery. Contradicts the scheduling-tool positioning.
- **Tagline wording:** Exact text only — "Compliance-ready pharmacy scheduling". No alterations.

---

## Voice & Tone

**Brand voice in three words:** Confident. Precise. Warm.

RxShift speaks like a pharmacist who's also good at software. Knowledgeable without being clinical; direct without being terse. Never over-explains regulation. Trusts the buyer to recognize value from plain description.

### Copy Patterns

| Context | Pattern | Example |
|---------|---------|---------|
| Headlines | Specific benefit, buyer-side language | "Your schedule knows the ratios. So you don't have to." |
| Error states | Exact problem + exact fix, no alarm | "Ratio short Thursday 2–4 PM. Add one technician to stay compliant." |
| CTA buttons | Active verb + object (what the click does) | "Generate Schedule", "Export Compliance Log", "Set Up Ratios" |
| Email subjects | Story-driven, specific | "How Southwest Medical stopped tracking ratios by hand" |
| Empty states | Invitation to act | "No schedule yet for this week. Generate one based on last week's staffing." |
| Success states | Confirm the action, name what happened | "Schedule published. Compliance log will auto-generate each shift." |

### Vocabulary

**Use:** RPh, tech, trainee, ratio, shift, coverage, deficiency, compliant, log, board, inspection  
**Avoid:** employee, worker, staff (too generic), violation (use "deficiency"), powered by AI (always specific), seamless/revolutionize (noise)

---

## Accessibility

- All text on white backgrounds: minimum 4.5:1 contrast ratio (WCAG AA)
- Navy on white: #1C2F5E → 8.8:1 ✓
- Steel on white: #4A5B7A → 4.7:1 ✓
- Amber on white: #F07C30 → 3.0:1 — **use only for decorative/non-text elements**
- White on amber: #FFFFFF on #F07C30 → 3.0:1 — **use only for buttons with clear affordance**
- White on navy: #FFFFFF on #1C2F5E → 8.8:1 ✓
- Focus rings: 3px solid rgba(28,47,94,0.5) for brand consistency
- All interactive elements: minimum 44×44px touch target

---

## File Reference

Upload all files in this package to Claude Design during design system onboarding:

```
rxshift-brand-export/
  DESIGN.md                      ← this file (primary system doc)
  rxshift-horizontal-light.svg   ← primary lockup for design reference
  rxshift-horizontal-dark.svg    ← dark variant
  rxshift-mark-light.svg         ← icon only, light
  rxshift-mark-dark.svg          ← icon only, dark
  rxshift-stacked-light.svg      ← stacked + tagline
  rxshift-stacked-dark.svg       ← stacked dark
  rxshift-wordmark-navy.svg      ← text mark only
  rxshift-wordmark-white.svg     ← reversed text mark
  rxshift-favicon-32.svg         ← full grid favicon
  rxshift-favicon-16.svg         ← compact 2×2 favicon
  rxshift-favicon-amber.svg      ← amber square fallback
  rxshift-brand-guidelines.html  ← full reference document
```

When prompting Claude Design, reference:
- "Use the RxShift Schedule Grid mark, not a badge or icon"
- "Primary CTA buttons: Shift Amber (#F07C30), Space Grotesk 700"
- "Navigation sidebar: Navy Anchor (#1C2F5E)"
- "Status indicators: Compliant green (#2E7D5E), Alert (#D4860A), Deficiency red (#C0392B)"
- "Compliance log rows use Inter 13px, status badges left-aligned with colored border"


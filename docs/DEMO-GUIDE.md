# RxShift — Demo Guide

> The single, accurate source for running a demo. Built because the old demo script drifted from reality
> (it claimed live statuses live on the Dashboard — they don't; they're on the **Live Board** and
> **My Schedule**). Keep this in sync with the app; pair it with `FEATURE-MAP.md`. Last updated June 18, 2026.

---

## 0. Pre-demo checklist (5 minutes)

**Two different sign-ins — don't confuse them.** "Restore demo data" and the "Demo clock" live in the
**Admin Console** (`/app/admin`), which is visible **only to a platform-admin account** (e.g. Susie's
platform-admin login). `demo@rxshift.io` is the in-tenant **owner** (Frank DiMaggio) you *present* as —
it is NOT a platform admin and has no Admin Console. Also: the whole **Platform nav disappears while you're
"viewing as"/emulating** a tenant, so **do the reset + clock first, then emulate.**

1. **Sign in as a platform admin** and open **Platform → Admin Console**. Click the **Mesa Vista** row to
   expand its controls.
2. **Fresh data?** In that expanded row → **Restore demo data** (or `npx tsx scripts/seed-mesa-vista.ts
   --reset`). This wipes + re-seeds and **re-anchors every date to the current week**, so the demo always
   looks current. Departments, the deficiency story, the override/acknowledged-exception, and Jerome's
   overtime all come back each time.
3. **Demoing outside 9–5 Pacific?** Same expanded row → **Demo clock (after-hours demos)** → type a time
   (e.g. `13:00`) → **Pin time**. The Live Board / My Schedule / live status then evaluate "now" at that
   time on today's real date, so staff show on shift. Click **Use real time** when done. (Real customers
   never use this; it only shows for demo tenants.)
4. **Then present.** Sign in / emulate the person you want to demo as: `demo@rxshift.io` (Frank, owner) for
   the manager view, or the staff aliases `jerome@rxshift.io` (technician) / `patricia@rxshift.io`
   (managing pharmacist) for the staff/pharmacist view. Typical demo = ~4 tabs: **Live Board** (or
   `/app/display` wall view), **Schedule**, **Compliance Record** (`/app/log`), **My Schedule**.
5. **AI working?** Ask AI needs `OPENAI_API_KEY`. If unset, the bar shows a friendly "not configured" note.

---

## 1. The story (what RxShift is)

Retail pharmacies must keep a state-mandated pharmacist-to-technician ratio every hour. Today that's tracked
on whiteboards and spreadsheets that don't understand compliance. **RxShift builds the ratio into the
schedule, so deficiencies surface before they become violations** — and it documents everything an auditor
or board would ask for. It never blocks the pharmacy and never contacts a board; it surfaces risk and keeps
the record.

---

## 2. Screen-by-screen walkthrough (correct facts)

**Start on the Live Board (`/app/board`)** — the most visual, "live right now" screen.
- Per-location cards show who's on **right now**, grouped by Pharmacists / Technicians (counting vs not).
- Each compliant location shows **"✓ N pharmacists can step away"** (the headroom feature) — or "at the
  limit." Henderson shows **Deficient** during the Thursday 2–4pm gap (see §3) if "now" lands there.
- Managers change anyone's live status here. Click **Open display** for the chrome-free wall monitor view.
- *(If it's blank, you're outside business hours — set the Demo clock, §0.3.)*

**Dashboard (`/app/dashboard`)** — the compliance **overview**, not a status board.
- Stat cards: Current period, **Deficient slots**, **Open flags**, **Pending requests** — all clickable;
  clicking jumps to the exact slot on the schedule (or the requests list). AI **Insights** are clickable too.
- Use this to say "here's the health of the operation at a glance, and every number is a doorway."

**Schedule (`/app/schedule`)** — the build surface.
- One matrix; the location pills filter the view; the window selector switches week/2-week/month.
- **Two distinct ring channels:** a **ratio deficiency** is a **red ring + ⚠**; a **constraint** (hours
  cap, availability, double-booking) is an **amber ring**. On **Henderson, current week**: Jerome Williams
  (43h) shows an **amber** ring on **Saturday** (the shift that tips him over 40h), while his **Thursday**
  shows the **red ⚠** ratio-gap — both visible at once, a clean "these are different things" moment.
- Publish / Copy last week / Export CSV.
- **Ask AI** (top): type "is anything non-compliant coming up?", "who's short Thursday?", or
  "schedule Marcus 9–5 Mon–Fri this week." It answers from the live schedule or proposes a change; the
  engine validates it ("✓ removes 2 deficient slots") and you **confirm** before it applies. (It works on the
  selected location's current week — switch the location pill to re-scope.)

**My Schedule (`/app/me`)** — the staff/pharmacist view (great on a phone). Emulate Patricia or Jerome.
- **My Status Now**: set your live status when on shift. A pharmacist sees **"can I step away?"** —
  whether stepping off keeps the location compliant (warns, never blocks).
- **What I'm doing now**: a tech/RPh switches their current work type (e.g. to Inventory) and the live ratio
  updates from that moment — the segment is split at "now."
- Next two weeks, my requests, and **Who's on this week** at their home location.

**Requests (`/app/requests`)** — time off, callouts, swaps.
- Submitting PTO shows "approving this would create N deficient slots" up front. Logging a callout shows the
  resulting gap. A manager approving a deficiency-causing PTO/swap **must enter a reason** (logged).

**Compliance Record (`/app/log`)** — the auditor's hourly staffing record.
- Hour-by-hour per location, deficient hours highlighted, an **Acknowledged exceptions** section with the
  override reasons, and **Save as PDF (official record)** — a non-editable document that carries the *why*.
- **Pick the location in the dropdown** — the record shows one location/week at a time. Select **Mesa Vista
  — Henderson [current week]** to see the deficiency story. Thursday 14:00–16:00 shows two **deficient**
  rows, each carrying an inline **⚠ Acknowledged exception (Frank DiMaggio)** with the family-emergency
  reason — the documentation sits right on the deficient hours, and prints with the PDF.
- **Override Log** and **Audit Log** sit alongside: the Override Log shows the same acknowledgment
  (**Frank DiMaggio**, the owner, with the reason); the Audit Log is the full append-only action trail, and
  you can **append a note** to any entry (e.g. "RPh forgot to clock back from lunch") without altering it.

---

## 3. The built-in deficiency story (Mesa Vista, current week, Henderson, Thursday)

Dr. Sunita Patel left at **2:00 PM** on a family emergency; the float pharmacist Dr. Owen Fitzgerald was
held at Spring Valley until **4:00 PM** — so 2:00–4:00 the technicians kept the counter open with no
pharmacist. The engine flags exactly those slots **deficient**. It's one isolated day (no 3-consecutive-day
board-report trigger). See it on the **Compliance Record** (Henderson, Thursday) and, with the Demo clock
pinned into that window, on the **Live Board**.

---

## 4. Mesa Vista demo data (what's seeded)

- **Fictional only** — invented company + `@mesavistarx.com` people (never real customer names).
- **3 Nevada locations:** Spring Valley (flagship — 3 pharmacists, so it carries real step-away headroom),
  Henderson (the deficiency story), North Las Vegas.
- **15 staff**, ~6 weeks of schedule anchored to the current week.
- **4 work types:** Dispensing + Training (count), Inventory (doesn't count), Meeting (doesn't count).
- **4 departments:** Retail Counter, Compounding, Specialty, Drive-Thru (area tags for the schedule filter;
  they don't affect the ratio).
- **Requests seeded:** an approved PTO + a pending PTO; a logged callout + override tied to the Henderson story.
- **Demo logins:** `demo@rxshift.io` (Frank, owner), `patricia@rxshift.io` (managing pharmacist),
  `jerome@rxshift.io` (technician).

**Reset** wipes all of the above (FK-safe order) and re-seeds with dates re-anchored to this week. Tenant
config + the demo logins are preserved. Run it anytime the demo data looks stale or you broke something live.

---

## 5. Known limitations (don't over-promise)

- **After-hours** needs the Demo clock pinned (real tenants use the real clock).
- The official compliance export is **print-to-PDF** (Ctrl/Cmd-P → Save as PDF), not a one-click download.
- Ask AI works on **one location's current week** at a time (switch the location pill to re-scope).
- Schedule builder + Settings are **desktop-only** (My Schedule + Requests are the mobile surfaces).
- Multi-state / per-location ratio rules, scripts-per-hour volume minimums, trainee sub-limits, and
  Tennessee cert-dependent enforcement are **roadmap**, not shipped.

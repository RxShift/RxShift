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
   looks current. Everything comes back: departments, the deficiency story, the overtime, Jerome's amber
   ring — **and the as-worked Compliance Record is finalized for the elapsed week (~266 hours), with the
   Henderson Thursday 2–4 PM gap recorded as an actual deficiency and Frank's annotation attached.**
3. **Demoing outside 9–5 Pacific?** Same expanded row → **Demo clock (after-hours demos)** → type a time
   (e.g. `13:00`) → **Pin time**. The Live Board / My Schedule / live status then evaluate "now" at that
   time on today's real date, so staff show on shift. Click **Use real time** when done. (Real customers
   never use this; it only shows for demo tenants.)
4. **Then present.** Sign in / emulate the person you want to demo as: `demo@rxshift.io` (Frank, owner) for
   the manager view, or the staff aliases `jerome@rxshift.io` (technician) / `patricia@rxshift.io`
   (managing pharmacist) for the staff/pharmacist view. Emulating now shows the person's real name in the
   banner ("Viewing … as Frank DiMaggio"). Typical demo = ~4 tabs: **Live Board** (or `/app/display` wall
   view), **Schedule**, **Compliance Record** (`/app/log`), **My Schedule**.
   - **Use a separate browser profile per emulated user.** Admin Console "emulate" is a single server-side
     session — opening two emulated users in two tabs of the *same* profile collides (both tabs become the
     last one you set). For a multi-person demo (manager + pharmacist + tech at once), use different Chrome
     profiles / windows, each signed in separately.
5. **AI working?** Ask AI needs `OPENAI_API_KEY` (present locally). If unset, the bar shows a friendly "not
   configured" note. Ask AI now appears on **empty weeks** too (it creates the period when you confirm a
   shift).

---

## 1. The story (what RxShift is)

Retail pharmacies must keep a state-mandated pharmacist-to-technician ratio every hour. Today that's tracked
on whiteboards and spreadsheets that don't understand compliance. **RxShift builds the ratio into the
schedule, so deficiencies surface before they become violations** — and it captures the documentation around
them (acknowledged exceptions, an append-only audit trail). It never blocks the pharmacy and never contacts a
board; it surfaces risk and keeps the record. Two artifacts: the **Coverage Forecast** projects the published
schedule ("are we *scheduled* to be in ratio?"); the **Compliance Record** is the immutable hour-by-hour
record of what *actually happened* (2-year, annotatable) — the board-defensible audit. See §2.

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
- **Ask AI** (top): type "is anything non-compliant coming up?", "who's short Thursday?",
  "schedule Dr. Fitzgerald 9–5 Mon–Fri this week," or "extend Dr. Patel's Thursday shift to 4pm." It answers
  from the live schedule or proposes a change; each proposed edit shows a **before → after line**
  (e.g. "Dr. Sunita Patel · Thu: 09:00–14:00 → 09:00–16:00") plus the engine check ("✓ removes 4 deficient
  slots"), and you **confirm** before anything applies. If a change would *add* a deficiency you must tick an
  acknowledgment box first (warn, never block). **Works on empty weeks too** — "schedule … on a blank week"
  proposes the shifts and creates the period when you confirm. (Scoped to the selected location's current
  week — switch the location pill to re-scope.)

**My Schedule (`/app/me`)** — the staff/pharmacist view (great on a phone). Emulate Patricia or Jerome.
- **My Status Now**: set your live status when on shift. A pharmacist who is **currently counting** sees
  **"can I step away?"** — whether stepping off keeps the location compliant (warns, never blocks). Once they
  set a **non-counting** status (Lunch / Off floor / Meeting), the step-away line **disappears** — they've
  already stepped away, so there's nothing to warn about.
- **What I'm doing now**: a tech/RPh switches their current work type (e.g. to Inventory) and the live ratio
  updates from that moment — the segment is split at "now."
- Next two weeks, my requests, and **Who's on this week** at their home location.

**Requests (`/app/requests`)** — time off, callouts, swaps.
- Submitting PTO shows "approving this would create N deficient slots" up front. Logging a callout shows the
  resulting gap. A manager approving a deficiency-causing PTO/swap **must enter a reason** (logged).

**Compliance Record (`/app/log`)** — the **as-worked** audit: the immutable, hour-by-hour record of what
**actually happened** at each location (who was on + counting, ratio met/not). RxShift finalizes each hour
after it passes — reconstructed from the published schedule adjusted by your team's live statuses — then
**freezes** it. Retained two years; **never edited**.
- **Pick the day in the dropdown.** Select today and Henderson: **Thursday 14:00–15:00 shows DEFICIENT — "3
  technicians counting with no pharmacist on duty"** — with **Frank DiMaggio's appended note** documenting the
  Patel family emergency right on those hours. The note explains the hour; the determination never changes.
- **+ Note** on any hour shows the after-the-fact annotation flow (the thing you asked for: "we were out for
  30 minutes — here's why"). **Save as PDF (official record)** / Export CSV.
- **Coverage Forecast (`/app/coverage-forecast`)** is the sibling — the schedule-derived *projection* ("are we
  *scheduled* to be in ratio?"), a planning aid, with the publish-time **Acknowledged exceptions** (override
  reasons). **Override Log** + **Audit Log** sit alongside (acknowledged-exception reasons / full change trail).

> **Say it accurately.** The **Compliance Record** is what *actually happened* (immutable, annotatable, 2-year
> — the board-defensible artifact). The **Coverage Forecast** is the *plan* projection. Don't conflate them —
> "publish the schedule and the record writes itself **hour by hour**" is the honest line (it finalizes as the
> day passes, not the instant you publish).

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
- **Compliance Record (as-worked):** the seed finalizes the elapsed week (~266 immutable hourly rows across
  the 3 locations); Henderson **Thursday 14:00 + 15:00 are recorded DEFICIENT** ("3 technicians counting with
  no pharmacist on duty") with **Frank DiMaggio's annotation** (Patel family emergency) attached. A few demo
  emails sit in the platform email log (schedule published, deficiency alert, PTO approved).
- **Demo logins:** `demo@rxshift.io` (Frank, owner), `patricia@rxshift.io` (managing pharmacist),
  `jerome@rxshift.io` (technician).

**Reset** wipes all of the above (FK-safe order) and re-seeds with dates re-anchored to this week. Tenant
config + the demo logins are preserved. Run it anytime the demo data looks stale or you broke something live.

---

## 5. Known limitations (don't over-promise)

- **After-hours** needs the Demo clock pinned (real tenants use the real clock).
- The **Compliance Record** is finalized **after each hour passes** — daily on the current hosting (Vercel
  Hobby caps crons at daily), hourly once on Pro. It captures **actual** presence inferred from the published
  schedule adjusted by live statuses — there's **no hardware clock-in/out** yet; a manager corrects an hour
  with an appended note. (Sub-30-min status changes and overnight shifts are v1 approximations.)
- The Compliance Record per-day export is **print-to-PDF** (Ctrl/Cmd-P → Save as PDF) + CSV; the **Reports**
  page exports the same as-worked record as xlsx over a date range.
- Ask AI works on **one location's current week** at a time (switch the location pill to re-scope).
- Schedule builder + Settings are **desktop-only** (My Schedule + Requests are the mobile surfaces).
- Multi-state / per-location ratio rules, scripts-per-hour volume minimums, trainee sub-limits, and
  Tennessee cert-dependent enforcement are **roadmap**, not shipped.

---

## 6. What changed June 18 — refresh your demo script, marketing & imagery

A lot moved; before CoWork validates a run, refresh these so the script matches reality:

**New / renamed surfaces (update the demo script + any walkthrough recording):**
- **Compliance Record (`/app/log`)** is now the **as-worked audit** (what actually happened, immutable,
  annotatable, 2-year) — *not* the schedule projection. This is the new headline beat: open it, show the
  Henderson Thursday gap as a *recorded* deficiency, and show **+ Note** (append an explanation after the fact).
- **Coverage Forecast (`/app/coverage-forecast`)** is new — the old `/app/log` as-scheduled view, relocated.
  Use it for the "are we *scheduled* to be covered?" planning beat.
- Sidebar order: Compliance Record · Coverage Forecast · Override Log · Audit Log · Reports.
- The Reports "Compliance Record" xlsx now exports the **as-worked** record (was the schedule snapshot).

**Six demo fixes also in this build (mentioned above, here for the checklist):** emulation banner shows the
person's name; empty weeks no longer show "Published ✓"; Ask AI works on empty weeks + does accurate
extend/shorten with before→after; step-away line hides once non-counting; seeded demo emails.

**Marketing / website (you'll want to revisit):**
- Copy across hero, features, `/nevada`, `/vs/when-i-work`, pricing, security, terms, privacy now says
  **"Compliance Record"** (the as-worked artifact) and frames it as *what actually happened, finalized hour by
  hour* — the old "publish the schedule and the record exists" instant-record overclaims are gone.
- **Imagery to recapture (stale):** `public/images/screenshots/compliance-record.jpg` should now show the
  **as-worked Compliance Record** (with a deficient hour + an attached note), not the old schedule-derived
  view. The schedule/board/dashboard screenshots are still accurate. Regenerate via
  `scripts/capture-screenshots.ts` after a reset. The marketing pages still reference that filename.
- **Legal:** Terms/Privacy 2-year-retention + R113-24 wording is now *accurate to the real record* — have
  Susie / the attorney confirm it before it goes live.

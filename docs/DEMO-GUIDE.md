# RxShift — Demo Guide

> The single, accurate source for running a demo. Built because the old demo script drifted from reality
> (it claimed live statuses live on the Dashboard — they don't; they're on the **Live Board** and
> **My Schedule**). Keep this in sync with the app; pair it with `FEATURE-MAP.md`. Last updated June 19, 2026.

---

## 0. Pre-demo checklist (5 minutes)

**Two different sign-ins — don't confuse them.** "Restore demo data" and the "Demo clock" live in the
**Admin Console** (`/app/admin`), which is visible **only to a platform-admin account** (e.g. Susie's
platform-admin login). `demo@rxshift.io` is the in-tenant **owner** (Frank DiMaggio) you *present* as —
it is NOT a platform admin and has no Admin Console. Also: the whole **Platform nav disappears while you're
"viewing as"/emulating** a tenant, so **do the reset + clock first, then emulate.**

1. **Sign in as a platform admin** and open **Platform → Admin Console**. On the **Mesa Vista** row, click
   **Edit** (it toggles to **Close**) to expand its controls — the row *name* itself isn't clickable.
2. **Fresh data?** In that expanded row → **Restore demo data** (or `npx tsx scripts/seed-mesa-vista.ts
   --reset`). This wipes + re-seeds and **re-anchors every date to the current week**, so the demo always
   looks current. Everything comes back: departments, the two deficiency stories, the overtime, Jerome's amber
   ring — **and the as-worked Compliance Record is finalized for the elapsed week (~294 hours), with the
   Henderson Thursday 2–4 PM ceiling gap AND the North Las Vegas Tuesday 9–10 AM floor gap recorded as actual
   deficiencies, each with a manager annotation attached.** The reset now confirms inline with the re-seeded
   counts (shifts / deficient hours) instead of silently reverting.
3. **Demoing outside 9–5 Pacific?** Same expanded row → **Demo clock (after-hours demos)** → type a time
   (e.g. `13:00`) → **Pin time**. The Live Board / My Schedule / live status then evaluate "now" at that
   time on today's real date, so staff show on shift. Click **Use real time** when done. (Real customers
   never use this; it only shows for demo tenants.) **The pinned clock persists through Restore demo data**
   (it's tenant config), so you only set it once. **Note:** the clock changes the time of day, *not the date* —
   see the Thursday caveat in §2/§3.
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
  limit."
- **Live-board deficiency only reproduces on a Thursday.** The Henderson 2–4 PM gap is anchored to the
  current-week **Thursday**, and the Demo clock only moves the *time of day* on **today's** date — it can't
  change the date. So the gap shows live on the Live Board only when you demo *on a Thursday*. On any other
  day Henderson reads **Compliant now** at 14:30; show the gap on the **Compliance Record** (§3), which is
  date-specific and always has it.
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
- **PTO** shows **blacked out** ("PTO") on a person's row — including time off months out, before that
  week is built. **Holiday** columns are lightly tinted and labeled "Holiday." Both are visual; holidays
  never block staffing.
- Publish / Copy last week / Export CSV. **Publish status is honest per day** — a window that's part
  published, part draft reads e.g. **"5/7 days published,"** not "Published ✓." Publishing with open flags
  **requires a reason** (it won't go through blank). Build cadence is fixed per tenant (Settings →
  Organization); you can still *view* any span.
- **Build mode** (button by the view pills): collapses the nav + chrome so the grid fills the screen —
  many staff rows at once. The date control stays. Exit to bring the chrome back. (Designed for a normal
  laptop, not a big external monitor.)
- **Carry-forward:** open a shift → "Copy this shift to following days" → pick a through-date → it repeats
  the shift across those days in one move (skipping days the person already works or is off).
- Clicking an **unbuilt future week** just works — the period is created when you save (no "create period"
  step).
- **Ask AI** (collapsed to a small ✨ button — click to expand): type "is anything non-compliant coming up?", "who's short Thursday?",
  "schedule Dr. Fitzgerald 9–5 Mon–Fri this week," or "extend Dr. Patel's Thursday shift to 4pm." It answers
  from the live schedule or proposes a change; each proposed edit shows a **before → after line**
  (e.g. "Dr. Sunita Patel · Thu: 09:00–14:00 → 09:00–16:00") plus the engine check ("✓ removes 4 deficient
  slots"), and you **confirm** before anything applies. If a change would *add* a deficiency you must tick an
  acknowledgment box first (warn, never block). It resolves the staff member **by name** — confirming the
  exact person, and asking if a name is ambiguous, so it never schedules the wrong staffer. **Works on empty
  weeks too** — "schedule … on a blank week" proposes the shifts and creates the period when you confirm.
  (Scoped to the selected location's current week — switch the location pill to re-scope.)

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
- **Both seeded pending PTOs trigger the reason-required gate** — there is no "clean, no-reason approve" in
  the seed. Approving Jerome's PTO (he's Henderson's lone tech) leaves a solo pharmacist with no support →
  R072-25 floor deficiency → reason required; Patricia's flags ratio slots too. Demo the **reason-required
  gate** itself (the point), not a frictionless approval.
- Once approved, the days show **blacked out as PTO** across the schedule. A scheduler can also enter PTO
  **directly** from the grid (the "PTO" checkbox on the shift editor) — identical record, identical look.
  The optional reason lives with the PTO record (never the override log); Settings → Organization can make it
  required.

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

## 3. The built-in deficiency stories (Mesa Vista, current week) — two distinct kinds

R072-25 is **on** for the demo tenant, so the Compliance Record shows both kinds of deficiency, each labeled:

**Over the ceiling (Henderson, Thursday 2–4 PM).** Dr. Sunita Patel left at **2:00 PM** on a family
emergency; the float pharmacist Dr. Owen Fitzgerald was held at Spring Valley until **4:00 PM** — so 2:00–4:00
the technicians kept the counter open with no pharmacist. Those hours flag **deficient → "Over ceiling"** with
Frank's annotation attached. It shows on the **Live Board** *only if you demo on a Thursday* (the Demo clock
moves the time of day, not the date — see §2); otherwise show it on the date-specific Compliance Record.

**Under the floor (North Las Vegas, Tuesday 9–10 AM).** A tech called out, so Dr. Chang opened solo with no
support staff. Under R072-25 a single pharmacist needs at least one technician on duty, so 9:00–10:00 flags
**deficient → "Under floor (understaffed)"** — a different failure mode from Henderson, with its own note.

Both are isolated incidents — **not** a sustained deficiency. RxShift never contacts a board. See them on the
**Compliance Record** (Henderson Thursday; North Las Vegas Tuesday).

---

## 4. Mesa Vista demo data (what's seeded)

- **Fictional only** — invented company + `@mesavistarx.com` people (never real customer names).
- **3 Nevada locations (all retail):** Spring Valley (flagship — 3 pharmacists + a **drive-through**, so it
  carries real step-away headroom and stays compliant under the R072-25 floor of 2), Henderson (the **ceiling**
  deficiency story), North Las Vegas (the **floor** deficiency story).
- **R072-25 is ON** (`nevada_r072_25 = true`): retail 4-tech ceiling, 2-trainee sublimit, solo-pharmacist floor.
- **15 staff**, ~6 weeks of schedule anchored to the current week. Tyler Brooks + Miguel Santos are
  **technicians in training** (`staff_type`); each location carries **expected Rx** volumes (shown on the
  schedule header, informational only).
- **4 work types:** Dispensing + Training (count), Inventory (doesn't count), Meeting (doesn't count).
- **4 departments:** Retail Counter, Compounding, Specialty, Drive-Thru (area tags for the schedule filter;
  they don't affect the ratio).
- **Requests seeded:** an approved PTO + a pending PTO; a logged callout + override tied to the Henderson story.
- **PTO seeded (blacked out on the grid):** Ashley Morales is off next Mon–Tue (the approved request, now also
  durable `pto_day` rows), and Dana Holt has a **scheduler-entered** PTO this Wednesday at Spring Valley (which
  has headroom, so it doesn't disturb the two deficiency stories) — shows the direct-entry path.
- **Holidays seeded:** the US federal holidays for the current + next year (tinted/labeled columns on the
  schedule).
- **Compliance Record (as-worked):** the seed finalizes the elapsed week (~294 immutable hourly rows across
  the 3 locations); Henderson **Thursday 14:00 + 15:00 are recorded DEFICIENT** ("3 technicians counting with
  no pharmacist on duty", **flag_type = ceiling**) and North Las Vegas **Tuesday 09:00 DEFICIENT** ("solo
  pharmacist, no technician", **flag_type = floor**) — each with a manager annotation attached. A few demo
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
- **Shipped June 19, 2026:** Nevada R072-25 (4-tech ceiling, trainee sub-limit, solo-pharmacist floor) behind
  the `nevada_r072_25` toggle, and Tennessee cert-dependent enforcement (CPhT uncapped). **Still roadmap:**
  multi-state / per-location ratio rules in one tenant, and any *enforcement* of prescription-volume minimums
  (R072-25 volume is collect-only — expected Rx is shown, never enforced).

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
- **Imagery (regenerated June 19, 2026 — current-law):** all five files in
  `public/images/screenshots/` (`compliance-record.jpg`, `schedule-all-locations.jpg`, `dashboard.jpg`,
  `live-board.jpg`, `live-board.gif`) were recaptured. `compliance-record.jpg` now shows the **as-worked
  Compliance Record** for the deficiency day (Henderson gap + attached note), not the old schedule-derived
  view. The shots reflect the **current sidebar** (Coverage Forecast + Audit Log) and the Rx expected-volume
  day-header labels.
  - **They show current Nevada law (NAC 639.250 = 3 techs/pharmacist), to match the marketing site.** The
    demo tenant runs R072-25 **on** (4-tech ceiling), so to recapture current-law imagery you must seed with
    R072-25 **off** first: temporarily set the seed's `nevada_r072_25` to `false` (in `lib/demo/mesa-vista.ts`),
    `npx tsx scripts/seed-mesa-vista.ts --reset`, `npx tsx scripts/capture-screenshots.ts`, then revert the
    seed and reset again to restore R072-25 **on**. (Capturing with the toggle on would print 4/pharmacist
    numbers into a site that claims only current law — an overclaim.)
  - The capture script targets the Compliance Record by **`?date=`** (the deficient day, queried
    automatically), not the old `?period=`.
- **Legal / regulatory:** Terms/Privacy 2-year-retention wording, and the Nevada page's framing of current
  law (NAC 639.250) vs proposed **R072-25** (hearing June 2026, not adopted), are *accurate to the real
  record* — have Susie / the attorney confirm before it goes live. Only current law is claimed; R072-25 is
  forward context.

---

## 7. What changed June 22 — scheduling overhaul

The schedule builder got a lot stronger, and the demo prompter is now part of the app.

**Run the prompter from the app.** The presenter script lives at **`/app/demo-prompter`** (platform-admin
only). Open it from the **Admin Console → "Open demo prompter"** — it pops out into a small window you can
park on a second monitor. It's always current (v4.0). The old standalone HTML file is retired.

**New on the schedule (work these into the build beat):**
- **Build mode** — a button by the view pills that hides the chrome so the grid fills the screen (many staff
  rows). Designed for a normal laptop. Exit to bring the chrome back.
- **PTO is blacked out** on the grid — including future time off, before that week is built. Approve a request
  *or* mark someone off directly with the **PTO checkbox** on the shift editor. The seed shows both (Ashley
  next week, Dana this Wednesday).
- **Holidays** tint + label the column (Settings → Holidays generates the US federal set, observed-day aware —
  July 4, 2026 → observed Friday July 3). Visual only.
- **Carry-forward** — on a shift, "Copy this shift to following days" repeats it through a date in one move.
- **Honest publish status** — a part-published window reads "N/M days published," and publishing with open
  flags now truly **requires a reason** (the old bypass is fixed).
- **Clicking an unbuilt future week** just works (the period is created on save).

**Three bug fixes from Susie's walkthrough:** publish can't skip the flag reason; the nav reopen toggle is a
fixed left-edge tab (never scrolls away); Ask AI confirms the exact person and won't schedule the wrong one.

**Demo QA is now a loop** (see `docs/qa/README.md`): after a demo-affecting change, Claude Code hands Jamison
a CoWork QA prompt; CoWork runs the full demo against this guide + the in-app prompter and files a report in
`docs/qa/`; Claude Code fixes and repeats until clean.

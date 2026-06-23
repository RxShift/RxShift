// The demo prompter script as structured data — the single living source for the
// in-app presenter prompter (/app/demo-prompter) AND the QA run-through. Keep this
// CURRENT whenever a change affects the demo flow (see docs/qa/README.md). It is
// pure data (no server-only) so it can be imported anywhere.
//
// v4.0 (June 22, 2026): Scheduling overhaul — Build mode, carry-forward, PTO
// (blacked-out cells), holidays, locked build cadence + honest publish status,
// and the publish reason-gate fix.
// v4.1 (June 23, 2026): Build mode is now ONE command strip (date nav · view ·
// location · status · Ask AI · publish · ⤢ Exit) — beat 6 reworded to match.
// v4.2 (June 23, 2026): Build vs View split. Demo builds on "Build Schedule"
// (managers, cadence-locked — Optum = month, "Building: <period>"); a separate
// read-only "View Schedule" is for everyone. Copy is "last month's pattern";
// PTO-day-with-shift now shows the red conflict flag.

export const PROMPTER_VERSION = "v4.2";

export interface Beat {
  /** d=direction, s=script, pv=pivot, pause, p=Ask-AI prompt, n=note, cond=condition */
  t: "d" | "s" | "pv" | "pause" | "p" | "n" | "cond";
  v: string;
  /** Expected result, for an Ask AI prompt beat. */
  ex?: string;
}

export interface DiscoveryQuestion {
  q: string;
  sigs: { i: string; d: string }[];
}

export interface Objection {
  q: string;
  a: string;
}

export interface PrompterStep {
  id: number;
  type?: "checklist" | "discovery" | "close";
  act?: string;
  actColor?: string;
  title: string;
  subtitle?: string;
  time?: string;
  tab?: string;
  tabNote?: string;
  /** Only shown in multi-location mode. */
  multiOnly?: boolean;
  beats?: Beat[];
  items?: string[];
  questions?: DiscoveryQuestion[];
  transition?: string;
  closeQ?: string[];
  objections?: Objection[];
  nextStep?: string;
}

export const STEPS: PrompterStep[] = [
  {
    id: 0,
    type: "checklist",
    act: "PRE-DEMO",
    actColor: "#4A6A8A",
    title: "Setup Checklist",
    subtitle: "10 min before — never do this on screen",
    time: "Before call",
    items: [
      "Create 3 Chrome profiles: Admin, Frank, Patricia (top-right corner → profile icon → Add profile)",
      "Admin profile: log in as jamison@jamisonwest.com → Admin Console → find Mesa Vista row → click Edit (not the row)",
      "Admin profile: Restore demo data → Yes (~294 hours finalized)",
      "Admin profile: Demo clock → Pin to 14:30 (persists through reset — set once)",
      "Frank profile: log in → Admin Console → Mesa Vista → Edit → emulate Frank DiMaggio",
      "Frank profile: open /app/board (Tab A), /app/schedule (Tab B), /app/log Henderson (Tab C)",
      "Admin profile, 2nd tab: /app/admin/emails — stay in admin mode, do not emulate",
      "Patricia profile: log in → Admin Console → Mesa Vista → Edit → emulate Patricia Nguyen → /app/me",
      "Confirm green Admin Console banner is gone on Frank + Patricia tabs",
      "Confirm demo data shows it all: Henderson Thu 2–4 PM ceiling, NLV Tue 9–10 AM floor, a blacked-out PTO day on the schedule, and a tinted holiday column",
      "Note: two test tenants in Admin Console (Test Pharmacy 1, Pharmacy Owner) — don't click into them if screen-sharing",
    ],
  },
  {
    id: 1,
    act: "OPENING",
    actColor: "#6B9CC8",
    title: "Set the Stage",
    time: "0:00",
    beats: [
      { t: "d", v: "Don't share screen yet." },
      {
        t: "s",
        v: '"I\'m going to show you three things in about 30 minutes:\n\nOne — the live view. Who\'s on shift right now, and whether you\'re covered.\n\nTwo — how the schedule gets built, and what RxShift does that no other scheduling tool does.\n\nThree — a few supporting features, then we\'ll talk fit and what getting started looks like.\n\nBefore I share my screen — three quick questions."',
      },
    ],
  },
  {
    id: 2,
    type: "discovery",
    act: "DISCOVERY",
    actColor: "#6B9CC8",
    title: "Three Questions",
    time: "0:00–0:03",
    questions: [
      {
        q: "How many locations are you scheduling for right now?",
        sigs: [
          { i: "1 location", d: "Toggle Single location above — multi-location beats will hide." },
          { i: "2+ locations", d: "Keep multi-location mode. Use their location names throughout." },
        ],
      },
      {
        q: "How are you tracking pharmacist-to-tech ratios today — spreadsheet, whiteboard, nothing?",
        sigs: [
          { i: "Excel / Sheets", d: "Compliance Record is the payoff. Build to it hard." },
          { i: "Nothing / mental math", d: "Frame as proactive protection, not remediation." },
        ],
      },
      {
        q: "When was your last board inspection — and did the inspector flag anything around documentation or upcoming regulation changes?",
        sigs: [
          { i: "It was a nightmare", d: "Skip the education. They know the pain. Move faster." },
          { i: "R072-25 / documentation coming", d: "Highest-value prospect. Slow down in Act 2." },
          { i: "Inspector didn't mention regulations", d: "Brief Nevada context before the Compliance Record beat." },
        ],
      },
    ],
  },
  {
    id: 3,
    act: "ACT 1 — LIVE BOARD",
    actColor: "#5B9BD5",
    title: "Live Board",
    time: "0:03–0:08",
    tab: "TAB A",
    tabNote: "Frank · /app/board",
    beats: [
      { t: "d", v: "Share screen now. Frank profile, Tab A." },
      {
        t: "s",
        v: '"This is the Live Board. Who is on shift right now, at this exact minute, at each location — grouped by role.\n\nSpring Valley: \'✓ 2 pharmacists can step away and stay compliant.\' That means two of those three could leave the floor right now and the location stays covered.\n\n[Point to the limit label — reads (4/pharmacist)] You\'ll notice the supervision ceiling is 4 technicians per pharmacist. That reflects Nevada\'s proposed R072-25 rule — still in rulemaking, not yet adopted as law. We\'ve already built it in. When it passes, you\'re already configured. If your state is still on the current 3-to-1 rule, RxShift enforces that too — it\'s a configuration, not a rebuild.\n\n[Point to Open display] This opens the wall-display kiosk — chrome-free, for an always-on monitor at the pharmacy counter."',
      },
      { t: "n", v: "Optionally click Open display briefly, then come back. Board refreshes every 60 seconds." },
    ],
    transition:
      "This is what's happening right now. Let me show you what RxShift builds over time — and why that matters when an inspector walks in.",
  },
  {
    id: 4,
    act: "ACT 1 — LIVE BOARD",
    actColor: "#5B9BD5",
    title: "Dashboard (Brief)",
    time: "0:08–0:10",
    tab: "TAB A",
    tabNote: "Frank · /app/dashboard",
    beats: [
      { t: "d", v: "Navigate to /app/dashboard." },
      {
        t: "s",
        v: '"Quick look at the dashboard. Frank\'s morning overview — health summary, not live status.\n\nEvery stat card is a doorway. Deficient slots jumps straight to the schedule at the exact problem. Every number is clickable.\n\n[Point to Insights] The AI surfaces patterns from the current period — also clickable. I\'ll come back to that."',
      },
    ],
  },
  {
    id: 5,
    act: "ACT 2 — SETTINGS",
    actColor: "#F07C30",
    title: "Settings Tour",
    time: "0:10–0:12",
    tab: "TAB A",
    tabNote: "Frank · /app/settings",
    beats: [
      { t: "d", v: "Navigate to /app/settings." },
      {
        t: "s",
        v: '"Before I show you how the schedule works, let me show you what drives it — because the schedule is only as smart as what you\'ve told it.\n\n[Ratio rules] Nevada: the current cap is 3 techs per pharmacist under NAC 639.250 — or 4 under the proposed R072-25. You configure which rule applies and RxShift enforces it automatically. California has a different formula entirely. You set it once.\n\n[Work types] Dispensing counts toward ratio. Inventory doesn\'t. Meeting doesn\'t. Switch a pharmacist to inventory mid-shift and they stop counting — the ratio adjusts in real time.\n\n[Constraints] Availability rules and hours caps per staff member — a tech off Fridays, a pharmacist capped at 40 hours. These show as amber rings on the schedule before you publish.\n\n[Holidays] You generate the US federal holidays for the year in one click — including the observed day, so when July 4 lands on a Saturday it knows the pharmacy observes Friday the 3rd. You can add or move any of them. They show on the schedule so you can see at a glance who chose to work a holiday."',
      },
      {
        t: "n",
        v: "Build cadence (weekly/biweekly/monthly) and 'Require a reason on PTO' also live here on the Organization tab — mention only if asked.",
      },
    ],
  },
  {
    id: 6,
    act: "ACT 2 — SCHEDULE",
    actColor: "#F07C30",
    title: "Build Schedule",
    time: "0:12–0:17",
    tab: "TAB B",
    tabNote: "Frank · Build Schedule (/app/schedule) → Henderson",
    beats: [
      { t: "d", v: "Switch to Tab B — Build Schedule. Confirm Henderson in the location pill. Note the header: 'Building: <period>' (Optum builds a month at a time)." },
      {
        t: "s",
        v: '"This is Build Schedule — managers only. There\'s a separate read-only View Schedule everyone can see; building lives here. It\'s locked to your build cadence — Optum schedules a month at a time, so the header says \'Building: June 2026\' and the steppers move a month at a time. No fiddling with week vs month while you build.\n\nRows are role-banded — pharmacists on top, technicians below — which mirrors how ratio math works.\n\nTwo ring types, completely separate channels. Red ring with ⚠: a hard conflict — a ratio deficiency, or someone scheduled on their day off. [Scroll to Jerome\'s Saturday] Amber ring: a constraint flag — Jerome\'s 40-hour cap, showing up before you publish.\n\n[Point to a blacked-out PTO cell] Anyone off shows blacked out as PTO — true for time off months out, before the period is even built. [Point to Ashley\'s PTO day with a shift on it] And if someone\'s scheduled on a day they\'re off, that shift gets the red flag.\n\n[Point to a tinted holiday column] Holidays tint the column — a cue, never a block.\n\nTwo ways to build fast: \'Copy last month\'s pattern\' repeats the whole prior period in one click. And on any single shift you can copy it across the following days in one move."',
      },
      {
        t: "d",
        v: "Click Build mode (next to the 'Building: <period>' label). The page chrome collapses into ONE command strip and the grid fills the screen.",
      },
      {
        t: "s",
        v: '"On a normal laptop you want to see as many people as possible at once. Build mode strips everything down to one bar — date nav, the period, location, publish, Ask AI — so the grid shows far more rows. Everything you need is still right there; nothing is buried."',
      },
      {
        t: "n",
        v: "Jerome's amber ring is on Saturday — scroll right. Red ⚠ rings are on Thursday slots (ratio) and Ashley's PTO-day shift. Click ⤢ Exit in the strip (far right) to bring the chrome back before the next beat.",
      },
    ],
  },
  {
    id: 7,
    act: "ACT 2 — SCHEDULE",
    actColor: "#F07C30",
    title: "Ask AI",
    time: "0:17–0:19",
    tab: "TAB B",
    tabNote: "Frank · /app/schedule → Henderson",
    beats: [
      { t: "d", v: "Click the small ✨ Ask AI button to expand it (it sits collapsed to save room)." },
      {
        t: "s",
        v: '"This is the AI assistant — scoped to this location and this week. Not a general chatbot. It knows your actual schedule, your staff, your ratio rules."',
      },
      {
        t: "p",
        v: "Is anything non-compliant coming up this week?",
        ex: "Should surface Henderson Thursday 14:00–16:00 gap + Jerome's 43h overtime. Both.",
      },
      {
        t: "s",
        v: '"Named the exact window. Named the reason. This is the question a managing pharmacist asks every Monday morning. Five seconds.\n\nYou can also give it instructions — \'extend Dr. Patel\'s Thursday shift to 4pm.\' [Let it respond] 09:00–14:00 becomes 09:00–16:00, removes 4 deficient slots. The AI proposes. The engine validates. You decide. Always that order — and it confirms the exact person before it acts, so a name is never matched to the wrong staffer."',
      },
      { t: "n", v: "Show the before→after and compliance impact. Do NOT confirm the extension — dismiss after showing the proposal." },
    ],
  },
  {
    id: 8,
    act: "ACT 2 — THE PIVOT",
    actColor: "#F07C30",
    title: "Publish → Pivot",
    time: "0:19",
    tab: "TAB B",
    tabNote: "Frank · /app/schedule",
    beats: [
      {
        t: "d",
        v: 'Click Next once to NEXT week — it\'s seeded as a draft (the pill reads "Draft — not visible to staff yet"). Show the Publish button + status pill there.',
      },
      {
        t: "s",
        v: '"When the week looks right, you publish. Staff get notified. The status is honest down to the day — if part of the window is live and part is still draft, it says so, e.g. \'5/7 days published.\' And if the schedule carries open flags, publishing requires a reason — it won\'t go through blank.\n\nWhen you publish, two things exist. The Coverage Forecast — the plan, whether you\'re scheduled to be compliant. Useful for planning.\n\nBut that\'s not the artifact you hand an inspector."',
      },
      {
        t: "n",
        v: 'Partial status: switch to the 2-week view to show the pill read "7/14 days published" (this week live, next week draft). Click Publish on the draft week to show the required-reason dialog (open flags) — then Cancel; don\'t actually publish during the demo.',
      },
      { t: "pv", v: "This is." },
      { t: "d", v: "Pause. Let that land. Then switch to Tab C — Compliance Record, Henderson." },
    ],
  },
  {
    id: 9,
    act: "ACT 2 — COMPLIANCE",
    actColor: "#F07C30",
    title: "Compliance Record — Henderson",
    time: "0:19–0:24",
    tab: "TAB C",
    tabNote: "Frank · /app/log → Henderson → Thursday",
    beats: [
      { t: "d", v: "Tab C — Compliance Record. Confirm Henderson is selected. Select Thursday from the date picker." },
      {
        t: "s",
        v: '"This is the Compliance Record. Not a schedule projection. A record of what actually happened — finalized hour by hour as each hour passes, then frozen. Retained two years. Never edited.\n\nEvery operating hour. Named pharmacist. Named techs. Ratio status.\n\n[Scroll through green rows] Compliant hours — ratio met."',
      },
      { t: "pause", v: "Scroll to Thursday 14:00–16:00. Stop. Let them read it." },
      {
        t: "s",
        v: "\"Thursday, 2 to 4 PM. [Read the label aloud] 'DEFICIENT · OVER CEILING — TOO MANY TECHS.' Three technicians on the counter, no pharmacist to supervise them. That's the ceiling violation.\n\n[Point to Frank's annotation] Frank documented the reason right here, on these specific hours — family emergency, float notified immediately, Dr. Fitzgerald on site by 4:00. The explanation is attached to the record. The determination never changes — deficient is deficient — but the context is permanently documented.\n\n[Point to + Note] Any manager can add a note to any hour after the fact. Timestamped, attributed, append-only.\n\n[Show Save as PDF] Official record. Two years, every location, on demand. This is what you hand an inspector.\"",
      },
      { t: "n", v: "Save as PDF opens the browser print dialog — warn them before clicking." },
    ],
  },
  {
    id: 10,
    act: "ACT 2 — COMPLIANCE",
    actColor: "#F07C30",
    title: "Compliance Record — NLV Floor",
    time: "0:24–0:26",
    tab: "TAB C",
    tabNote: "Frank · /app/log → North Las Vegas → Tuesday",
    beats: [
      { t: "d", v: "Switch location dropdown to North Las Vegas. Select Tuesday (Jun 16)." },
      {
        t: "s",
        v: "\"Now look at North Las Vegas, Tuesday 9 to 10 AM. [Read the label] 'DEFICIENT · UNDER FLOOR — UNDERSTAFFED.' One pharmacist. Zero techs on the floor. Rachel Odom called out and nobody covered the slot.\n\nUnder Nevada's proposed R072-25 rule, a solo pharmacist requires at least one tech for support. RxShift is already tracking it. When the rule passes, this becomes a required fix with a documented record. Right now it's a proactive flag.\n\nOne tool. Two kinds of compliance. Over ceiling. Under floor. Both in the record.\"",
      },
      {
        t: "s",
        v: "\"The Coverage Forecast [brief gesture if you want to show it] is the planning sibling — what the schedule projected. Useful for your own ops review. The Compliance Record is the audit.\"",
      },
    ],
  },
  {
    id: 11,
    act: "ACT 2 — EMAIL LOG",
    actColor: "#F07C30",
    title: "Email Log",
    time: "0:26–0:28",
    tab: "ADMIN TAB",
    tabNote: "Admin mode · /app/admin/emails",
    beats: [
      { t: "d", v: "Switch to the Admin profile tab showing /app/admin/emails. Must be in admin mode — NOT emulating anyone." },
      { t: "s", v: '"Every email RxShift sends — schedule notifications, deficiency alerts, request approvals — is logged here."' },
      { t: "d", v: "Click the deficiency alert email to open the rendered HTML view." },
      {
        t: "s",
        v: '"That\'s the deficiency alert that went to Frank when Henderson flagged. Branded, clear, links back to the relevant screen. Nothing goes out that you haven\'t seen."',
      },
      { t: "n", v: "Return to Frank profile for Act 3." },
    ],
  },
  {
    id: 12,
    act: "ACT 3 — FEATURES",
    actColor: "#7FBA8A",
    title: "My Schedule (Staff View)",
    time: "0:28–0:30",
    tab: "PATRICIA",
    tabNote: "Patricia · /app/me",
    beats: [
      { t: "d", v: "Switch to Patricia profile at /app/me." },
      {
        t: "s",
        v: '"This is what a pharmacist sees. Mobile-first.\n\nMy Status Now — she sets her live status at shift start. Feeds into the Live Board.\n\n[Point to step-away indicator — visible while counting] Tells her whether stepping off the floor right now keeps the location compliant. No math. Once she goes non-counting, this line disappears — she\'s already stepped away, there\'s nothing more to warn about.\n\n[Point to work type selector] If she switches to inventory work, her counting status changes and the ratio updates from that moment. The Compliance Record captures that split."',
      },
      { t: "d", v: "Return to Frank profile." },
    ],
  },
  {
    id: 13,
    act: "ACT 3 — FEATURES",
    actColor: "#7FBA8A",
    title: "Requests",
    time: "0:30–0:32",
    tab: "TAB A",
    tabNote: "Frank · /app/requests",
    beats: [
      { t: "d", v: "Frank profile — navigate to /app/requests." },
      {
        t: "s",
        v: '"Time off and callouts come through the app. Here\'s where it gets interesting.\n\n[Navigate to a pending PTO request] Approving this request would create a deficiency. RxShift shows you that impact before you approve — not after. And to approve it anyway, you\'re required to log a reason.\n\n[Show the reason field] That reason goes into the Override Log, permanently. Once approved, the days show blacked out as PTO across the schedule. The pharmacist made a judgment call — the record shows they knew and documented why.\n\nThis is the difference between a compliance tool and a scheduling tool. A scheduling tool lets you approve whatever you want. RxShift makes sure the decision is conscious and documented."',
      },
      { t: "n", v: "Both seeded PTOs trigger a deficiency — great for showing the reason-gate. Neither is a clean approve. (A scheduler can also enter PTO directly from the schedule grid — mention if asked.)" },
    ],
  },
  {
    id: 14,
    multiOnly: true,
    act: "ACT 3 — FEATURES",
    actColor: "#7FBA8A",
    title: "All-Locations View",
    time: "0:32–0:33",
    tab: "TAB B",
    tabNote: "Frank · /app/schedule",
    beats: [
      { t: "cond", v: "MULTI-LOCATION ONLY — hidden in single-location mode" },
      { t: "d", v: "Navigate to /app/schedule — show location pill with all locations." },
      {
        t: "s",
        v: '"If you\'re running multiple locations, one view covers all of them. Friday afternoon check — everything covered before the weekend across the whole group."',
      },
    ],
  },
  {
    id: 15,
    act: "ACT 3 — FEATURES",
    actColor: "#7FBA8A",
    title: "Reports",
    time: "0:33–0:34",
    tab: "TAB A",
    tabNote: "Frank · /app/reports",
    beats: [
      { t: "d", v: "Navigate to /app/reports." },
      {
        t: "s",
        v: '"Four exports: Compliance Record, staff roster, schedule, and full audit log. The Compliance Record export is the as-worked record over whatever date range you need — not a schedule snapshot. The audit log is the complete action trail, and you can append a note to any entry without altering the original."',
      },
    ],
  },
  {
    id: 16,
    act: "CLOSE",
    actColor: "#2E7D5E",
    title: "Pricing",
    time: "0:34–0:35",
    beats: [
      { t: "d", v: "Open rxshift.io/pricing or state from memory." },
      {
        t: "s",
        v: '"One to four locations: $199 a month per location. Five to nine: $169. Ten or more: $149. Annual saves about 17%. No per-seat fees.\n\nMost independents are paying around $120 a month for a general scheduling tool with zero compliance features. RxShift is a step above that — the ratio engine, a two-year Compliance Record of what actually happened, and the documentation you hand an inspector."',
      },
    ],
  },
  {
    id: 17,
    type: "close",
    act: "CLOSE",
    actColor: "#2E7D5E",
    title: "Discovery Close",
    time: "0:35",
    closeQ: [
      "Did anything I showed you not match what you expected or needed?",
      "What would you need to see or know to move forward with a trial?",
    ],
    objections: [
      { q: "How long does setup take?", a: "About an hour per location. Import roster by CSV, AI proposes ratio rules, you confirm. I walk every new customer through their first published schedule." },
      { q: "Can I try with my own data?", a: "Yes. I provision a trial account today — you're in the onboarding wizard in 10 minutes." },
      { q: "Does this work outside Nevada?", a: "Yes. Fixed-ratio states enforce the rule. Professional-judgment states log your staffing reasoning. All 50 states." },
      { q: "Is R072-25 actually passed?", a: "Still in active rulemaking — not yet adopted. The documentation format was built from the proposed rule text. If it passes as written, you're already building the record. If not, the Compliance Record still protects you." },
      { q: "App shows 4/pharmacist, website shows 3 — which is right?", a: "Both are right for their context. Current Nevada law is 3. Proposed R072-25 is 4. App is configured for the proposed rule; website reflects current law. When R072-25 passes, you're already set." },
      { q: "Coverage Forecast vs. Compliance Record?", a: "Coverage Forecast is the plan — are you scheduled to be compliant. Compliance Record is the proof — what actually happened, hour by hour, frozen. You need both." },
    ],
    nextStep:
      '"Here\'s what getting started looks like: I provision your account today. Magic link in your inbox in minutes. Onboarding wizard walks through your locations, imports your roster, proposes ratio rules for your state. I schedule a 30-minute call to walk through your first published schedule together. Should I set that up now?"',
  },
];

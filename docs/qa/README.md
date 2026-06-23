# Demo QA — the run-through loop

The demo prompter is RxShift's QA mission: a full, scripted walkthrough that exercises nearly
every surface. We keep the demo crystallized with a recursive loop between Claude Code (builds +
fixes) and CoWork (independent run-through).

## The loop

1. **Claude Code ships** a change and, if it could affect the demo, ends the session by handing
   Jamison a **CoWork QA prompt** (a ready-to-paste block — see below).
2. **CoWork runs the full demo** in Chrome against the **in-app prompter** (`/app/demo-prompter`,
   always current) using `docs/DEMO-GUIDE.md` + `docs/FEATURE-MAP.md` for ground truth.
3. **CoWork writes a dated report** into this folder (`docs/qa/YYYY-MM-DD-*.md`) — it has repo
   access, so the report lands where Claude Code reads it.
4. **Claude Code validates + fixes** each finding (root cause in code/data/docs, not a patch over
   the script), self-verifies, then hands back an updated CoWork prompt.
5. Repeat until a run-through is clean.

**Why this split:** the agent that builds the demo shouldn't grade it (blind spots). CoWork gives
independent, fresh-eyes QA in a sustained multi-profile browser session; Claude Code owns root-cause
fixes and keeps the prompter/data/docs current. Claude Code does *targeted* verification of a
specific fix here, not the full run-through.

## When Claude Code must hand off a CoWork prompt

After any change that could alter the demo: a schedule/board/compliance/requests/settings surface,
the demo data or seed, a route, the ratio engine's visible output, or the prompter script itself.
(Skip for pure infra, copy-only tweaks, or non-demo internal screens.)

## The CoWork QA prompt (template)

> Run the full RxShift demo as an independent QA pass. App: app.rxshift.io. Sign in as the platform
> admin, open the Admin Console (`/app/admin`) → **Open demo prompter** (pops out `/app/demo-prompter`)
> and follow it step by step. Do the **Setup Checklist** first (restore demo data, pin the demo clock,
> set up the Admin/Frank/Patricia Chrome profiles). For every step, confirm the app matches what the
> prompter says — note any mismatch as: **step #, expected, actual, severity (demo-blocking / cosmetic),
> screenshot**. Pay special attention to anything changed this round: \<list the areas you touched\>.
> Write your findings to `docs/qa/<TODAY>-demo-qa.md` in the repo and summarize back here.

Claude Code fills in the "areas you touched" line each time.

## Report format (what CoWork writes)

```
# Demo QA — YYYY-MM-DD
Run by: CoWork · Build: <git short sha or summary>
## Findings
- [severity] Step N (<screen>): expected … / actual … (screenshot: …)
## Worked as expected
- Step N … (brief)
```

## Archive

| Date | Report | Outcome |
|------|--------|---------|
| 2026-06-19 | `2026-06-19-full-product-demo-qa.md` | Full product + demo + website pass. Fixes in `CHANGELOG.md` ("Pre-QA cleanup"). |

# Spec workflow

Jamison drops feature-spec markdown files (usually drafted in Claude chat)
into `docs/specs/` for Claude Code to ingest and build from.

**The convention:**
1. New specs land in `docs/specs/` — that's the "to build" inbox.
2. Claude Code reads them, reconciles them against the actual codebase
   (chat-drafted specs don't know the real schema/engine), plans, builds.
3. Once implemented, the spec moves to `docs/specs/_archive/`. Archived
   specs are HISTORY, not truth — the code and `CLAUDE.md` are the source
   of truth, and implementations intentionally diverge from specs where
   reality required it (deltas are noted in commit messages and CLAUDE.md).

Archived June 2026: the original marketing-page and kickoff prompts
(built June 11) and the phase-2 trio — website expansion, internal CRM,
Mesa Vista demo tenant (built June 12).

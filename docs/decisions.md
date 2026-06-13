# RxShift — Decision Log

Durable product/scope decisions. Newest first. Code and CLAUDE.md are the
source of truth for *what exists*; this file records *why*.

## June 12, 2026

**Scope boundary (from the Phase 2 amendment, confirmed by Jamison):**
RxShift is a scheduling and ratio-enforcement tool with compliance
logging. It is not a full R113-24 compliance engine. Volume-based
staffing minimums are deferred to a future release. R113-24 is urgency
context in marketing, not a feature checklist. Hourly log + deficiency
flagging + state ratio enforcement + manager streak alerts = the product
today.

**Board containment (Jamison, after Susie's reaction to "we notify the
board" in an early pitch deck):** RxShift NEVER contacts any board of
pharmacy or regulator. The product flags when a board report may be
required and alerts the pharmacy's own managers (in-app + email on a
3-consecutive-deficient-day streak at publish). Whether and how to
report is always the pharmacy's decision. This is contractual (Terms §6)
and enforced in copy across the site and app.

**Tennessee enforcement deferred — contradictory research:** The Phase 2
amendment says TN ratios are 6:1 for non-certified techs with certified
techs uncapped; the original Phase 2 spec (and the live TN page) says
1:2 base expandable to 1:4 with certified techs. Until the actual rule
is verified against the TN board's current language, RxShift ships CPhT
*tracking* (staff.certified, rosters, exports) but NOT cert-dependent
ratio enforcement. The TN page stays "in development."

**California shipped as additive formula:** BPC 4115 (max techs =
2 × pharmacists − 1) is enforced by the engine (`formula='additive'`,
first=1, additional=2), tested, and marketed in present tense.

**Honest-marketing rule (standing):** the website claims only what the
engine actually does; everything else is explicitly "on the roadmap."
Independently arrived at by both the chat-research review and the
codebase review on the same day — treat it as policy.

**Pricing is centralized:** `lib/pricing.ts` is the single source of
price truth. Billing columns on tenant are provider-shaped ('manual'
today); Stripe later implements the same fields + webhooks. Entitlement
enforcement point exists (`isTenantEntitled`) but is permissive until a
payment provider is live.

**Demo tenants:** fictional data only, `is_demo` email gate (redirect to
one inbox or silence), never go live, resettable with date re-anchoring.

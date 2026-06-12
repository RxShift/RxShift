# RxShift Claude Code Kickoff

Paste the block below into Claude Code, in the RxShift repo, after placing the four docs in /docs and setting the environment variables.

---

You are building RxShift, a multi-tenant SaaS for pharmacy workforce scheduling with pharmacist-to-technician ratio and hours compliance. This repo is the clean, isolated home for it. Build it fresh. There is no prior code to carry forward.

Read these in full before writing anything:
- /docs/RxShift-Product-Scoping.md is the build brief. It defines what to build, the boundaries, the data model in the appendix, and a suggested build sequence. It is authoritative for scope.
- /docs/rxshift-infrastructure.md covers accounts, domain, email, deployment architecture, and environment variable names.
- /docs/DESIGN.md and /docs/rxshift-brand-guidelines.html are the design system and brand. Match them for all UI. Use the Schedule Grid mark, the color tokens, Space Grotesk and Inter, and the component patterns defined there.

Stack, per the infrastructure doc: Next.js App Router, Supabase (Postgres, Auth, row-level security), Resend for email, OpenAI for in-product AI called server-side only, Vercel hosting, Cloudflare DNS. One repo, two route groups, (marketing) for the root domain and (app) for app.rxshift.io, with host-based middleware. Auth and redirects live on app.rxshift.io.

Environment variables are set in Vercel and in a local .env.local. Values come from the owner and are never committed. Expect: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL, CRON_SECRET, OPENAI_API_KEY. Never print or commit secrets. Keep .env.local git-ignored.

Non-negotiable guardrails:
- Deterministic logic owns compliance truth. The ratio and rules engine decides compliance. AI may propose, explain, and surface patterns, and a human confirms any compliance-affecting change. AI never silently decides a ratio.
- Tenant isolation via Postgres row-level security on every table.
- No PHI, no compensation data, and no credential data, by design.
- All AI calls and all secrets are server-side only.
- Regulatory accuracy in any marketing copy: describe current Nevada law (NAC 639.250, NRS 639.1371); treat R113-24 as proposed, not adopted; say "designed to support" rather than "compliant with" or "certified for." Do not state RxShift is compliant with any non-final rule.

How to proceed:
1. Read all four docs in full.
2. Propose a build plan and the data model before writing feature code. You decide whether and how to phase the work.
3. Build. Southwest Medical is tenant one and onboards through the wizard. Do not seed data.
4. Wire up Vercel and confirm the deploy pipeline end to end early, before going deep on features.

Begin by confirming you have read the four docs, then outline your plan and the data model for review.

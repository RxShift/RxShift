# RxShift Internal CRM — Feature Spec
**Tag:** [JWC] | **Version:** 1.0 | **Date:** June 2026  
**For:** Claude Code implementation planning

---

## What This Is

A lightweight internal CRM built directly into the RxShift app. Not a third-party integration. Visible only to platform admins. Tracks **sales-qualified interest** — people who raised their hand (form submit, referral, direct contact). Not a prospecting database; no cold contacts loaded.

Initial admin users: Jamison (platform owner) and Susie (using a separate admin-specific email distinct from her Southwest Medical customer login).

---

## What This Is Not

- Not a full outbound sales tool. No bulk email, no sequences, no activity scoring.
- Not a prospecting or lead enrichment database.
- Not accessible to pharmacy customers or end users. Auth is shared infrastructure, but the `/admin/*` section is platform-admin only.

---

## Auth & Role Context

Auth is already implemented in the codebase. The CRM hooks into the existing role system.

- Platform admins have `role = 'admin'` (or equivalent — match whatever the existing codebase uses).
- All `/admin/*` routes are gated by middleware that checks session + role, consistent with however other protected routes are already guarded.
- Pharmacy customer users will eventually exist in the same Supabase auth system but will never have access to `/admin/*`.
- Susie will have two separate auth accounts: one as a Southwest Medical customer user, one as an admin. No shared credentials or dual-role logic needed.

**Do not redesign auth. Just confirm where the role flag lives and extend the existing middleware pattern.**

---

## Database Schema

### Table: `leads`

```sql
create table leads (
  id           uuid primary key default gen_random_uuid(),
  pharmacy_name   text not null,
  location_count  integer,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  source       text check (source in ('LinkedIn', 'referral', 'inbound', 'Susie', 'cold')),
  stage        text check (stage in ('Lead', 'Demo', 'Trial', 'Active', 'Churned')) default 'Lead',
  state        text check (state in ('NV', 'CA', 'other')),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
```

Add a trigger to auto-update `updated_at` on every row change.

### Table: `lead_notes`

Separate table, not a text blob. Allows history without overwriting. Simple enough for two admins; extensible later.

```sql
create table lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid references leads(id) on delete cascade,
  author     text not null,           -- display name, e.g. "Jamison" or "Susie"
  body       text not null,
  created_at timestamptz default now()
);
```

Notes are append-only from the UI. No editing or deleting individual notes (keeps history honest). Admins can add a new note at any time from the lead detail view.

---

## Supabase RLS Policies

### `leads` table
- **Anon / public:** No access. Form submissions go through a Next.js Server Action with the service role key — never a direct client write.
- **Authenticated admin:** Full select, insert, update, delete.
- **Authenticated non-admin:** No access.

### `lead_notes` table
- Same pattern as `leads`.

```sql
-- Example policy pattern (match to existing auth conventions in codebase)
create policy "admins only" on leads
  for all using (
    auth.jwt() ->> 'role' = 'admin'
    -- or: exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    -- match whatever pattern is already in use
  );
```

**Implementation note:** Confirm whether the admin role is stored in Supabase JWT custom claims or in a `profiles` table. Use whichever the existing codebase already uses.

---

## Form Integration

The existing interest/waitlist form (on homepage and pricing page) already:
- Captures contact info
- Sends an email notification to Jamison

**Add to this flow:**
1. After successful form submit, call a Server Action (server-side, service role key).
2. Server Action writes a new row to `leads`:
   - `source = 'inbound'`
   - `stage = 'Lead'`
   - Populate `pharmacy_name`, `contact_name`, `contact_email`, `contact_phone`, `state`, `location_count` from whatever form fields exist.
   - Fields the form doesn't collect: leave null.
3. Server Action writes a first row to `lead_notes`:
   - `author = 'System'`
   - `body = 'Interest form submitted via [page name]. [Any additional context from the form.]'`
4. Existing email send continues unchanged.

**Edge case: duplicate email.** If a lead with the same `contact_email` already exists, do not create a duplicate row. Instead append a note to the existing lead: `"Second form submission received on [date]."` and update `updated_at`. Decide: silently handle or surface to admin as a flag?

---

## Admin UI — `/admin/leads`

### Page: Lead List

- Table view of all leads, newest first.
- Columns: Pharmacy name, Location count, Contact, Stage (badge), Source, State, Last updated.
- Stage badges use the existing RxShift status badge pattern (see DESIGN.md component patterns).
- Click any row to open the lead detail / edit view (can be a slide-over panel or a separate route — `/admin/leads/[id]`).
- "Add Lead" button at top right opens the same form in an empty state.
- Simple text filter at top: filters pharmacy name and contact name client-side.
- No pagination needed at current scale. Add if/when lead count warrants it.

### Panel/Page: Lead Detail & Edit

Two sections:

**1. Lead fields (editable)**  
All fields from the `leads` table. Inline edit or a form. On save: update row, update `updated_at`.

**2. Notes history (append-only)**  
- List of all `lead_notes` for this lead, oldest first.
- Each entry: timestamp, author name, note body.
- Text area at bottom + "Add Note" button to append a new entry.
- Author auto-populated from the current admin session (Jamison or Susie).
- No editing or deleting past notes.

### Page: Add Lead

Same fields as Lead Detail. On submit: insert to `leads`, optionally write a first note (e.g., "Lead added manually by [admin]."). Redirect to the new lead's detail view.

---

## Stage Definitions (for UI copy and future automation)

| Stage | Meaning |
|---|---|
| Lead | Raised hand — form submit, referral mention, or manual entry |
| Demo | Scheduled or completed a demo |
| Trial | Active free trial running |
| Active | Paying customer |
| Churned | Was active, no longer |

---

## Source Definitions

| Source | Meaning |
|---|---|
| inbound | Submitted the interest/waitlist form |
| referral | Someone referred them |
| LinkedIn | Outreach or response via LinkedIn |
| Susie | Susie surfaced them via her pharmacy network |
| cold | Direct outreach, no prior signal |

---

## Design Tokens

Use RxShift DESIGN.md conventions throughout:

- Sidebar nav item for "CRM" or "Leads" under an Admin section label.
- Table: `--color-cloud` header, Inter 13px data cells, `--color-border` row separators.
- Stage badges: map to existing badge pattern — Lead/neutral, Demo/alert, Trial/alert, Active/compliant, Churned/deficiency.
- Add Lead button: primary CTA — Shift Amber, Space Grotesk 700.
- Notes section: Inter 13px, timestamps in Steel (`--color-steel`), `--color-cloud` background per entry.
- Admin-only nav section: can use a subtle label ("Platform Admin") to separate it visually from customer-facing nav items.

---

## Decisions for Claude Code to Confirm Before Building

1. **Role storage location:** Is `role = 'admin'` in Supabase JWT claims, a `profiles` table, or elsewhere? Use the existing pattern, don't introduce a new one.
2. **Duplicate email handling:** Silently merge (append note to existing lead) or flag in UI?
3. **Lead detail UX:** Slide-over panel on same page vs. separate `/admin/leads/[id]` route? Slide-over is faster UX; separate route is simpler to implement and linkable.
4. **Form fields available:** What fields does the current interest form actually collect? Only those can be auto-populated on inbound submit. Confirm before writing the Server Action.
5. **Existing Server Action or API route for the form?** If one already exists for the email send, extend it rather than create a new one.

---

## Out of Scope (explicitly, for now)

- Email sending from CRM
- Lead assignment / ownership beyond Jamison + Susie
- Pipeline analytics or stage conversion reporting
- Import/export
- Integration with any external CRM
- Customer-facing portal or visibility

# RxShift — Operational Scripts

All scripts run with `npx tsx scripts/<name>.ts`. Requires `.env.local` with valid
Supabase credentials (service role key). Run from the repo root.

---

## seed-demo.ts — Seed the OptumRx demo tenant

Seeds the OptumRx Demo tenant: 44 staff (real Optum names, NULL emails), realistic
schedule data, and work-type colors. The tenant has `outbound_email_enabled = false`
— emails are suppressed. Never add real emails to this tenant except Susie's
(allowlist-controlled in /app/admin).

**When to run:** When the OptumRx demo tenant needs to be re-seeded from scratch (e.g.,
after a destructive test or a schema change). Does NOT have a reset flag — it assumes
a clean state.

```bash
npx tsx scripts/seed-demo.ts
```

---

## seed-mesa-vista.ts — Seed or reset the Mesa Vista demo tenant

Seeds the Mesa Vista Pharmacy demo tenant: 3 NV locations (Spring Valley, Henderson,
Summerlin), 14 fictional staff (@mesavistarx.com), 7 date-anchored weekly schedule
periods (automatically re-anchored to the current Monday on each reset), and an
engine-real Henderson Thursday 2–4 PM pharmacist-gap deficiency for demo purposes.

**When to run:**
- First time: seeds the tenant from scratch.
- After Jamison clicks "Restore demo data" in /app/admin (which calls the same logic).
- When you want a fresh state mid-demo.

```bash
npx tsx scripts/seed-mesa-vista.ts          # first seed
npx tsx scripts/seed-mesa-vista.ts --reset  # wipe existing data and re-seed
```

**Demo logins:**
- `demo@rxshift.io` → Frank DiMaggio (owner_admin)
- `jerome@rxshift.io` → Jerome Williams (staff)
- `patricia@rxshift.io` → Dr. Patricia Nguyen (scheduler — Susie's demo identity)

All three aliases deliver to the rxshift.io catch-all → Jamison's inbox.

---

## provision-user.ts — Attach a login to a tenant

Multi-mode provisioning script. Creates an auth user if needed, then creates or updates
the app_user record. Safe to re-run on an existing user (idempotent for the app_user).

**Modes:**

### Standard provisioning — attach login to an existing tenant
```bash
npx tsx scripts/provision-user.ts \
  --email susie@example.com \
  --tenant "OptumRx Demo" \
  --staff "Susan Monahan West" \
  --role owner_admin
```
- `--email` (required) — sign-in address; auth user is created if it doesn't exist
- `--tenant` (required) — tenant UUID or exact tenant name
- `--staff` (optional) — staff UUID or exact `full_name` within that tenant
- `--role` (optional) — `owner_admin | scheduler | supervisor | read_only | staff` (default: `staff`)
- Manager roles (`owner_admin`, `scheduler`, `supervisor`) automatically get PTO-approver rights

### Platform-admin mode — grant cross-tenant admin access
```bash
npx tsx scripts/provision-user.ts \
  --platform-admin \
  --email susie.admin@example.com \
  --note "Susie - co-founder"
  [--tenant "Test Pharmacy 1"]   # optional home tenant, defaults to "Test Pharmacy 1"
```
Creates the auth user + an owner_admin app_user in the home tenant + a platform_admin row.

### Alias mode — add a second sign-in email to an existing account
```bash
npx tsx scripts/provision-user.ts \
  --add-alias work@employer.com \
  --for personal@gmail.com
```
Registers an extra sign-in address. Both emails deliver a magic link into the same account.
`--for` accepts the account's primary email or auth UUID. Refuses collisions with existing
logins or aliases.

### Cleanup mode — delete an orphaned auth user
```bash
npx tsx scripts/provision-user.ts --delete-auth-user <auth-uuid-or-email>
```
Refuses to delete a user that still has an `app_user` or `platform_admin` row (must
offboard through the app first).

---

## seed-live-now.ts — Seed live board status from today's shifts

Seeds `live_status` rows for the OptumRx Demo tenant so the live board shows a believable
pharmacy floor in action. Derives everything from today's real scheduled shifts — no
data is fabricated. Anyone whose shift overlaps the current tenant-timezone clock-minute
gets a realistic status.

**When to run:** Before a demo where you want the live board to look active (not empty).
Safe to re-run mid-demo — closes all open `live_status` rows for the tenant first, then
re-seeds from scratch. The live board auto-refreshes every 60 seconds.

```bash
npx tsx scripts/seed-live-now.ts
```

Target tenant is hardcoded to `"OptumRx Demo"`. To use with Mesa Vista, change `TENANT_NAME`
at the top of the file.

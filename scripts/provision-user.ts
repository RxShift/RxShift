// Provision a login (app_user) into an EXISTING tenant — the admin-side
// counterpart to onboarding, which only ever creates brand-new tenants.
//
// Why this exists: a person who signs in without an app_user row is routed
// to the onboarding wizard and would create a junk tenant. Creating their
// app_user FIRST means they land straight on the dashboard of the right
// pharmacy. Used for testers/demo users who need a role above "staff"
// (roster staff get auto-attached at first sign-in with the staff role).
//
// Usage:
//   npx tsx scripts/provision-user.ts --email susie@example.com \
//     --tenant "OptumRx Demo" --staff "Susan Monahan West" --role owner_admin
//
//   --email   (required) sign-in address; an auth user is created if needed
//   --tenant  (required) tenant id or exact tenant name
//   --staff   (optional) staff id or exact full_name within that tenant
//   --role    (optional) owner_admin | scheduler | supervisor | read_only | staff
//             (default: staff). Manager roles get PTO-approver rights.
//
// Cleanup mode (no provisioning):
//   npx tsx scripts/provision-user.ts --delete-auth-user <auth-user-id-or-email>
//   Refuses to delete a user that still has an app_user or platform_admin row.
//
// Idempotent: re-running with the same email reports the existing account
// and exits without changes (app_user.supabase_user_id is UNIQUE — one
// email = one tenant in v1).

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// ── env ──────────────────────────────────────────────────────────────────────
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── args ─────────────────────────────────────────────────────────────────────
const ROLES = ["owner_admin", "scheduler", "supervisor", "read_only", "staff"] as const;
type Role = (typeof ROLES)[number];
const MANAGER_ROLES: Role[] = ["owner_admin", "scheduler", "supervisor"];

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findAuthUserByEmail(email: string) {
  // listUsers is paginated; small projects fit in one page but loop anyway.
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
    page++;
  }
}

// ── cleanup mode ─────────────────────────────────────────────────────────────
async function deleteAuthUser(idOrEmail: string) {
  const target = UUID_RE.test(idOrEmail)
    ? { id: idOrEmail, email: "(by id)" }
    : await findAuthUserByEmail(idOrEmail.toLowerCase());
  if (!target) {
    console.log(`No auth user found for ${idOrEmail} — nothing to delete.`);
    return;
  }

  const { data: appUser } = await supabase
    .from("app_user").select("id, tenant_id").eq("supabase_user_id", target.id).maybeSingle();
  const { data: admin } = await supabase
    .from("platform_admin").select("supabase_user_id").eq("supabase_user_id", target.id).maybeSingle();
  if (appUser || admin) {
    console.error(
      `REFUSING to delete ${target.id}: it still has ${appUser ? "an app_user" : "a platform_admin"} row. ` +
      "This is a real account, not an orphan."
    );
    process.exit(1);
  }

  const { error } = await supabase.auth.admin.deleteUser(target.id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
  console.log(`Deleted orphan auth user ${target.id} (${target.email ?? idOrEmail}).`);
}

// ── provision mode ───────────────────────────────────────────────────────────
async function provision() {
  const email = getArg("--email")?.toLowerCase().trim();
  const tenantArg = getArg("--tenant");
  const staffArg = getArg("--staff");
  const role = (getArg("--role") ?? "staff") as Role;

  if (!email || !tenantArg) {
    console.error("Required: --email <addr> --tenant <id-or-name> [--staff <id-or-name>] [--role <role>]");
    process.exit(1);
  }
  if (!ROLES.includes(role)) {
    console.error(`--role must be one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  // Resolve tenant
  const tenantQuery = supabase.from("tenant").select("id, name");
  const { data: tenant, error: tErr } = UUID_RE.test(tenantArg)
    ? await tenantQuery.eq("id", tenantArg).maybeSingle()
    : await tenantQuery.eq("name", tenantArg).maybeSingle();
  if (tErr) throw new Error(tErr.message);
  if (!tenant) {
    console.error(`Tenant not found: ${tenantArg}`);
    process.exit(1);
  }

  // Resolve staff (optional)
  let staffId: string | null = null;
  if (staffArg) {
    const staffQuery = supabase.from("staff").select("id, full_name").eq("tenant_id", tenant.id);
    const { data: staff, error: sErr } = UUID_RE.test(staffArg)
      ? await staffQuery.eq("id", staffArg).maybeSingle()
      : await staffQuery.eq("full_name", staffArg).maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!staff) {
      console.error(`Staff not found in "${tenant.name}": ${staffArg}`);
      process.exit(1);
    }
    staffId = staff.id;
    console.log(`Linking to staff: ${staff.full_name} (${staff.id})`);
  }

  // Find or create the auth user. email_confirm:true so magic-link sign-in
  // works immediately (no separate confirmation email).
  let authUser = await findAuthUserByEmail(email);
  if (authUser) {
    console.log(`Auth user exists: ${authUser.id}`);
  } else {
    const { data, error } = await supabase.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw new Error(`createUser failed: ${error.message}`);
    authUser = data.user;
    console.log(`Created auth user: ${authUser.id}`);
  }

  // One email = one tenant (v1): bail out cleanly if already attached.
  const { data: existing } = await supabase
    .from("app_user")
    .select("id, tenant_id, role")
    .eq("supabase_user_id", authUser.id)
    .maybeSingle();
  if (existing) {
    const { data: t } = await supabase
      .from("tenant").select("name").eq("id", existing.tenant_id).maybeSingle();
    console.log(
      `${email} already belongs to "${t?.name ?? existing.tenant_id}" as ${existing.role}. No changes made.`
    );
    return;
  }

  const isManager = MANAGER_ROLES.includes(role);
  const { data: appUser, error: auErr } = await supabase
    .from("app_user")
    .insert({
      supabase_user_id: authUser.id,
      staff_id: staffId,
      tenant_id: tenant.id,
      role,
      is_pto_approver: isManager,
      pto_approver_rank: isManager ? "primary" : null,
    })
    .select("id")
    .single();
  if (auErr) throw new Error(`app_user insert failed: ${auErr.message}`);

  await supabase.from("activity_log").insert({
    tenant_id: tenant.id,
    actor_user_id: authUser.id,
    action: "provision_user",
    entity_type: "app_user",
    entity_id: appUser.id,
    detail: { email, role, staff_id: staffId, via: "scripts/provision-user.ts" },
  });

  console.log(
    `\nDone. ${email} is now ${role} in "${tenant.name}".` +
    `\nThey can sign in with a magic link at /app/login and will land on the dashboard — no setup wizard.`
  );
}

// ── main ─────────────────────────────────────────────────────────────────────
const deleteTarget = getArg("--delete-auth-user");
(deleteTarget ? deleteAuthUser(deleteTarget) : provision()).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

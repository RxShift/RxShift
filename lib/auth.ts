import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AppUser, Tenant } from "@/lib/types";

export interface PlatformState {
  isPlatformAdmin: boolean;
  /** Set when administering a tenant that isn't their own workspace */
  activeTenantId: string | null;
  /** Set when viewing as a specific user */
  emulatingAppUserId: string | null;
  emulatingLabel: string | null; // "Ana Gutierrez (staff)" for the banner
}

export interface SessionContext {
  userId: string;
  email: string;
  appUser: AppUser | null; // null until onboarding creates the tenant
  tenant: Tenant | null;
  platform: PlatformState;
}

const NO_PLATFORM: PlatformState = {
  isPlatformAdmin: false,
  activeTenantId: null,
  emulatingAppUserId: null,
  emulatingLabel: null,
};

// Cached per request — layouts, pages, and actions can all call this freely.
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Platform admin state (RLS: a user can read only their own row)
  const { data: adminRow } = await supabase
    .from("platform_admin")
    .select("*")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  // Emulating a user: the whole session becomes that user's view.
  // RLS already scopes data to them via the helper functions; here we
  // load their app_user + tenant (service role — the emulated row may
  // not be readable under the emulated user's own policies).
  if (adminRow?.emulate_app_user_id) {
    const service = createServiceClient();
    const { data: target } = await service
      .from("app_user")
      .select("*, staff(full_name)")
      .eq("id", adminRow.emulate_app_user_id)
      .maybeSingle();
    if (target) {
      const { data: tenant } = await service
        .from("tenant")
        .select("*")
        .eq("id", target.tenant_id)
        .maybeSingle();
      const staffName =
        (target.staff as { full_name?: string } | null)?.full_name ??
        "unlinked user";
      const appUser = { ...target } as AppUser & { staff?: unknown };
      delete appUser.staff;
      return {
        userId: user.id,
        email: user.email ?? "",
        appUser: appUser as AppUser,
        tenant: tenant as Tenant | null,
        platform: {
          isPlatformAdmin: true,
          activeTenantId: adminRow.active_tenant_id,
          emulatingAppUserId: adminRow.emulate_app_user_id,
          emulatingLabel: `${staffName} (${appUser.role})`,
        },
      };
    }
  }

  // Administering a foreign tenant: synthesize an owner-level membership
  if (adminRow?.active_tenant_id) {
    const service = createServiceClient();
    const { data: tenant } = await service
      .from("tenant")
      .select("*")
      .eq("id", adminRow.active_tenant_id)
      .maybeSingle();
    if (tenant) {
      return {
        userId: user.id,
        email: user.email ?? "",
        appUser: {
          id: `platform:${user.id}`,
          supabase_user_id: user.id,
          staff_id: null,
          tenant_id: tenant.id,
          role: "owner_admin",
          scheduler_scope: null,
          is_pto_approver: false,
          pto_approver_rank: null,
          display_name: null,
          created_at: adminRow.created_at,
        },
        tenant: tenant as Tenant,
        platform: {
          isPlatformAdmin: true,
          activeTenantId: adminRow.active_tenant_id,
          emulatingAppUserId: null,
          emulatingLabel: null,
        },
      };
    }
  }

  // Normal path: the user's own workspace
  const { data: appUser } = await supabase
    .from("app_user")
    .select("*")
    .eq("supabase_user_id", user.id)
    .maybeSingle();

  let tenant: Tenant | null = null;
  if (appUser) {
    const { data } = await supabase
      .from("tenant")
      .select("*")
      .eq("id", appUser.tenant_id)
      .maybeSingle();
    tenant = data;
  }

  return {
    userId: user.id,
    email: user.email ?? "",
    appUser: appUser as AppUser | null,
    tenant,
    platform: adminRow ? { ...NO_PLATFORM, isPlatformAdmin: true } : NO_PLATFORM,
  };
});

const WRITE_ROLES = ["owner_admin", "scheduler", "supervisor"];

export function canManage(appUser: AppUser | null): boolean {
  return !!appUser && WRITE_ROLES.includes(appUser.role);
}

export function isAdmin(appUser: AppUser | null): boolean {
  return appUser?.role === "owner_admin";
}

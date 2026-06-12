import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Tenant } from "@/lib/types";

export interface SessionContext {
  userId: string;
  email: string;
  appUser: AppUser | null; // null until onboarding creates the tenant
  tenant: Tenant | null;
}

// Cached per request — layouts, pages, and actions can all call this freely.
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
  };
});

const WRITE_ROLES = ["owner_admin", "scheduler", "supervisor"];

export function canManage(appUser: AppUser | null): boolean {
  return !!appUser && WRITE_ROLES.includes(appUser.role);
}

export function isAdmin(appUser: AppUser | null): boolean {
  return appUser?.role === "owner_admin";
}

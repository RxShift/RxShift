import "server-only";
import { revalidatePath } from "next/cache";
import { getSession, type SessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export class ActionError extends Error {}

/**
 * A schedule change ripples into every schedule-derived view. Revalidate them
 * all so live presence (My Schedule / "My Status Now"), the Live Board, the
 * wall display, the compliance record, and the dashboard never show stale data
 * after a shift edit. (Previously only /app/schedule was revalidated — so e.g.
 * extending a shift never updated My Status Now.) Call from any server action
 * that creates, edits, deletes, reassigns, or removes a shift.
 */
export function revalidateScheduleViews() {
  for (const p of [
    "/app/schedule",
    "/app/me",
    "/app/board",
    "/app/display",
    "/app/log",
    "/app/dashboard",
  ]) {
    revalidatePath(p);
  }
}

export interface AuthedContext extends SessionContext {
  appUser: NonNullable<SessionContext["appUser"]>;
  tenant: NonNullable<SessionContext["tenant"]>;
  tenantId: string;
}

async function requireSession(): Promise<AuthedContext> {
  const session = await getSession();
  if (!session?.appUser || !session.tenant) {
    throw new ActionError("Not signed in to a workspace.");
  }
  return {
    ...session,
    appUser: session.appUser,
    tenant: session.tenant,
    tenantId: session.appUser.tenant_id,
  };
}

export async function requireMember(): Promise<AuthedContext> {
  return requireSession();
}

export async function requireManager(): Promise<AuthedContext> {
  const ctx = await requireSession();
  if (!["owner_admin", "scheduler", "supervisor"].includes(ctx.appUser.role)) {
    throw new ActionError("You don't have permission to do that.");
  }
  return ctx;
}

export async function requireAdmin(): Promise<AuthedContext> {
  const ctx = await requireSession();
  if (ctx.appUser.role !== "owner_admin") {
    throw new ActionError("Only an Owner/Admin can do that.");
  }
  return ctx;
}

/** Platform-admin gate (RxShift operators). Does NOT require a tenant context. */
export async function requirePlatformAdmin(): Promise<SessionContext> {
  const session = await getSession();
  if (!session?.platform.isPlatformAdmin) {
    throw new ActionError("Platform admin access required.");
  }
  return session;
}

/** Append-only activity trail. Best-effort — never blocks the action. */
export async function logActivity(
  ctx: AuthedContext,
  action: string,
  entityType: string,
  entityId: string | null,
  detail?: Record<string, unknown>
) {
  try {
    const supabase = await createClient();
    await supabase.from("activity_log").insert({
      tenant_id: ctx.tenantId,
      actor_user_id: ctx.userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      detail: detail ?? null,
    });
  } catch {
    // logging must never break the user action
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/** Wrap an action body: ActionError → friendly message, rest → generic. */
export async function runAction<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ActionError) return { ok: false, error: e.message };
    console.error("Action failed:", e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

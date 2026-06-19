import { createClient } from "@/lib/supabase/server";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import AuditLog, { type AuditEntry } from "@/components/app/log/audit-log";
import type { ActivityLog, ActivityLogNote } from "@/lib/types";

export default async function AuditLogPage() {
  const supabase = await createClient();

  // activity_log select is manager-only by RLS, so a non-manager simply sees
  // an empty record here.
  const { data: logs } = await supabase
    .from("activity_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const entries = (logs ?? []) as ActivityLog[];
  const ids = entries.map((e) => e.id);

  const [{ data: users }, { data: staff }, { data: notes }] = await Promise.all([
    supabase.from("app_user").select("supabase_user_id, staff_id, role, display_name"),
    supabase.from("staff").select("id, full_name"),
    ids.length
      ? supabase
          .from("activity_log_note")
          .select("*")
          .in("activity_log_id", ids)
          .order("created_at")
      : Promise.resolve({ data: [] as ActivityLogNote[] }),
  ]);

  // Resolve actor user ids → a readable name.
  const staffName = new Map(
    ((staff ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ])
  );
  const actorName = new Map<string, string>();
  for (const u of (users ?? []) as {
    supabase_user_id: string;
    staff_id: string | null;
    role: string;
    display_name: string | null;
  }[]) {
    actorName.set(
      u.supabase_user_id,
      (u.staff_id && staffName.get(u.staff_id)) || u.display_name || u.role || "User"
    );
  }
  const nameFor = (id: string | null) =>
    id ? (actorName.get(id) ?? "User") : "System";

  const notesByLog = new Map<string, ActivityLogNote[]>();
  for (const n of (notes ?? []) as ActivityLogNote[]) {
    const list = notesByLog.get(n.activity_log_id) ?? [];
    list.push(n);
    notesByLog.set(n.activity_log_id, list);
  }

  const rows: AuditEntry[] = entries.map((e) => ({
    id: e.id,
    created_at: e.created_at,
    actor: nameFor(e.actor_user_id),
    action: e.action,
    entity_type: e.entity_type,
    entity_id: e.entity_id,
    reason:
      e.detail && typeof e.detail.override_reason === "string"
        ? (e.detail.override_reason as string)
        : null,
    detail: e.detail,
    notes: (notesByLog.get(e.id) ?? []).map((n) => ({
      id: n.id,
      note: n.note,
      created_at: n.created_at,
      author: nameFor(n.author_user_id),
    })),
  }));

  return (
    <>
      <PageHeader title="Audit Log" />
      <div className="flex-1 p-8">
        <div className="max-w-[1000px]">
          <p className="mb-6 max-w-[680px] font-body text-sm leading-relaxed text-steel">
            A complete, append-only record of every action in RxShift — schedule
            edits, approvals, publishes, imports, role changes, AI-applied
            operations. Entries are <strong>never edited or deleted</strong>. If
            something needs context (e.g. a pharmacist forgot to clock back from
            lunch), add a note — the original stays exactly as it was. This is the
            comprehensive action trail; the{" "}
            <a href="/app/log" className="underline">
              Compliance Record
            </a>{" "}
            is the auditor&rsquo;s hourly staffing record.
          </p>
          {rows.length === 0 ? (
            <EmptyState message="No activity recorded yet." />
          ) : (
            <AuditLog entries={rows} />
          )}
        </div>
      </div>
    </>
  );
}

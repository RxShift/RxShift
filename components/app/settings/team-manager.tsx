"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { HelpText, Label, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { updateAppUser } from "@/lib/actions/settings";
import type { AppRole, AppUser, Department, Staff } from "@/lib/types";

const ROLE_LABELS: Record<AppRole, string> = {
  owner_admin: "Owner / Admin",
  scheduler: "Scheduler",
  supervisor: "Approver / Supervisor",
  read_only: "Read-only",
  staff: "Staff",
};

export default function TeamManager({
  users,
  staff,
  departments,
}: {
  users: AppUser[];
  staff: Staff[];
  departments: Department[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [role, setRole] = useState<AppRole>("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const staffFor = (u: AppUser) => staff.find((s) => s.id === u.staff_id);

  function startEdit(u: AppUser) {
    setRole(u.role);
    setError(null);
    setEditing(u);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const scope = departments
      .filter((d) => form.get(`dept-${d.id}`) === "on")
      .map((d) => d.id);
    const isApprover = form.get("is_pto_approver") === "on";
    const result = await updateAppUser(editing.id, {
      role,
      scheduler_scope: role === "scheduler" && scope.length > 0 ? scope : null,
      is_pto_approver: isApprover,
      pto_approver_rank: isApprover
        ? (form.get("pto_approver_rank") as string)
        : null,
    });
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  if (users.length === 0) {
    return (
      <EmptyState message="No sign-ins yet. Accounts appear here after someone signs in with a login email on the staff roster." />
    );
  }

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            <Th>Role</Th>
            <Th>PTO approver</Th>
            <Th className="w-16"> </Th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const s = staffFor(u);
            return (
              <Tr key={u.id}>
                <Td className="font-medium">
                  {s?.full_name ?? "(no staff record)"}
                  {s?.login_email && (
                    <span className="ml-2 font-body text-xs text-steel">
                      {s.login_email}
                    </span>
                  )}
                </Td>
                <Td>{ROLE_LABELS[u.role]}</Td>
                <Td>
                  {u.is_pto_approver ? (
                    <Badge tone={u.pto_approver_rank === "primary" ? "compliant" : "neutral"}>
                      {u.pto_approver_rank === "primary" ? "Primary" : "Backup"}
                    </Badge>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td>
                  <button
                    onClick={() => startEdit(u)}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                </Td>
              </Tr>
            );
          })}
        </tbody>
      </Table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit ${staffFor(editing ?? ({} as AppUser))?.full_name ?? "user"}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="team-form" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        {editing && (
          <form id="team-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
              >
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>

            {role === "scheduler" && departments.length > 0 && (
              <div>
                <Label>Scheduler scope (optional)</Label>
                <div className="space-y-1.5">
                  {departments.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 font-body text-sm text-navy"
                    >
                      <input
                        type="checkbox"
                        name={`dept-${d.id}`}
                        defaultChecked={editing.scheduler_scope?.includes(d.id)}
                        className="h-4 w-4 accent-amber"
                      />
                      {d.name}
                    </label>
                  ))}
                </div>
                <HelpText>
                  Leave all unchecked to allow scheduling everywhere.
                </HelpText>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="is_pto_approver"
                name="is_pto_approver"
                defaultChecked={editing.is_pto_approver}
                className="h-4 w-4 accent-amber"
              />
              <label htmlFor="is_pto_approver" className="font-body text-sm text-navy">
                PTO approver
              </label>
            </div>

            <div>
              <Label htmlFor="pto_approver_rank">Approver rank</Label>
              <Select
                id="pto_approver_rank"
                name="pto_approver_rank"
                defaultValue={editing.pto_approver_rank ?? "backup"}
              >
                <option value="primary">Primary</option>
                <option value="backup">Backup</option>
              </Select>
            </div>

            {error && <p className="font-body text-sm text-[#C0392B]">{error}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}

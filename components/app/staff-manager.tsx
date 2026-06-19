"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { HelpText, Input, Label, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { createStaff, offboardStaff, updateStaff } from "@/lib/actions/staff";
import { updateAppUser } from "@/lib/actions/settings";
import Avatar from "@/components/app/avatar";
import AvatarUpload from "@/components/app/avatar-upload";
import type { AppRole, AppUser, Location, RatioType, Staff } from "@/lib/types";

const RATIO_LABELS: Record<RatioType, string> = {
  pharmacist: "Pharmacist",
  technician: "Technician",
  non_counting: "Never counts",
};

const EMPLOYMENT_LABELS = {
  full_time: "Full-time",
  part_time: "Part-time",
  per_diem: "Per-diem",
  contractor_1099: "1099 contractor",
} as const;

const ROLE_LABELS: Record<AppRole, string> = {
  owner_admin: "Owner / Admin",
  scheduler: "Scheduler",
  supervisor: "Supervisor",
  read_only: "Read-only",
  staff: "Staff",
};

export default function StaffManager({
  staff,
  locations,
  appUsers,
  canEditRoles,
  avatarUrls,
}: {
  staff: Staff[];
  locations: Location[];
  appUsers: AppUser[];
  canEditRoles: boolean;
  avatarUrls: Record<string, string>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [confirmOffboard, setConfirmOffboard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = staff.filter((s) => showInactive || s.active);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const values = {
      full_name: form.get("full_name"),
      login_email: (form.get("login_email") as string) || null,
      work_email: (form.get("work_email") as string) || null,
      job_title: (form.get("job_title") as string) || null,
      ratio_type: form.get("ratio_type"),
      staff_type: form.get("staff_type"),
      employment_type: form.get("employment_type"),
      home_location_id: (form.get("home_location_id") as string) || null,
      certified: form.get("certified") === "on",
      active: form.get("active") === "on",
    };
    const result =
      editing === "new"
        ? await createStaff(values)
        : await updateStaff((editing as Staff).id, values);

    // If this person has a sign-in, save their role/approver settings too
    let roleError: string | null = null;
    const account =
      editing !== "new" && editing !== null
        ? appUsers.find((u) => u.staff_id === editing.id)
        : undefined;
    if (result.ok && account && canEditRoles) {
      const isApprover = form.get("is_pto_approver") === "on";
      const roleResult = await updateAppUser(account.id, {
        role: form.get("app_role"),
        is_pto_approver: isApprover,
        pto_approver_rank: isApprover
          ? ((form.get("pto_approver_rank") as string) || "primary")
          : null,
      });
      if (!roleResult.ok) roleError = roleResult.error;
    }

    if (result.ok && !roleError) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.ok ? roleError : result.error);
    }
    setBusy(false);
  }

  const initial = editing !== null && editing !== "new" ? editing : null;
  const initialAccount = initial
    ? appUsers.find((u) => u.staff_id === initial.id)
    : undefined;

  return (
    <div className="max-w-[1040px]">
      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 font-body text-sm text-steel">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 accent-amber"
          />
          Show deactivated
        </label>
        <div className="flex gap-3">
          <Link href="/app/settings/import">
            <Button variant="secondary">Import CSV</Button>
          </Link>
          <Button onClick={() => setEditing("new")}>Add Person</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message="No staff yet. Add people one at a time, or import your whole roster from a CSV in one step."
          action={<Button onClick={() => setEditing("new")}>Add Person</Button>}
        />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Counts as</Th>
              <Th>Title</Th>
              <Th>Employment</Th>
              <Th>Home location</Th>
              <Th>Status</Th>
              <Th className="w-16"> </Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <Tr key={s.id}>
                <Td className="font-medium">
                  <div className="flex items-center gap-2.5">
                    <Avatar url={avatarUrls[s.id]} name={s.full_name} size={30} />
                    <span>{s.full_name}</span>
                  </div>
                  {s.login_email && (
                    <div className="mt-0.5 pl-[42px] font-body text-xs text-steel">
                      {s.login_email}
                      {(() => {
                        const acct = appUsers.find((u) => u.staff_id === s.id);
                        return acct
                          ? ` · ${ROLE_LABELS[acct.role as AppRole]}`
                          : "";
                      })()}
                    </div>
                  )}
                </Td>
                <Td>
                  <Badge
                    tone={
                      s.ratio_type === "pharmacist"
                        ? "compliant"
                        : s.ratio_type === "technician"
                          ? "alert"
                          : "neutral"
                    }
                  >
                    {RATIO_LABELS[s.ratio_type]}
                  </Badge>
                  {s.staff_type === "tech_in_training" && (
                    <span className="ml-1.5 font-body text-[10px] font-bold text-steel">
                      In training
                    </span>
                  )}
                  {s.certified && (
                    <span className="ml-1.5 font-body text-[10px] font-bold text-steel">
                      CPhT
                    </span>
                  )}
                </Td>
                <Td>{s.job_title ?? "—"}</Td>
                <Td>{EMPLOYMENT_LABELS[s.employment_type]}</Td>
                <Td>
                  {locations.find((l) => l.id === s.home_location_id)?.name ??
                    "—"}
                </Td>
                <Td>
                  <Badge tone={s.active ? "compliant" : "neutral"}>
                    {s.active ? "Active" : "Inactive"}
                  </Badge>
                </Td>
                <Td>
                  <button
                    onClick={() => {
                      setConfirmOffboard(false);
                      setError(null);
                      setEditing(s);
                    }}
                    className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Edit
                  </button>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editing !== null}
        onClose={() => {
          setConfirmOffboard(false);
          setEditing(null);
        }}
        title={editing === "new" ? "Add person" : `Edit ${initial?.full_name}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form="staff-form" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id="staff-form" onSubmit={handleSubmit} className="space-y-4">
          {initial && (
            <AvatarUpload
              staffId={initial.id}
              fullName={initial.full_name}
              currentUrl={avatarUrls[initial.id]}
            />
          )}
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              name="full_name"
              required
              defaultValue={initial?.full_name ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="login_email">Login email</Label>
              <Input
                id="login_email"
                name="login_email"
                type="email"
                defaultValue={initial?.login_email ?? ""}
              />
              <HelpText>
                How they sign in — their account is created automatically the
                first time they sign in with this address. Extra sign-in
                addresses (like a personal email for home) can be added on
                request.
              </HelpText>
            </div>
            <div>
              <Label htmlFor="work_email">Work email</Label>
              <Input
                id="work_email"
                name="work_email"
                type="email"
                defaultValue={initial?.work_email ?? ""}
              />
              <HelpText>Where notifications go.</HelpText>
            </div>
          </div>

          {editing !== "new" && (
            <div className="rounded-lg border border-line bg-cloud/50 p-4">
              <p className="font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                Sign-in &amp; role
              </p>
              {initialAccount ? (
                canEditRoles ? (
                  <div className="mt-3 flex flex-wrap items-end gap-4">
                    <div className="w-44">
                      <Label htmlFor="app_role">Role</Label>
                      <Select
                        id="app_role"
                        name="app_role"
                        defaultValue={initialAccount.role}
                      >
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex items-center gap-2.5 pb-2.5">
                      <input
                        type="checkbox"
                        id="is_pto_approver"
                        name="is_pto_approver"
                        defaultChecked={initialAccount.is_pto_approver}
                        className="h-4 w-4 accent-amber"
                      />
                      <label
                        htmlFor="is_pto_approver"
                        className="font-body text-sm text-navy"
                      >
                        PTO approver
                      </label>
                    </div>
                    <div className="w-36">
                      <Label htmlFor="pto_approver_rank">Approver rank</Label>
                      <Select
                        id="pto_approver_rank"
                        name="pto_approver_rank"
                        defaultValue={initialAccount.pto_approver_rank ?? "primary"}
                      >
                        <option value="primary">Primary</option>
                        <option value="backup">Backup</option>
                      </Select>
                    </div>
                  </div>
                ) : (
                  <p className="mt-2 font-body text-sm text-steel">
                    {ROLE_LABELS[initialAccount.role as AppRole]}
                    {initialAccount.is_pto_approver ? " · PTO approver" : ""} —
                    only an Owner/Admin can change roles.
                  </p>
                )
              ) : (
                <p className="mt-2 font-body text-sm text-steel">
                  No sign-in yet. They&rsquo;ll appear here automatically the
                  first time they sign in with the login email above, and you
                  can adjust their role then.
                </p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ratio_type">Counts as</Label>
              <Select
                id="ratio_type"
                name="ratio_type"
                defaultValue={initial?.ratio_type ?? "technician"}
              >
                <option value="pharmacist">Pharmacist</option>
                <option value="technician">Technician</option>
                <option value="non_counting">
                  Never counts (cashier, driver, clerk)
                </option>
              </Select>
            </div>
            <div>
              <Label htmlFor="job_title">Job title (label only)</Label>
              <Input
                id="job_title"
                name="job_title"
                defaultValue={initial?.job_title ?? ""}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="staff_type">Role type</Label>
            <Select
              id="staff_type"
              name="staff_type"
              defaultValue={initial?.staff_type ?? "tech"}
            >
              <option value="pharmacist">Pharmacist</option>
              <option value="tech">Technician</option>
              <option value="tech_in_training">Technician in training</option>
            </Select>
            <HelpText>
              &ldquo;Counts as&rdquo; above decides whether this person counts
              toward the ratio. This sets the specific role — mark technicians
              in training here so Nevada R072-25&rsquo;s trainee sublimit (2
              techs + 2 trainees per pharmacist) is applied when that toggle is
              on.
            </HelpText>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="employment_type">Employment</Label>
              <Select
                id="employment_type"
                name="employment_type"
                defaultValue={initial?.employment_type ?? "full_time"}
              >
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="home_location_id">Home location</Label>
              <Select
                id="home_location_id"
                name="home_location_id"
                defaultValue={initial?.home_location_id ?? ""}
              >
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="certified"
              name="certified"
              defaultChecked={initial?.certified ?? false}
              className="h-4 w-4 accent-amber"
            />
            <label htmlFor="certified" className="font-body text-sm text-navy">
              Certified (CPhT) — shown on rosters and compliance exports
            </label>
          </div>
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="active"
              name="active"
              defaultChecked={initial?.active ?? true}
              className="h-4 w-4 accent-amber"
            />
            <label htmlFor="active" className="font-body text-sm text-navy">
              Active — can be scheduled (re-activating also restores sign-in)
            </label>
          </div>

          {initial && initial.active && canEditRoles && (
            <div className="border-t border-line pt-4">
              {!confirmOffboard ? (
                <button
                  type="button"
                  onClick={() => setConfirmOffboard(true)}
                  className="font-body text-sm font-medium text-deficiency underline-offset-2 hover:underline"
                >
                  Offboard {initial.full_name}…
                </button>
              ) : (
                <div className="rounded-md border border-deficiency/30 bg-deficiency-bg p-4">
                  <p className="font-body text-sm text-navy">
                    <strong>No longer with the pharmacy?</strong> Offboarding
                    removes {initial.full_name} from scheduling and the live
                    board and blocks their sign-in. Every past schedule, log,
                    and Compliance Record keeps their name. Reversible by
                    re-activating them later.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        const result = await offboardStaff(initial.id);
                        if (result.ok) {
                          setConfirmOffboard(false);
                          setEditing(null);
                          router.refresh();
                        } else {
                          setError(result.error);
                        }
                        setBusy(false);
                      }}
                    >
                      Offboard
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => setConfirmOffboard(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {error && <p className="font-body text-sm text-deficiency">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

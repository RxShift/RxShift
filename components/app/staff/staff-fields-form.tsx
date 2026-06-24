"use client";

// The core staff fields, extracted so the "Add Person" modal AND the full staff
// record panel (slide-over) share ONE form. Self-contained: it owns its busy/error
// state and its Save button, and calls onSaved() after a successful write. The
// record panel composes this alongside the constraints + rules sections, each of
// which saves independently.

import { useState } from "react";
import Button from "@/components/ui/button";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/form";
import { createStaff, offboardStaff, updateStaff } from "@/lib/actions/staff";
import { updateAppUser } from "@/lib/actions/settings";
import AvatarUpload from "@/components/app/avatar-upload";
import type { AppRole, AppUser, Location, Staff } from "@/lib/types";

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

export default function StaffFieldsForm({
  initial,
  initialAccount,
  locations,
  canEditRoles,
  avatarUrl,
  onSaved,
  onCancel,
  saveLabel,
}: {
  /** null = creating a new person; a Staff = editing. */
  initial: Staff | null;
  initialAccount: AppUser | null;
  locations: Location[];
  canEditRoles: boolean;
  avatarUrl?: string;
  onSaved: () => void;
  onCancel?: () => void;
  saveLabel?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOffboard, setConfirmOffboard] = useState(false);

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
      scheduling_notes: (form.get("scheduling_notes") as string) || null,
      excluded_from_ratio: form.get("excluded_from_ratio") === "on",
      active: form.get("active") === "on",
    };
    const result = initial
      ? await updateStaff(initial.id, values)
      : await createStaff(values);

    // If this person has a sign-in, save their role/approver settings too.
    let roleError: string | null = null;
    if (result.ok && initial && initialAccount && canEditRoles) {
      const isApprover = form.get("is_pto_approver") === "on";
      const roleResult = await updateAppUser(initialAccount.id, {
        role: form.get("app_role"),
        is_pto_approver: isApprover,
        pto_approver_rank: isApprover
          ? ((form.get("pto_approver_rank") as string) || "primary")
          : null,
      });
      if (!roleResult.ok) roleError = roleResult.error;
    }

    setBusy(false);
    if (result.ok && !roleError) {
      onSaved();
    } else {
      setError(result.ok ? roleError : result.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {initial && (
        <AvatarUpload
          staffId={initial.id}
          fullName={initial.full_name}
          currentUrl={avatarUrl}
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
            How they sign in — their account is created automatically the first
            time they sign in with this address.
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

      {initial && (
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
                {initialAccount.is_pto_approver ? " · PTO approver" : ""} — only
                an Owner/Admin can change roles.
              </p>
            )
          ) : (
            <p className="mt-2 font-body text-sm text-steel">
              No sign-in yet. They&rsquo;ll appear here automatically the first
              time they sign in with the login email above.
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
          &ldquo;Counts as&rdquo; decides whether this person counts toward the
          ratio. This sets the specific role — mark technicians in training so
          Nevada R072-25&rsquo;s trainee sublimit applies when that toggle is on.
        </HelpText>
      </div>

      <div>
        <Label htmlFor="scheduling_notes">Scheduling notes</Label>
        <Textarea
          id="scheduling_notes"
          name="scheduling_notes"
          rows={3}
          defaultValue={initial?.scheduling_notes ?? ""}
          placeholder="Free text — preferences, strengths, what NOT to assign. e.g. &quot;Clinically strong. Not suited for audit or ticket confirmation. Prefers morning starts.&quot;"
        />
        <HelpText>Shown on this record and in the schedule builder tooltip.</HelpText>
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

      <div className="rounded-lg border border-line bg-cloud/50 p-3">
        <div className="flex items-center gap-2.5">
          <input
            type="checkbox"
            id="excluded_from_ratio"
            name="excluded_from_ratio"
            defaultChecked={initial?.excluded_from_ratio ?? false}
            className="h-4 w-4 accent-amber"
          />
          <label
            htmlFor="excluded_from_ratio"
            className="font-body text-sm font-medium text-navy"
          >
            Exclude from ratio calculations
          </label>
        </div>
        <HelpText>
          Physically present but never counted toward the pharmacist-to-tech
          ratio — supervisors, procurement, billing. Keeps their pharmacist/
          technician role; the compliance engine simply skips them.
        </HelpText>
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
                <strong>No longer with the pharmacy?</strong> Offboarding removes{" "}
                {initial.full_name} from scheduling and the live board and blocks
                their sign-in. Every past schedule, log, and Compliance Record
                keeps their name. Reversible by re-activating them later.
              </p>
              <div className="mt-3 flex gap-3">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const result = await offboardStaff(initial.id);
                    setBusy(false);
                    if (result.ok) {
                      setConfirmOffboard(false);
                      onSaved();
                    } else {
                      setError(result.error);
                    }
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

      <div className="flex justify-end gap-3 border-t border-line pt-4">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : (saveLabel ?? "Save changes")}
        </Button>
      </div>
    </form>
  );
}

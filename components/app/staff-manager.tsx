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
import { createStaff, updateStaff } from "@/lib/actions/staff";
import type { Location, RatioType, Staff } from "@/lib/types";

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

export default function StaffManager({
  staff,
  locations,
}: {
  staff: Staff[];
  locations: Location[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Staff | "new" | null>(null);
  const [showInactive, setShowInactive] = useState(false);
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
      employment_type: form.get("employment_type"),
      home_location_id: (form.get("home_location_id") as string) || null,
      active: form.get("active") === "on",
    };
    const result =
      editing === "new"
        ? await createStaff(values)
        : await updateStaff((editing as Staff).id, values);
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  const initial = editing !== null && editing !== "new" ? editing : null;

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
                  {s.full_name}
                  {s.login_email && (
                    <div className="font-body text-xs text-steel">
                      {s.login_email}
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
                    onClick={() => setEditing(s)}
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
        onClose={() => setEditing(null)}
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
              <HelpText>How they sign in.</HelpText>
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
              id="active"
              name="active"
              defaultChecked={initial?.active ?? true}
              className="h-4 w-4 accent-amber"
            />
            <label htmlFor="active" className="font-body text-sm text-navy">
              Active (can be scheduled and can sign in)
            </label>
          </div>
          {error && <p className="font-body text-sm text-[#C0392B]">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import SlideOver from "@/components/ui/slide-over";
import { EmptyState } from "@/components/ui/page-header";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import Avatar from "@/components/app/avatar";
import StaffFieldsForm from "@/components/app/staff/staff-fields-form";
import StaffRecordPanel from "@/components/app/staff/staff-record-panel";
import type { AppRole, AppUser, Location, RatioType, Staff, TimeFormat } from "@/lib/types";

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
  timeFormat = "12h",
}: {
  staff: Staff[];
  locations: Location[];
  appUsers: AppUser[];
  canEditRoles: boolean;
  avatarUrls: Record<string, string>;
  timeFormat?: TimeFormat;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [creating, setCreating] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  const visible = staff.filter((s) => showInactive || s.active);

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
          <Button onClick={() => setCreating(true)}>Add Person</Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          message="No staff yet. Add people one at a time, or import your whole roster from a CSV in one step."
          action={<Button onClick={() => setCreating(true)}>Add Person</Button>}
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
                  {s.excluded_from_ratio && (
                    <span className="ml-1.5 font-body text-[10px] font-bold text-steel">
                      Excluded
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

      {/* Add Person — a simple create; constraints + rules attach after the person
          exists (edit opens the full record). */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add person"
      >
        <StaffFieldsForm
          initial={null}
          initialAccount={null}
          locations={locations}
          canEditRoles={canEditRoles}
          saveLabel="Add person"
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      {/* Edit — the full staff record (notes, ratio flag, constraints, rules). */}
      <SlideOver
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? editing.full_name : "Staff record"}
        subtitle="Notes, constraints, scheduling rules, and availability"
        width="wide"
        footer={
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Close
          </Button>
        }
      >
        {editing && (
          <StaffRecordPanel
            staffId={editing.id}
            avatarUrl={avatarUrls[editing.id]}
            timeFormat={timeFormat}
            onChanged={() => router.refresh()}
          />
        )}
      </SlideOver>
    </div>
  );
}

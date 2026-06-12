"use client";

// Generic table + add/edit/delete modal for the simple settings entities.
// Field values flow through as a flat record to the settings server actions.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { Input, Label, Select } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  createEntity,
  deleteEntity,
  updateEntity,
} from "@/lib/actions/settings";

export interface FieldDef {
  name: string;
  label: string;
  type: "text" | "select" | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  help?: string;
}

export interface ColumnDef<Row> {
  label: string;
  render: (row: Row) => React.ReactNode;
}

type EntityName =
  | "location"
  | "department"
  | "ratio_zone"
  | "work_type"
  | "constraint_rule";

export default function EntityManager<Row extends { id: string }>({
  entity,
  title,
  rows,
  columns,
  fields,
  emptyMessage,
  toFormValues,
}: {
  entity: EntityName;
  title: string;
  rows: Row[];
  columns: ColumnDef<Row>[];
  fields: FieldDef[];
  emptyMessage: string;
  /** Map a row to the modal's initial form values when editing */
  toFormValues: (row: Row) => Record<string, string | boolean>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.type === "checkbox") values[f.name] = form.get(f.name) === "on";
      else values[f.name] = (form.get(f.name) as string) || null;
    }
    const result =
      editing === "new"
        ? await createEntity(entity, values)
        : await updateEntity(entity, (editing as Row).id, values);
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  async function handleDelete(row: Row) {
    if (!confirm(`Delete this ${title.toLowerCase()}? This can't be undone.`))
      return;
    setBusy(true);
    const result = await deleteEntity(entity, row.id);
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  const initial =
    editing && editing !== "new" ? toFormValues(editing) : ({} as Record<string, string | boolean>);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-brand text-base font-bold text-navy">{title}s</h2>
        <Button onClick={() => setEditing("new")}>Add {title}</Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <Table>
          <thead>
            <tr>
              {columns.map((c) => (
                <Th key={c.label}>{c.label}</Th>
              ))}
              <Th className="w-24"> </Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                {columns.map((c) => (
                  <Td key={c.label}>{c.render(row)}</Td>
                ))}
                <Td>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setEditing(row)}
                      className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      disabled={busy}
                      className="font-body text-xs font-medium text-[#C0392B] underline-offset-2 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? `Add ${title}` : `Edit ${title}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" form={`${entity}-form`} disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </>
        }
      >
        <form id={`${entity}-form`} onSubmit={handleSubmit} className="space-y-4">
          {fields.map((f) => (
            <div key={f.name}>
              {f.type === "checkbox" ? (
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id={f.name}
                    name={f.name}
                    defaultChecked={Boolean(initial[f.name])}
                    className="h-4 w-4 accent-amber"
                  />
                  <label htmlFor={f.name} className="font-body text-sm text-navy">
                    {f.label}
                  </label>
                </div>
              ) : (
                <>
                  <Label htmlFor={f.name}>{f.label}</Label>
                  {f.type === "select" ? (
                    <Select
                      id={f.name}
                      name={f.name}
                      required={f.required}
                      defaultValue={String(initial[f.name] ?? "")}
                    >
                      {!f.required && <option value="">—</option>}
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={f.name}
                      name={f.name}
                      required={f.required}
                      defaultValue={String(initial[f.name] ?? "")}
                    />
                  )}
                </>
              )}
              {f.help && (
                <p className="mt-1 font-body text-xs text-steel">{f.help}</p>
              )}
            </div>
          ))}
          {error && (
            <p className="font-body text-sm text-[#C0392B]">{error}</p>
          )}
        </form>
      </Modal>
    </div>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "compliant" : "neutral"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Label, Textarea, HelpText } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  emulateAppUser,
  switchActiveTenant,
  updateTenantEmailMode,
} from "@/lib/actions/platform";

type TenantStatus = "setup" | "trial" | "live";

interface TenantSummary {
  id: string;
  name: string;
  has_ratio: boolean;
  schedule_cycle: string;
  outbound_email_enabled: boolean;
  status: TenantStatus;
  email_allowlist: string[];
  created_at: string;
  staff_count: number;
  user_count: number;
}

function emailBadge(t: TenantSummary) {
  if (!t.outbound_email_enabled) return <Badge tone="alert">Suppressed</Badge>;
  if (t.email_allowlist.length > 0)
    return <Badge tone="neutral">{`${t.status === "live" ? "Live" : "Trial"} · ${t.email_allowlist.length} allowed`}</Badge>;
  if (t.status !== "live") return <Badge tone="alert">Trial · silent</Badge>;
  return <Badge tone="compliant">Live</Badge>;
}

interface UserSummary {
  id: string;
  tenant_id: string;
  role: string;
  label: string;
  email: string | null;
}

export default function AdminConsole({
  tenants,
  users,
  activeTenantId,
  ownTenantId,
}: {
  tenants: TenantSummary[];
  users: UserSummary[];
  activeTenantId: string | null;
  ownTenantId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [emulateTarget, setEmulateTarget] = useState("");
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<TenantStatus>("trial");
  const [draftEnabled, setDraftEnabled] = useState(true);
  const [draftAllowlist, setDraftAllowlist] = useState("");

  function openEmailEditor(t: TenantSummary) {
    setEditingEmail(t.id);
    setDraftStatus(t.status);
    setDraftEnabled(t.outbound_email_enabled);
    setDraftAllowlist(t.email_allowlist.join("\n"));
  }

  const currentTenantId = activeTenantId ?? ownTenantId;
  const currentUsers = users.filter((u) => u.tenant_id === currentTenantId);

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const result = await fn();
    if (!result.ok) alert(result.error);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="max-w-[920px] space-y-6">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-brand text-base font-bold text-navy">
              Tenants ({tenants.length})
            </h2>
            <p className="font-body text-xs text-steel">
              Switch into any tenant to administer it — the whole app scopes
              to it until you switch back.
            </p>
          </div>
          <Link href="/app/onboarding">
            <Button variant="secondary">+ Create a tenant</Button>
          </Link>
        </div>

        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Tenant</Th>
                <Th>Config</Th>
                <Th>People</Th>
                <Th>Email</Th>
                <Th className="w-32"> </Th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const isActive = t.id === currentTenantId;
                const isEditing = editingEmail === t.id;
                return (
                  <Fragment key={t.id}>
                    <Tr>
                      <Td className="font-medium">
                        {t.name}
                        {isActive && (
                          <span className="ml-2">
                            <Badge tone="compliant">Current</Badge>
                          </span>
                        )}
                      </Td>
                      <Td>
                        {t.schedule_cycle}
                        {t.has_ratio ? " · ratio on" : " · no ratio"}
                      </Td>
                      <Td>
                        {t.staff_count} staff · {t.user_count} sign-in
                        {t.user_count === 1 ? "" : "s"}
                      </Td>
                      <Td>
                        {emailBadge(t)}
                        <button
                          disabled={busy}
                          onClick={() =>
                            isEditing ? setEditingEmail(null) : openEmailEditor(t)
                          }
                          className="ml-2 font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                        >
                          {isEditing ? "Close" : "Edit"}
                        </button>
                      </Td>
                      <Td>
                        {!isActive && (
                          <button
                            disabled={busy}
                            onClick={() => act(() => switchActiveTenant(t.id))}
                            className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                          >
                            Switch into →
                          </button>
                        )}
                      </Td>
                    </Tr>
                    {isEditing && (
                      <tr>
                        <td colSpan={5} className="bg-cloud px-4 py-4">
                          <div className="flex flex-wrap items-start gap-4">
                            <div className="w-40">
                              <Label htmlFor={`status-${t.id}`}>Lifecycle</Label>
                              <Select
                                id={`status-${t.id}`}
                                value={draftStatus}
                                onChange={(e) =>
                                  setDraftStatus(e.target.value as TenantStatus)
                                }
                              >
                                <option value="setup">Setup</option>
                                <option value="trial">Trial</option>
                                <option value="live">Live</option>
                              </Select>
                            </div>
                            <div className="w-44">
                              <Label htmlFor={`kill-${t.id}`}>Master switch</Label>
                              <label
                                htmlFor={`kill-${t.id}`}
                                className="flex items-center gap-2 py-2.5 font-body text-sm text-navy"
                              >
                                <input
                                  id={`kill-${t.id}`}
                                  type="checkbox"
                                  checked={draftEnabled}
                                  onChange={(e) => setDraftEnabled(e.target.checked)}
                                />
                                Outbound email on
                              </label>
                            </div>
                            <div className="min-w-64 flex-1">
                              <Label htmlFor={`allow-${t.id}`}>
                                Allowlist (one address per line)
                              </Label>
                              <Textarea
                                id={`allow-${t.id}`}
                                rows={3}
                                value={draftAllowlist}
                                onChange={(e) => setDraftAllowlist(e.target.value)}
                                placeholder="susie@example.com"
                              />
                              <HelpText>
                                When an allowlist is set, only those addresses can
                                ever receive email from this pharmacy. Everyone
                                else is silently skipped. A non-live pharmacy with
                                an empty list sends nothing at all.
                              </HelpText>
                            </div>
                            <div className="pt-6">
                              <Button
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    updateTenantEmailMode(t.id, {
                                      status: draftStatus,
                                      outbound_email_enabled: draftEnabled,
                                      allowlist: draftAllowlist.split(/\r?\n/),
                                    })
                                  ).then(() => setEditingEmail(null))
                                }
                              >
                                Save
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        </div>

        {activeTenantId && (
          <div className="mt-4 border-t border-line pt-4">
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => act(() => switchActiveTenant(null))}
            >
              ← Return to my own workspace
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-brand text-base font-bold text-navy">
          View as a user
        </h2>
        <p className="mt-1 font-body text-xs text-steel">
          See exactly what someone in the current tenant sees — their
          schedule, their requests, their permissions. A banner shows while
          you&rsquo;re emulating, and nothing you trigger sends email unless
          the tenant allows it.
        </p>
        {currentUsers.length === 0 ? (
          <p className="mt-3 font-body text-sm text-steel">
            No sign-ins in the current tenant yet. Users appear after their
            first magic-link sign-in.
          </p>
        ) : (
          <div className="mt-4 flex items-end gap-3">
            <div className="w-72">
              <Label htmlFor="emulate">User</Label>
              <Select
                id="emulate"
                value={emulateTarget}
                onChange={(e) => setEmulateTarget(e.target.value)}
              >
                <option value="">— Choose —</option>
                {currentUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label} ({u.role}){u.email ? ` — ${u.email}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              disabled={busy || !emulateTarget}
              onClick={() => act(() => emulateAppUser(emulateTarget))}
            >
              View as this user
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

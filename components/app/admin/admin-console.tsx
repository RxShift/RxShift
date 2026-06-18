"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Label, Textarea, HelpText, Input } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  emulateAppUser,
  resetDemoTenant,
  setDemoClock,
  switchActiveTenant,
  updateTenantBilling,
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
  is_demo: boolean;
  demo_redirect_email: string;
  demo_clock: string | null;
  billing_label: string;
  billing_status: "none" | "trial" | "active" | "past_due" | "canceled";
  billed_locations: number | null;
  billing_interval: "monthly" | "annual" | null;
  created_at: string;
  staff_count: number;
  user_count: number;
}

function emailBadge(t: TenantSummary) {
  if (t.is_demo)
    return (
      <Badge tone="neutral">
        {t.demo_redirect_email ? "Demo · redirect" : "Demo · silent"}
      </Badge>
    );
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
  const [draftIsDemo, setDraftIsDemo] = useState(false);
  const [draftDemoRedirect, setDraftDemoRedirect] = useState("");
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [draftBillStatus, setDraftBillStatus] =
    useState<TenantSummary["billing_status"]>("none");
  const [draftBillLocations, setDraftBillLocations] = useState("");
  const [draftBillInterval, setDraftBillInterval] = useState("monthly");

  function openEmailEditor(t: TenantSummary) {
    setEditingEmail(t.id);
    setDraftStatus(t.status);
    setDraftEnabled(t.outbound_email_enabled);
    setDraftAllowlist(t.email_allowlist.join("\n"));
    setDraftIsDemo(t.is_demo);
    setDraftDemoRedirect(t.demo_redirect_email);
    setDraftBillStatus(t.billing_status);
    setDraftBillLocations(t.billed_locations ? String(t.billed_locations) : "");
    setDraftBillInterval(t.billing_interval ?? "monthly");
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
                        <div className="font-body text-[11px] text-steel">
                          {t.billing_label}
                        </div>
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
                        <div className="flex flex-col items-start gap-1">
                          {!isActive && (
                            <button
                              disabled={busy}
                              onClick={() => act(() => switchActiveTenant(t.id))}
                              className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                            >
                              Switch into →
                            </button>
                          )}
                          {t.is_demo && (
                            confirmRestore === t.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-body text-xs text-steel">Confirm?</span>
                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    act(() => resetDemoTenant(t.id)).then(() =>
                                      setConfirmRestore(null)
                                    )
                                  }
                                  className="font-body text-xs font-medium text-deficiency underline-offset-2 hover:underline"
                                >
                                  {busy ? "Restoring…" : "Yes"}
                                </button>
                                <button
                                  disabled={busy}
                                  onClick={() => setConfirmRestore(null)}
                                  className="font-body text-xs text-steel underline-offset-2 hover:underline"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                disabled={busy}
                                onClick={() => setConfirmRestore(t.id)}
                                className="font-body text-xs font-medium text-amber underline-offset-2 hover:underline"
                              >
                                Restore demo data
                              </button>
                            )
                          )}
                        </div>
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
                            <div className="w-64">
                              <Label htmlFor={`demo-${t.id}`}>Demo tenant</Label>
                              <label
                                htmlFor={`demo-${t.id}`}
                                className="flex items-center gap-2 py-2.5 font-body text-sm text-navy"
                              >
                                <input
                                  id={`demo-${t.id}`}
                                  type="checkbox"
                                  checked={draftIsDemo}
                                  onChange={(e) => setDraftIsDemo(e.target.checked)}
                                />
                                Fictional data — never goes live
                              </label>
                              {draftIsDemo && (
                                <>
                                  <Input
                                    type="email"
                                    value={draftDemoRedirect}
                                    onChange={(e) =>
                                      setDraftDemoRedirect(e.target.value)
                                    }
                                    placeholder="redirect inbox (optional)"
                                  />
                                  <HelpText>
                                    Every email this tenant would send goes to
                                    this one inbox instead. Leave empty to send
                                    nothing at all.
                                  </HelpText>
                                </>
                              )}
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
                                      is_demo: draftIsDemo,
                                      demo_redirect_email: draftDemoRedirect,
                                    })
                                  ).then(() => setEditingEmail(null))
                                }
                              >
                                Save
                              </Button>
                            </div>
                          </div>

                          {!t.is_demo && (
                            <div className="mt-4 flex flex-wrap items-end gap-4 border-t border-line pt-3">
                              <div className="w-40">
                                <Label htmlFor={`bstat-${t.id}`}>Billing</Label>
                                <Select
                                  id={`bstat-${t.id}`}
                                  value={draftBillStatus}
                                  onChange={(e) =>
                                    setDraftBillStatus(
                                      e.target.value as TenantSummary["billing_status"]
                                    )
                                  }
                                >
                                  {["none", "trial", "active", "past_due", "canceled"].map(
                                    (s) => (
                                      <option key={s} value={s}>
                                        {s}
                                      </option>
                                    )
                                  )}
                                </Select>
                              </div>
                              <div className="w-32">
                                <Label htmlFor={`bloc-${t.id}`}>Billed locations</Label>
                                <Input
                                  id={`bloc-${t.id}`}
                                  type="number"
                                  min={1}
                                  max={99}
                                  value={draftBillLocations}
                                  onChange={(e) => setDraftBillLocations(e.target.value)}
                                />
                              </div>
                              <div className="w-32">
                                <Label htmlFor={`bint-${t.id}`}>Interval</Label>
                                <Select
                                  id={`bint-${t.id}`}
                                  value={draftBillInterval}
                                  onChange={(e) => setDraftBillInterval(e.target.value)}
                                >
                                  <option value="monthly">Monthly</option>
                                  <option value="annual">Annual</option>
                                </Select>
                              </div>
                              <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() =>
                                  act(() =>
                                    updateTenantBilling(t.id, {
                                      billing_status: draftBillStatus,
                                      billed_locations:
                                        parseInt(draftBillLocations, 10) || null,
                                      billing_interval:
                                        draftBillStatus === "none"
                                          ? null
                                          : (draftBillInterval as "monthly" | "annual"),
                                    })
                                  )
                                }
                              >
                                Save billing
                              </Button>
                            </div>
                          )}

                          {t.is_demo && (
                            <div className="mt-4 border-t border-line pt-3">
                              {confirmRestore === t.id ? (
                                <div className="flex flex-wrap items-center gap-3">
                                  <p className="font-body text-sm text-navy">
                                    Wipe all schedules, staff, and records for{" "}
                                    <strong>{t.name}</strong> and re-seed the
                                    baseline with dates anchored to this week?
                                  </p>
                                  <Button
                                    variant="destructive"
                                    disabled={busy}
                                    onClick={() =>
                                      act(() => resetDemoTenant(t.id)).then(() =>
                                        setConfirmRestore(null)
                                      )
                                    }
                                  >
                                    {busy ? "Restoring…" : "Yes, restore"}
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => setConfirmRestore(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  disabled={busy}
                                  onClick={() => setConfirmRestore(t.id)}
                                  className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
                                >
                                  Restore demo data…
                                </button>
                              )}

                              <div className="mt-3">
                                <Label htmlFor={`clock-${t.id}`}>
                                  Demo clock (after-hours demos)
                                </Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    id={`clock-${t.id}`}
                                    type="time"
                                    defaultValue={t.demo_clock ?? ""}
                                    className="rounded-md border-[1.5px] border-line bg-surface px-3 py-1.5 font-body text-sm text-navy"
                                  />
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => {
                                      const el = document.getElementById(
                                        `clock-${t.id}`
                                      ) as HTMLInputElement | null;
                                      act(() =>
                                        setDemoClock(t.id, el?.value || null)
                                      );
                                    }}
                                  >
                                    Pin time
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => act(() => setDemoClock(t.id, null))}
                                  >
                                    Use real time
                                  </Button>
                                  <span className="font-body text-xs text-steel">
                                    {t.demo_clock
                                      ? `Pinned to ${t.demo_clock}`
                                      : "Live clock"}
                                  </span>
                                </div>
                                <p className="mt-1 max-w-[520px] font-body text-xs text-steel">
                                  Pins the board, My Schedule, and live status to
                                  this time of day on today&rsquo;s date, so a demo
                                  after business hours still shows staff on shift.
                                  Real tenants never use this.
                                </p>
                              </div>
                            </div>
                          )}
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

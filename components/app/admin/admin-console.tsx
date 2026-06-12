"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, Label } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { emulateAppUser, switchActiveTenant } from "@/lib/actions/platform";

interface TenantSummary {
  id: string;
  name: string;
  has_ratio: boolean;
  schedule_cycle: string;
  outbound_email_enabled: boolean;
  created_at: string;
  staff_count: number;
  user_count: number;
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
                return (
                  <Tr key={t.id}>
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
                      {t.outbound_email_enabled ? (
                        <Badge tone="neutral">Enabled</Badge>
                      ) : (
                        <Badge tone="alert">Suppressed</Badge>
                      )}
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

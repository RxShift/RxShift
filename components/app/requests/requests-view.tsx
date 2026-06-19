"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge, { type BadgeTone } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import Modal from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/page-header";
import { Input, Label, Select, Textarea, HelpText } from "@/components/ui/form";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import {
  decideSwap,
  decideTimeOff,
  logCallout,
  previewCalloutImpact,
  previewSwapImpact,
  previewTimeOffImpact,
  proposeSwap,
  respondToSwap,
  submitTimeOff,
  type RequestImpact,
} from "@/lib/actions/requests";
import type {
  Callout,
  RequestStatus,
  Shift,
  Staff,
  SwapRequest,
  SwapStatus,
  TimeOffRequest,
} from "@/lib/types";

const STATUS_TONES: Record<RequestStatus, BadgeTone> = {
  pending: "alert",
  approved: "compliant",
  denied: "deficiency",
};

const SWAP_LABELS: Record<SwapStatus, { label: string; tone: BadgeTone }> = {
  pending_peer: { label: "Awaiting peer", tone: "alert" },
  pending_manager: { label: "Awaiting manager", tone: "alert" },
  approved: { label: "Approved", tone: "compliant" },
  denied: { label: "Denied", tone: "deficiency" },
};

type Tab = "timeoff" | "callouts" | "swaps";

export default function RequestsView({
  isManager,
  myStaffId,
  timeOff,
  callouts,
  swaps,
  staff,
  upcomingShifts,
}: {
  isManager: boolean;
  myStaffId: string | null;
  timeOff: TimeOffRequest[];
  callouts: Callout[];
  swaps: SwapRequest[];
  staff: Staff[];
  upcomingShifts: Shift[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("timeoff");
  const [modal, setModal] = useState<"timeoff" | "callout" | "swap" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Approval gate: before approving a PTO/swap, show its compliance impact and
  // (when it creates a ratio deficiency) require a logged reason.
  type ApproveTarget =
    | {
        kind: "timeoff";
        id: string;
        name: string;
        staffId: string;
        start: string;
        end: string;
      }
    | { kind: "swap"; id: string; name: string };
  const [approve, setApprove] = useState<ApproveTarget | null>(null);
  const [impact, setImpact] = useState<RequestImpact | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [reason, setReason] = useState("");

  // Pre-submit / pre-log visibility notes.
  const [submitImpact, setSubmitImpact] = useState<RequestImpact | null>(null);
  const [calloutImpact, setCalloutImpact] = useState<RequestImpact | null>(null);

  const name = (id: string) =>
    staff.find((s) => s.id === id)?.full_name ?? "Unknown";

  const myShifts = upcomingShifts.filter((s) => s.staff_id === myStaffId);

  async function openApprove(target: ApproveTarget) {
    setApprove(target);
    setImpact(null);
    setReason("");
    setError(null);
    setImpactLoading(true);
    const res =
      target.kind === "timeoff"
        ? await previewTimeOffImpact(target.staffId, target.start, target.end)
        : await previewSwapImpact(target.id);
    setImpact(res.ok ? (res.data ?? null) : null);
    setImpactLoading(false);
  }

  async function confirmApprove() {
    if (!approve) return;
    setBusy(true);
    setError(null);
    const res =
      approve.kind === "timeoff"
        ? await decideTimeOff(approve.id, "approved", reason || null)
        : await decideSwap(approve.id, "approved", reason || null);
    if (res.ok) {
      setApprove(null);
      setReason("");
      router.refresh();
    } else {
      setError(res.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  // Recompute the PTO submit note when both dates are present.
  async function checkSubmitImpact(form: HTMLFormElement) {
    const start = (form.elements.namedItem("start_date") as HTMLInputElement)
      ?.value;
    const end = (form.elements.namedItem("end_date") as HTMLInputElement)?.value;
    if (!myStaffId || !start || !end || end < start) {
      setSubmitImpact(null);
      return;
    }
    const res = await previewTimeOffImpact(myStaffId, start, end);
    setSubmitImpact(res.ok ? (res.data ?? null) : null);
  }

  async function checkCalloutImpact(shiftId: string) {
    if (!shiftId) {
      setCalloutImpact(null);
      return;
    }
    const res = await previewCalloutImpact(shiftId);
    setCalloutImpact(res.ok ? (res.data ?? null) : null);
  }

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    if (result.ok) {
      setModal(null);
      router.refresh();
    } else {
      setError(result.error ?? "Something went wrong.");
    }
    setBusy(false);
  }

  async function handleTimeOff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(() =>
      submitTimeOff({
        start_date: f.get("start_date"),
        end_date: f.get("end_date"),
        type: f.get("type"),
        staff_message: (f.get("staff_message") as string) || null,
      })
    );
  }

  async function handleCallout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(() =>
      logCallout({
        staff_id: (f.get("staff_id") as string) || null,
        shift_id: (f.get("shift_id") as string) || null,
        reason: (f.get("reason") as string) || null,
      })
    );
  }

  async function handleSwap(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await act(() =>
      proposeSwap({
        shift_a_id: f.get("shift_a_id"),
        counter_staff_id: f.get("counter_staff_id"),
        shift_b_id: (f.get("shift_b_id") as string) || null,
      })
    );
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    {
      key: "timeoff",
      label: "Time Off",
      count: timeOff.filter((t) => t.status === "pending").length,
    },
    { key: "callouts", label: "Callouts", count: 0 },
    {
      key: "swaps",
      label: "Swaps",
      count: swaps.filter((s) =>
        isManager
          ? s.status === "pending_manager"
          : s.status === "pending_peer" && s.counter_staff_id === myStaffId
      ).length,
    },
  ];

  return (
    <div className="max-w-[1040px]">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-2 font-brand text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[#1C2F5E] text-white"
                  : "text-steel hover:text-navy"
              }`}
            >
              {t.label}
              {t.count > 0 && (
                <span className="ml-1.5 rounded-full bg-amber px-1.5 py-0.5 font-bold text-[10px] text-white">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {myStaffId && (
            <>
              <Button variant="secondary" onClick={() => setModal("swap")}>
                Propose Swap
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setCalloutImpact(null);
                  setModal("callout");
                }}
              >
                Log Callout
              </Button>
              <Button
                onClick={() => {
                  setSubmitImpact(null);
                  setModal("timeoff");
                }}
              >
                Request Time Off
              </Button>
            </>
          )}
          {!myStaffId && isManager && (
            <Button
              variant="secondary"
              onClick={() => {
                setCalloutImpact(null);
                setModal("callout");
              }}
            >
              Log Callout
            </Button>
          )}
        </div>
      </div>

      {/* Time off */}
      {tab === "timeoff" &&
        (timeOff.length === 0 ? (
          <EmptyState message="No time-off requests yet." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Dates</Th>
                <Th>Type</Th>
                <Th>Note</Th>
                <Th>Status</Th>
                {isManager && <Th className="w-36"> </Th>}
              </tr>
            </thead>
            <tbody>
              {timeOff.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-medium">{name(t.staff_id)}</Td>
                  <Td>
                    {t.start_date}
                    {t.end_date !== t.start_date && ` → ${t.end_date}`}
                  </Td>
                  <Td>{t.type}</Td>
                  <Td className="max-w-[220px] truncate">
                    {t.staff_message ?? "—"}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONES[t.status]}>{t.status}</Badge>
                  </Td>
                  {isManager && (
                    <Td>
                      {t.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() =>
                              openApprove({
                                kind: "timeoff",
                                id: t.id,
                                name: name(t.staff_id),
                                staffId: t.staff_id,
                                start: t.start_date,
                                end: t.end_date,
                              })
                            }
                            className="rounded bg-compliant px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                          >
                            Approve
                          </button>
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(() => decideTimeOff(t.id, "denied"))
                            }
                            className="rounded bg-deficiency px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                          >
                            Deny
                          </button>
                        </div>
                      )}
                    </Td>
                  )}
                </Tr>
              ))}
            </tbody>
          </Table>
        ))}

      {/* Callouts */}
      {tab === "callouts" &&
        (callouts.length === 0 ? (
          <EmptyState message="No callouts logged. When someone can't make a shift, log it here — the resulting ratio gap is computed and documented automatically." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Logged</Th>
                <Th>Reason</Th>
                <Th>Ratio impact</Th>
              </tr>
            </thead>
            <tbody>
              {callouts.map((c) => {
                const gap = c.resulting_gap as {
                  deficient_slots_added?: number;
                  date?: string;
                } | null;
                return (
                  <Tr key={c.id}>
                    <Td className="font-medium">{name(c.staff_id)}</Td>
                    <Td>{new Date(c.logged_at).toLocaleString()}</Td>
                    <Td>{c.reason ?? "—"}</Td>
                    <Td>
                      {gap ? (
                        Number(gap.deficient_slots_added) > 0 ? (
                          <Badge tone="deficiency">
                            +{gap.deficient_slots_added} deficient slots {gap.date}
                          </Badge>
                        ) : (
                          <Badge tone="compliant">No new deficiency</Badge>
                        )
                      ) : (
                        "—"
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ))}

      {/* Swaps */}
      {tab === "swaps" &&
        (swaps.length === 0 ? (
          <EmptyState message="No swap requests. Staff propose a swap, the colleague accepts, and a manager approves after seeing the effect." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Proposed by</Th>
                <Th>With</Th>
                <Th>Status</Th>
                <Th className="w-44"> </Th>
              </tr>
            </thead>
            <tbody>
              {swaps.map((s) => {
                const sl = SWAP_LABELS[s.status];
                const canPeerRespond =
                  s.status === "pending_peer" &&
                  s.counter_staff_id === myStaffId;
                const canManagerDecide =
                  isManager && s.status === "pending_manager";
                return (
                  <Tr key={s.id}>
                    <Td className="font-medium">
                      {name(s.requesting_staff_id)}
                    </Td>
                    <Td>{name(s.counter_staff_id)}</Td>
                    <Td>
                      <Badge tone={sl.tone}>{sl.label}</Badge>
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-2">
                        {canPeerRespond && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(() => respondToSwap(s.id, true))
                              }
                              className="rounded bg-compliant px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                            >
                              Accept
                            </button>
                            <button
                              disabled={busy}
                              onClick={() =>
                                act(() => respondToSwap(s.id, false))
                              }
                              className="rounded bg-deficiency px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                            >
                              Decline
                            </button>
                          </>
                        )}
                        {canManagerDecide && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() =>
                                openApprove({
                                  kind: "swap",
                                  id: s.id,
                                  name: name(s.requesting_staff_id),
                                })
                              }
                              className="rounded bg-compliant px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                            >
                              Approve
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => act(() => decideSwap(s.id, "denied"))}
                              className="rounded bg-deficiency px-2.5 py-1 font-brand text-[11px] font-bold text-white"
                            >
                              Deny
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ))}

      {error && !modal && !approve && (
        <p className="mt-3 font-body text-sm text-deficiency">{error}</p>
      )}

      {/* Request time off */}
      <Modal
        open={modal === "timeoff"}
        onClose={() => setModal(null)}
        title="Request time off"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="timeoff-form" disabled={busy}>
              {busy ? "Submitting…" : "Submit request"}
            </Button>
          </>
        }
      >
        <form id="timeoff-form" onSubmit={handleTimeOff} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">First day off</Label>
              <Input
                id="start_date"
                name="start_date"
                type="date"
                required
                onChange={(e) => checkSubmitImpact(e.currentTarget.form!)}
              />
            </div>
            <div>
              <Label htmlFor="end_date">Last day off</Label>
              <Input
                id="end_date"
                name="end_date"
                type="date"
                required
                onChange={(e) => checkSubmitImpact(e.currentTarget.form!)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" name="type" defaultValue="pto">
              <option value="pto">PTO / vacation</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
              <option value="other">Other</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="staff_message">Note (optional)</Label>
            <Textarea id="staff_message" name="staff_message" rows={2} />
          </div>
          {submitImpact && submitImpact.ratioAdded > 0 && (
            <p className="rounded-md bg-alert-bg px-3 py-2 font-body text-[13px] text-alert">
              Heads up — approving this would create {submitImpact.ratioAdded}{" "}
              deficient ratio slot
              {submitImpact.ratioAdded === 1 ? "" : "s"}
              {submitImpact.dates.length
                ? ` on ${submitImpact.dates.join(", ")}`
                : ""}
              . You can still submit; your manager sees the impact before
              approving.
            </p>
          )}
          {error && <p className="font-body text-sm text-deficiency">{error}</p>}
        </form>
      </Modal>

      {/* Log callout */}
      <Modal
        open={modal === "callout"}
        onClose={() => setModal(null)}
        title="Log a callout"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="callout-form" disabled={busy}>
              {busy ? "Logging…" : "Log callout"}
            </Button>
          </>
        }
      >
        <form id="callout-form" onSubmit={handleCallout} className="space-y-4">
          {isManager && (
            <div>
              <Label htmlFor="staff_id">Who called out</Label>
              <Select id="staff_id" name="staff_id" defaultValue={myStaffId ?? ""}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="shift_id">Affected shift (optional)</Label>
            <Select
              id="shift_id"
              name="shift_id"
              defaultValue=""
              onChange={(e) => checkCalloutImpact(e.currentTarget.value)}
            >
              <option value="">— Not tied to a specific shift —</option>
              {(isManager ? upcomingShifts : myShifts).slice(0, 60).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} — {name(s.staff_id)}
                </option>
              ))}
            </Select>
            <HelpText>
              Picking the shift lets RxShift compute the resulting ratio gap.
            </HelpText>
            {calloutImpact &&
              (calloutImpact.ratioAdded > 0 ? (
                <p className="mt-2 rounded-md bg-deficiency-bg px-3 py-2 font-body text-[13px] text-deficiency">
                  This callout would create {calloutImpact.ratioAdded} deficient
                  ratio slot{calloutImpact.ratioAdded === 1 ? "" : "s"}
                  {calloutImpact.dates.length
                    ? ` on ${calloutImpact.dates.join(", ")}`
                    : ""}
                  . It will be logged and documented either way.
                </p>
              ) : (
                <p className="mt-2 rounded-md bg-compliant-bg px-3 py-2 font-body text-[13px] text-compliant">
                  No new ratio deficiency results from this callout.
                </p>
              ))}
          </div>
          <div>
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea id="reason" name="reason" rows={2} />
          </div>
          {error && <p className="font-body text-sm text-deficiency">{error}</p>}
        </form>
      </Modal>

      {/* Propose swap */}
      <Modal
        open={modal === "swap"}
        onClose={() => setModal(null)}
        title="Propose a shift swap"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="swap-form" disabled={busy}>
              {busy ? "Sending…" : "Propose swap"}
            </Button>
          </>
        }
      >
        <form id="swap-form" onSubmit={handleSwap} className="space-y-4">
          <div>
            <Label htmlFor="shift_a_id">Your shift to give up</Label>
            <Select id="shift_a_id" name="shift_a_id" required>
              {myShifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="counter_staff_id">Swap with</Label>
            <Select id="counter_staff_id" name="counter_staff_id" required>
              {staff
                .filter((s) => s.id !== myStaffId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="shift_b_id">Their shift you&rsquo;d take (optional)</Label>
            <Select id="shift_b_id" name="shift_b_id" defaultValue="">
              <option value="">— One-way: they just cover mine —</option>
              {upcomingShifts
                .filter((s) => s.staff_id !== myStaffId)
                .slice(0, 60)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {name(s.staff_id)}
                  </option>
                ))}
            </Select>
            <HelpText>
              Your colleague accepts first; a manager gives final approval.
            </HelpText>
          </div>
          {error && <p className="font-body text-sm text-deficiency">{error}</p>}
        </form>
      </Modal>

      {/* Approve gate — show the compliance impact; require a logged reason when
          it creates a ratio deficiency (warn, never block). */}
      <Modal
        open={approve !== null}
        onClose={() => {
          setApprove(null);
          setReason("");
          setError(null);
        }}
        title={approve?.kind === "swap" ? "Approve shift swap" : "Approve time off"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setApprove(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmApprove}
              disabled={
                busy ||
                impactLoading ||
                (!!impact?.requiresReason && reason.trim().length < 3)
              }
            >
              {busy ? "Approving…" : "Approve"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {approve && (
            <p className="font-body text-sm text-navy">
              {approve.kind === "swap"
                ? `Approve the swap proposed by ${approve.name}?`
                : `Approve time off for ${approve.name}?`}
            </p>
          )}
          {impactLoading && (
            <p className="font-body text-sm text-steel">
              Checking compliance impact…
            </p>
          )}
          {!impactLoading && impact && impact.messages.length === 0 && (
            <p className="rounded-md bg-compliant-bg px-3 py-2 font-body text-[13px] text-compliant">
              No compliance impact — safe to approve.
            </p>
          )}
          {!impactLoading && impact && impact.messages.length > 0 && (
            <div
              className={`rounded-md px-3 py-2 ${
                impact.requiresReason ? "bg-deficiency-bg" : "bg-alert-bg"
              }`}
            >
              <ul className="space-y-1">
                {impact.messages.map((m, i) => (
                  <li
                    key={i}
                    className={`font-body text-[13px] ${
                      impact.requiresReason ? "text-deficiency" : "text-alert"
                    }`}
                  >
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!impactLoading && impact?.requiresReason && (
            <div>
              <Label htmlFor="approve-reason">Reason (required, logged)</Label>
              <Textarea
                id="approve-reason"
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Per-diem RPh covering the gap; documented for the record."
              />
              <HelpText>
                RxShift never blocks you — but approving despite a ratio
                deficiency records this reason in the override log and the
                Compliance Record.
              </HelpText>
            </div>
          )}
          {error && approve && (
            <p className="font-body text-sm text-deficiency">{error}</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

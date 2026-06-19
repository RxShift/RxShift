"use client";

// AI-assisted onboarding wizard (scoping Appendix B). Plain-English
// quick-start prefills the steps; AI proposes the state ratio rule; the
// user confirms or edits everything; one server action creates the whole
// workspace. Finishing uses a hard navigation — no client router races.

import { useEffect, useState } from "react";
import RxShiftMark from "@/components/rxshift-mark";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/form";
import { TIMEZONES, US_STATES, WORK_TYPE_SEEDS } from "@/lib/seeds";
import { normalizeEmploymentType, normalizeRatioType, parseCsv } from "@/lib/csv";
import { aiMapCsvColumns } from "@/lib/actions/import";
import {
  aiQuickStart,
  completeOnboarding,
  proposeRatioRule,
  type RatioProposal,
} from "@/lib/actions/onboarding";

interface LocationDraft {
  name: string;
  address: string;
  isolated_rooms: string[];
}

interface StaffDraft {
  full_name: string;
  login_email: string;
  work_email: string;
  job_title: string;
  ratio_type: string;
  employment_type: string;
}

interface WorkTypeDraft {
  name: string;
  counts_as: "pharmacist" | "technician" | "none";
  counting_default: boolean;
  is_specialized: boolean;
  enabled: boolean;
}

const STEPS = [
  "Your pharmacy",
  "Locations",
  "Ratio",
  "Schedule",
  "Work types",
  "Your staff",
  "Finish",
];

const CREATING_STAGES = [
  "Creating your workspace…",
  "Setting up locations and zones…",
  "Configuring your ratio rule…",
  "Loading work types…",
  "Adding your staff…",
  "Almost there — opening your dashboard…",
];

function CreatingOverlay({ failed }: { failed: boolean }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setStage((s) => Math.min(s + 1, CREATING_STAGES.length - 1)),
      900
    );
    return () => clearInterval(t);
  }, []);
  if (failed) return null;
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#1C2F5E]/95">
      <RxShiftMark size={72} variant="dark" />
      <p className="mt-8 font-brand text-xl font-bold text-white">
        {CREATING_STAGES[stage]}
      </p>
      <div className="mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-white/15">
        <div
          className="h-full rounded-full bg-amber transition-all duration-700"
          style={{
            width: `${Math.round(((stage + 1) / CREATING_STAGES.length) * 100)}%`,
          }}
        />
      </div>
      <p className="mt-4 font-body text-sm text-white/50">
        This usually takes a few seconds.
      </p>
    </div>
  );
}

export default function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI quick-start
  const [description, setDescription] = useState("");
  const [quickStartBusy, setQuickStartBusy] = useState(false);
  const [quickStartNote, setQuickStartNote] = useState<string | null>(null);

  // Step 1
  const [businessName, setBusinessName] = useState("");
  const [myName, setMyName] = useState("");
  const [timezone, setTimezone] = useState("America/Los_Angeles");
  // Step 2
  const [locations, setLocations] = useState<LocationDraft[]>([
    { name: "", address: "", isolated_rooms: [] },
  ]);
  // Step 3
  const [hasRatio, setHasRatio] = useState<boolean | null>(null);
  const [state, setState] = useState("NV");
  const [proposal, setProposal] = useState<RatioProposal | null>(null);
  const [maxTechs, setMaxTechs] = useState(3);
  const [ratioNotes, setRatioNotes] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  // Step 4
  const [cycle, setCycle] = useState<"weekly" | "biweekly" | "monthly">("weekly");
  const [slotMinutes, setSlotMinutes] = useState<15 | 30 | 60>(30);
  // Step 5
  const [workTypes, setWorkTypes] = useState<WorkTypeDraft[]>(
    WORK_TYPE_SEEDS.map((w) => ({ ...w, enabled: true }))
  );
  const [newWorkType, setNewWorkType] = useState("");
  const [newWorkTypeCounts, setNewWorkTypeCounts] = useState(true);
  // Step 6
  const [staffRows, setStaffRows] = useState<StaffDraft[]>([]);
  const [csvNote, setCsvNote] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);

  async function handleQuickStart() {
    setQuickStartBusy(true);
    setQuickStartNote(null);
    const result = await aiQuickStart(description);
    if (result.ok && result.data) {
      const p = result.data;
      const applied: string[] = [];
      if (p.business_name) {
        setBusinessName(p.business_name);
        applied.push("name");
      }
      if (p.timezone && (TIMEZONES as readonly string[]).includes(p.timezone)) {
        setTimezone(p.timezone);
        applied.push("timezone");
      }
      if (p.schedule_cycle) {
        setCycle(p.schedule_cycle);
        applied.push("schedule cycle");
      }
      if (p.locations && p.locations.length > 0) {
        setLocations(
          p.locations.map((l) => ({
            name: l.name,
            address: l.address ?? "",
            isolated_rooms: l.isolated_rooms ?? [],
          }))
        );
        applied.push(`${p.locations.length} location${p.locations.length === 1 ? "" : "s"}`);
      }
      if (p.has_ratio !== null && p.has_ratio !== undefined) {
        setHasRatio(p.has_ratio);
        applied.push(p.has_ratio ? "ratio: yes" : "ratio: no");
        if (p.has_ratio) {
          const st = p.state ?? "NV";
          setState(st);
          fetchProposal(st);
        }
      }
      setQuickStartNote(
        applied.length > 0
          ? `Prefilled: ${applied.join(", ")}. Review each step — you confirm everything.`
          : "Couldn't pull specifics from that — fill in the steps below."
      );
    } else if (!result.ok) {
      setQuickStartNote(result.error);
    }
    setQuickStartBusy(false);
  }

  async function fetchProposal(forState: string) {
    setProposalLoading(true);
    setProposal(null);
    const result = await proposeRatioRule(forState);
    if (result.ok && result.data) {
      setProposal(result.data);
      setMaxTechs(result.data.max_techs_per_pharmacist);
      setRatioNotes(result.data.notes);
    }
    setProposalLoading(false);
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvBusy(true);
    setCsvNote(null);
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setCsvNote("That file needs a header row plus at least one person.");
      setCsvBusy(false);
      return;
    }

    // AI maps the columns; heuristics as fallback — no manual mapping step
    const headers = parsed[0];
    const result = await aiMapCsvColumns(headers, parsed.slice(1, 4));
    const mapping =
      result.ok && result.data ? result.data.mapping : headers.map(() => "");

    const rows: StaffDraft[] = parsed.slice(1).map((row) => {
      const rec: StaffDraft = {
        full_name: "",
        login_email: "",
        work_email: "",
        job_title: "",
        ratio_type: "technician",
        employment_type: "full_time",
      };
      mapping.forEach((field, i) => {
        const raw = (row[i] ?? "").trim();
        if (!field || !raw) return;
        if (field === "ratio_type") rec.ratio_type = normalizeRatioType(raw);
        else if (field === "employment_type")
          rec.employment_type = normalizeEmploymentType(raw);
        else
          rec[field as keyof Omit<StaffDraft, "ratio_type" | "employment_type">] =
            raw;
      });
      return rec;
    });
    const valid = rows.filter((r) => r.full_name);
    setStaffRows(valid);
    setCsvNote(
      valid.length > 0
        ? `${result.ok && result.data?.via === "ai" ? "AI mapped" : "Mapped"} your columns automatically — ${valid.length} people found.`
        : "Couldn't find a name column in that file. Check the CSV and try again."
    );
    setCsvBusy(false);
  }

  function canContinue(): boolean {
    switch (step) {
      case 0:
        return businessName.trim().length > 0 && myName.trim().length > 0;
      case 1:
        return locations.every((l) => l.name.trim().length > 0);
      case 2:
        return hasRatio === false || (hasRatio === true && maxTechs >= 1);
      default:
        return true;
    }
  }

  async function handleFinish() {
    setBusy(true);
    setError(null);
    const result = await completeOnboarding({
      business_name: businessName.trim(),
      my_name: myName.trim(),
      timezone,
      schedule_cycle: cycle,
      has_ratio: hasRatio === true,
      ratio_slot_minutes: slotMinutes,
      state: hasRatio ? state : null,
      max_techs_per_pharmacist: hasRatio ? maxTechs : null,
      ratio_notes: hasRatio ? ratioNotes : null,
      locations: locations.map((l) => ({
        name: l.name.trim(),
        address: l.address.trim() || null,
        isolated_rooms: l.isolated_rooms.filter((r) => r.trim()),
      })),
      departments: [],
      work_types: workTypes
        .filter((w) => w.enabled)
        .map((w) => ({
          name: w.name,
          counts_as: w.counts_as,
          counting_default: w.counting_default,
          is_specialized: w.is_specialized,
        })),
      staff: staffRows.map((s) => ({
        full_name: s.full_name,
        login_email: s.login_email || null,
        work_email: s.work_email || null,
        job_title: s.job_title || null,
        ratio_type: s.ratio_type as "pharmacist" | "technician" | "non_counting",
        employment_type: s.employment_type as
          | "full_time"
          | "part_time"
          | "per_diem"
          | "contractor_1099",
      })),
      branding_color: null,
      branding_logo_url: null,
    });
    if (result.ok) {
      // Hard navigation: guarantees a clean session-aware render, avoids
      // the push/refresh router race that froze the first walkthrough
      window.location.assign("/app/dashboard");
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  const summaryRows: { label: string; value: string }[] = [
    { label: "Pharmacy", value: businessName || "—" },
    {
      label: "Locations",
      value: locations.map((l) => l.name).filter(Boolean).join(", ") || "—",
    },
    {
      label: "Ratio",
      value: hasRatio
        ? `${state} — max ${maxTechs} techs per pharmacist, ${slotMinutes}-minute slots`
        : "No fixed ratio (documentation still on)",
    },
    { label: "Cycle", value: cycle.charAt(0).toUpperCase() + cycle.slice(1) },
    {
      label: "Work types",
      value: `${workTypes.filter((w) => w.enabled).length} selected`,
    },
    {
      label: "Staff",
      value:
        staffRows.length > 0
          ? `${staffRows.length} people imported`
          : "None yet — add them later in Staff",
    },
    { label: "Your role", value: `${myName} — Owner/Admin, primary PTO approver` },
  ];

  return (
    <main className="min-h-screen bg-page px-6 py-10">
      {busy && <CreatingOverlay failed={!!error} />}
      <div className="mx-auto max-w-[640px]">
        <div className="mb-8 flex items-center gap-3">
          <RxShiftMark size={42} />
          <div>
            <p className="font-brand text-lg font-bold text-navy">
              Set up your pharmacy
            </p>
            <p className="font-body text-xs text-steel">
              Step {step + 1} of {STEPS.length} — {STEPS[step]}
            </p>
          </div>
        </div>

        <div className="mb-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-amber" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="rounded-[10px] border border-line bg-surface p-8 shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
          {step === 0 && (
            <div className="space-y-6">
              {/* AI quick-start */}
              <div className="rounded-lg border border-line bg-cloud/50 p-4">
                <p className="font-brand text-[10px] font-bold uppercase tracking-[1.8px] text-amber">
                  Quick start
                </p>
                <p className="mt-1.5 font-body text-sm text-steel">
                  Describe your pharmacy in a sentence or two and we&rsquo;ll
                  prefill the steps. You&rsquo;ll confirm everything.
                </p>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder='e.g. "Two retail pharmacies in Las Vegas, one has a sterile compounding room. Nevada ratio rules. We schedule monthly."'
                  className="mt-3"
                />
                <div className="mt-2.5 flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleQuickStart}
                    disabled={quickStartBusy || description.trim().length < 10}
                  >
                    {quickStartBusy ? "Reading…" : "Prefill from description"}
                  </Button>
                  {quickStartNote && (
                    <span className="font-body text-xs text-steel">
                      {quickStartNote}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="biz">Pharmacy or business name</Label>
                <Input
                  id="biz"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Southwest Medical Pharmacy"
                />
              </div>
              <div>
                <Label htmlFor="myname">Your name</Label>
                <Input
                  id="myname"
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                  placeholder="Your full name"
                />
                <HelpText>
                  You&rsquo;re signing in as {userEmail} — you&rsquo;ll be the
                  Owner/Admin and primary PTO approver. Both are changeable
                  later in Settings.
                </HelpText>
              </div>
              <div>
                <Label htmlFor="tz">Timezone</Label>
                <Select
                  id="tz"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="font-body text-sm text-steel">
                Add each physical pharmacy location. Operating hours,
                departments, and ratio zones can be refined later in Settings.
              </p>
              {locations.map((loc, i) => (
                <div key={i} className="rounded-lg border border-line bg-cloud/40 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Location name</Label>
                      <Input
                        value={loc.name}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((l, idx) =>
                              idx === i ? { ...l, name: e.target.value } : l
                            )
                          )
                        }
                        placeholder={i === 0 ? "Main pharmacy" : "Second location"}
                      />
                    </div>
                    <div>
                      <Label>Address (optional)</Label>
                      <Input
                        value={loc.address}
                        onChange={(e) =>
                          setLocations((prev) =>
                            prev.map((l, idx) =>
                              idx === i ? { ...l, address: e.target.value } : l
                            )
                          )
                        }
                      />
                    </div>
                  </div>
                  {locations.length > 1 && (
                    <button
                      onClick={() =>
                        setLocations((prev) => prev.filter((_, idx) => idx !== i))
                      }
                      className="mt-2 font-body text-xs font-medium text-deficiency hover:underline"
                    >
                      Remove location
                    </button>
                  )}
                </div>
              ))}
              {locations.length < 25 && (
                <button
                  onClick={() =>
                    setLocations((prev) => [
                      ...prev,
                      { name: "", address: "", isolated_rooms: [] },
                    ])
                  }
                  className="font-body text-sm font-medium text-navy underline-offset-2 hover:underline"
                >
                  + Add another location
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="font-brand text-base font-semibold text-navy">
                Do you have a pharmacist-to-technician ratio requirement?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setHasRatio(true);
                    if (!proposal) fetchProposal(state);
                  }}
                  className={`flex-1 rounded-lg border-2 p-4 text-left transition-colors ${
                    hasRatio === true
                      ? "border-amber bg-amber/5"
                      : "border-line hover:border-steel/40"
                  }`}
                >
                  <p className="font-brand text-sm font-bold text-navy">Yes</p>
                  <p className="mt-1 font-body text-xs text-steel">
                    My state limits how many techs a pharmacist may supervise.
                  </p>
                </button>
                <button
                  onClick={() => setHasRatio(false)}
                  className={`flex-1 rounded-lg border-2 p-4 text-left transition-colors ${
                    hasRatio === false
                      ? "border-amber bg-amber/5"
                      : "border-line hover:border-steel/40"
                  }`}
                >
                  <p className="font-brand text-sm font-bold text-navy">No</p>
                  <p className="mt-1 font-body text-xs text-steel">
                    No fixed ratio — I still want documented, defensible
                    scheduling.
                  </p>
                </button>
              </div>

              {hasRatio === true && (
                <div className="space-y-4 border-t border-line pt-5">
                  <div className="max-w-[200px]">
                    <Label htmlFor="state">Your state</Label>
                    <Select
                      id="state"
                      value={state}
                      onChange={(e) => {
                        setState(e.target.value);
                        fetchProposal(e.target.value);
                      }}
                    >
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </div>

                  {proposalLoading && (
                    <p className="font-body text-sm text-steel">
                      Looking up {state}&rsquo;s ratio rule…
                    </p>
                  )}

                  {proposal && !proposalLoading && (
                    <div className="rounded-lg border border-line bg-cloud/50 p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          tone={proposal.source === "verified_seed" ? "compliant" : "alert"}
                        >
                          {proposal.source === "verified_seed"
                            ? "Verified source"
                            : "AI proposal — verify"}
                        </Badge>
                        {proposal.citation && (
                          <span className="font-body text-xs text-steel">
                            {proposal.citation}
                          </span>
                        )}
                      </div>
                      <p className="font-body text-[13px] leading-relaxed text-navy">
                        {proposal.notes}
                      </p>
                    </div>
                  )}

                  <div className="max-w-[240px]">
                    <Label htmlFor="maxTechs">
                      Max techs per pharmacist (confirm or edit)
                    </Label>
                    <Input
                      id="maxTechs"
                      type="number"
                      min={1}
                      max={10}
                      value={maxTechs}
                      onChange={(e) => setMaxTechs(Number(e.target.value))}
                    />
                  </div>

                  <div>
                    <Label>
                      Isolated rooms (sterile / IV compounding), if any
                    </Label>
                    <HelpText>
                      An isolated room counts its ratio independently from the
                      main floor. One per line, per location.
                    </HelpText>
                    {locations.map((loc, i) => (
                      <div key={i} className="mt-2">
                        {locations.length > 1 && (
                          <p className="mb-1 font-body text-xs font-medium text-navy">
                            {loc.name || `Location ${i + 1}`}
                          </p>
                        )}
                        <Textarea
                          rows={1}
                          value={loc.isolated_rooms.join("\n")}
                          onChange={(e) =>
                            setLocations((prev) =>
                              prev.map((l, idx) =>
                                idx === i
                                  ? { ...l, isolated_rooms: e.target.value.split("\n") }
                                  : l
                              )
                            )
                          }
                          placeholder="e.g. Sterile Compounding Room (leave empty if none)"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="cycle">Schedule cycle</Label>
                <Select
                  id="cycle"
                  value={cycle}
                  onChange={(e) => setCycle(e.target.value as typeof cycle)}
                >
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </Select>
                <HelpText>
                  How far ahead you publish. Biweekly tends to reduce unplanned
                  callouts.
                </HelpText>
              </div>
              {hasRatio && (
                <div>
                  <Label htmlFor="slot">Ratio slot length</Label>
                  <Select
                    id="slot"
                    value={String(slotMinutes)}
                    onChange={(e) =>
                      setSlotMinutes(Number(e.target.value) as 15 | 30 | 60)
                    }
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes (recommended)</option>
                    <option value="60">60 minutes</option>
                  </Select>
                  <HelpText>
                    How finely ratio is evaluated. The Compliance Record always
                    rolls up to hourly.
                  </HelpText>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <p className="mb-4 font-body text-sm text-steel">
                Work types decide whether someone counts toward the ratio in a
                given block — production counts, inventory doesn&rsquo;t.
                Uncheck what you don&rsquo;t use, add your own below, and
                fine-tune any of it later in Settings → Work Types.
              </p>
              <div className="space-y-2">
                {workTypes.map((w, i) => (
                  <label
                    key={`${w.name}-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-line p-3"
                  >
                    <input
                      type="checkbox"
                      checked={w.enabled}
                      onChange={(e) =>
                        setWorkTypes((prev) =>
                          prev.map((x, idx) =>
                            idx === i ? { ...x, enabled: e.target.checked } : x
                          )
                        )
                      }
                      className="h-4 w-4 accent-amber"
                    />
                    <span className="flex-1 font-body text-sm font-medium text-navy">
                      {w.name}
                    </span>
                    <Badge tone={w.counting_default ? "compliant" : "neutral"}>
                      {w.counting_default ? "Counts" : "Doesn't count"}
                    </Badge>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex items-end gap-2 rounded-lg border border-dashed border-line p-3">
                <div className="flex-1">
                  <Label>Add your own</Label>
                  <Input
                    value={newWorkType}
                    onChange={(e) => setNewWorkType(e.target.value)}
                    placeholder="e.g. Drive-through, Vaccinations"
                  />
                </div>
                <Select
                  value={newWorkTypeCounts ? "yes" : "no"}
                  onChange={(e) => setNewWorkTypeCounts(e.target.value === "yes")}
                  className="!w-36"
                >
                  <option value="yes">Counts</option>
                  <option value="no">Doesn&rsquo;t count</option>
                </Select>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!newWorkType.trim()) return;
                    setWorkTypes((prev) => [
                      ...prev,
                      {
                        name: newWorkType.trim(),
                        counts_as: "technician",
                        counting_default: newWorkTypeCounts,
                        is_specialized: false,
                        enabled: true,
                      },
                    ]);
                    setNewWorkType("");
                  }}
                  disabled={!newWorkType.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="font-body text-sm text-steel">
                Upload your roster as a CSV — AI maps your columns
                automatically, whatever they&rsquo;re called. Or skip and add
                people later.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsv}
                disabled={csvBusy}
                className="block font-body text-sm text-steel file:mr-4 file:rounded-md file:border-0 file:bg-amber file:px-4 file:py-2 file:font-brand file:text-sm file:font-bold file:text-white hover:file:bg-amber-dark"
              />
              {csvBusy && (
                <p className="font-body text-sm text-steel">
                  Reading your file and mapping columns…
                </p>
              )}
              {csvNote && !csvBusy && (
                <p className="font-body text-sm text-steel">{csvNote}</p>
              )}
              {staffRows.length > 0 && (
                <div className="rounded-lg border border-line bg-cloud/40 p-4">
                  <p className="font-body text-sm font-medium text-navy">
                    {staffRows.length} people ready to import
                  </p>
                  <p className="mt-1 font-body text-xs text-steel">
                    {staffRows.filter((s) => s.ratio_type === "pharmacist").length}{" "}
                    pharmacists ·{" "}
                    {staffRows.filter((s) => s.ratio_type === "technician").length}{" "}
                    technicians ·{" "}
                    {staffRows.filter((s) => s.ratio_type === "non_counting").length}{" "}
                    non-counting
                  </p>
                  <ul className="mt-2 font-body text-xs text-steel">
                    {staffRows.slice(0, 4).map((s, i) => (
                      <li key={i}>
                        {s.full_name}
                        {s.job_title ? ` — ${s.job_title}` : ""} ({s.ratio_type})
                      </li>
                    ))}
                    {staffRows.length > 4 && <li>…and {staffRows.length - 4} more</li>}
                  </ul>
                  <button
                    onClick={() => {
                      setStaffRows([]);
                      setCsvNote(null);
                    }}
                    className="mt-2 font-body text-xs font-medium text-deficiency hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div>
              <p className="mb-5 font-brand text-base font-semibold text-navy">
                Ready to create your workspace
              </p>
              <dl className="divide-y divide-line rounded-lg border border-line">
                {summaryRows.map((row) => (
                  <div key={row.label} className="flex gap-4 px-4 py-3">
                    <dt className="w-28 shrink-0 font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                      {row.label}
                    </dt>
                    <dd className="font-body text-sm text-navy">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-body text-xs text-steel">
                Everything here is changeable in Settings after setup.
              </p>
              {error && (
                <p className="mt-3 font-body text-sm text-deficiency">{error}</p>
              )}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
            >
              ← Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue()}>
                Continue →
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={busy}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

"use client";

// AI-assisted onboarding wizard (scoping Appendix B). Each step gathers
// plain answers; AI proposes the state ratio rule; the user confirms or
// edits everything; one server action creates the whole workspace.

import { useState } from "react";
import { useRouter } from "next/navigation";
import RxShiftMark from "@/components/rxshift-mark";
import Badge from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { HelpText, Input, Label, Select, Textarea } from "@/components/ui/form";
import { TIMEZONES, US_STATES, WORK_TYPE_SEEDS } from "@/lib/seeds";
import {
  guessField,
  normalizeEmploymentType,
  normalizeRatioType,
  parseCsv,
} from "@/lib/csv";
import {
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

const STEPS = [
  "Your pharmacy",
  "Locations",
  "Ratio",
  "Schedule",
  "Work types",
  "Your staff",
  "Finish",
];

export default function OnboardingWizard({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const [workTypes, setWorkTypes] = useState(
    WORK_TYPE_SEEDS.map((w) => ({ ...w, enabled: true }))
  );
  // Step 6
  const [staffRows, setStaffRows] = useState<StaffDraft[]>([]);

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

  function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      if (parsed.length < 2) return;
      const mapping = parsed[0].map((h) => guessField(h));
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
          else rec[field as keyof Omit<StaffDraft, "ratio_type" | "employment_type">] = raw;
        });
        return rec;
      });
      setStaffRows(rows.filter((r) => r.full_name));
    };
    reader.readAsText(file);
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
      router.push("/app/dashboard");
      router.refresh();
    } else {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-page px-6 py-10">
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

        {/* Progress */}
        <div className="mb-8 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-amber" : "bg-line"}`}
            />
          ))}
        </div>

        <div className="rounded-[10px] border border-line bg-white p-8 shadow-[0_1px_3px_rgba(28,47,94,0.08)]">
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <Label htmlFor="biz">Pharmacy or business name</Label>
                <Input
                  id="biz"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Southwest Medical Pharmacy"
                  autoFocus
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
                      className="mt-2 font-body text-xs font-medium text-[#C0392B] hover:underline"
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
                                  ? {
                                      ...l,
                                      isolated_rooms:
                                        e.target.value.split("\n"),
                                    }
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
                  onChange={(e) =>
                    setCycle(e.target.value as typeof cycle)
                  }
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
                    How finely ratio is evaluated. The compliance record always
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
                We&rsquo;ve preloaded the common ones; uncheck any you
                don&rsquo;t use. Everything is editable later.
              </p>
              <div className="space-y-2">
                {workTypes.map((w, i) => (
                  <label
                    key={w.name}
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
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <p className="font-body text-sm text-steel">
                Upload your roster as a CSV (we&rsquo;ll auto-map the columns),
                or skip and add people later.
              </p>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsv}
                className="block font-body text-sm text-steel file:mr-4 file:rounded-md file:border-0 file:bg-amber file:px-4 file:py-2 file:font-brand file:text-sm file:font-bold file:text-white hover:file:bg-amber-dark"
              />
              {staffRows.length > 0 && (
                <div className="rounded-lg border border-line bg-cloud/40 p-4">
                  <p className="font-body text-sm font-medium text-navy">
                    {staffRows.length} people ready to import:
                  </p>
                  <p className="mt-1 font-body text-xs text-steel">
                    {staffRows.filter((s) => s.ratio_type === "pharmacist").length}{" "}
                    pharmacists ·{" "}
                    {staffRows.filter((s) => s.ratio_type === "technician").length}{" "}
                    technicians ·{" "}
                    {staffRows.filter((s) => s.ratio_type === "non_counting").length}{" "}
                    non-counting
                  </p>
                  <button
                    onClick={() => setStaffRows([])}
                    className="mt-2 font-body text-xs font-medium text-[#C0392B] hover:underline"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <p className="font-brand text-base font-semibold text-navy">
                Ready to create {businessName || "your workspace"}.
              </p>
              <ul className="space-y-1.5 font-body text-sm text-steel">
                <li>
                  • {locations.length} location{locations.length === 1 ? "" : "s"}
                </li>
                <li>
                  • Ratio:{" "}
                  {hasRatio
                    ? `${state} — max ${maxTechs} techs per pharmacist (${slotMinutes}-minute slots)`
                    : "no fixed ratio (documentation still on)"}
                </li>
                <li>• {cycle} schedule cycle</li>
                <li>
                  • {workTypes.filter((w) => w.enabled).length} work types
                </li>
                <li>
                  • {staffRows.length} staff imported (you&rsquo;re added as
                  Owner/Admin)
                </li>
              </ul>
              <p className="font-body text-xs text-steel">
                Everything here is changeable in Settings.
              </p>
              {error && (
                <p className="font-body text-sm text-[#C0392B]">{error}</p>
              )}
            </div>
          )}

          {/* Nav buttons */}
          <div className="mt-8 flex items-center justify-between border-t border-line pt-5">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
            >
              ← Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canContinue()}
              >
                Continue →
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={busy}>
                {busy ? "Creating your workspace…" : "Create workspace"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

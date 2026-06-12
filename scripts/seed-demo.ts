// Seeds the "OptumRx Demo" tenant — realistic SMRX/SMMS structure from the
// retired Optum-Schedule-Demo prototype, for stakeholders (Susie, Lucy,
// Brandi) to explore.
//
// EMAIL SAFETY — four independent locks:
//   1. Every staff record is seeded with NULL login/work emails.
//   2. The tenant is created with outbound_email_enabled = false.
//   3. The tenant is created with status = 'trial': even if the kill switch
//      is later turned on, a trial tenant only emails addresses on its
//      email_allowlist (set per-tenant in the admin console) — never the
//      roster at large.
//   4. No app_user rows are created, so nobody can sign into it directly;
//      platform admins reach it through the admin console.
//
// Run: npx tsx scripts/seed-demo.ts

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { evaluateZone } from "../lib/engine/ratio";
import { generateComplianceRecord } from "../lib/engine/compliance";
import type { EngineSegment } from "../lib/engine/types";

// ── env ──────────────────────────────────────────────────────────────────────
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const TENANT_NAME = "OptumRx Demo";
const PERIOD_START = "2026-06-01";
const PERIOD_END = "2026-06-30";

type Cycle = "weekly" | "biweekly" | "monthly";
type RatioType = "pharmacist" | "technician" | "non_counting";
type Emp = "full_time" | "part_time" | "per_diem" | "contractor_1099";

interface StaffSeed {
  name: string;
  title: string;
  ratio: RatioType;
  emp?: Emp;
  dept?: string; // department name at SMRX
}

// Names/roles from the Optum prototype roster — NO email addresses, ever.
const STAFF: StaffSeed[] = [
  // Pharmacists — full time
  { name: "James Edwards", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Juliana Murdasanu", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Fariba Borashan", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Hiep Tran", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Sherley Tsang", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Bruce Dang", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Victor Nguyen", title: "Pharmacist", ratio: "pharmacist" },
  { name: "Ashley Dinh", title: "Pharmacist (Graveyard)", ratio: "pharmacist" },
  // Pharmacists — per diem (960-hour annual cap)
  { name: "Maria Cruz", title: "Pharmacist (Per Diem)", ratio: "pharmacist", emp: "per_diem" },
  { name: "Matthew Daly", title: "Pharmacist (Per Diem)", ratio: "pharmacist", emp: "per_diem" },
  { name: "Mai Trasmano", title: "Float Pharmacist (Per Diem)", ratio: "pharmacist", emp: "per_diem" },
  // Pharmacist managers
  { name: "Susan Monahan West", title: "Pharmacist in Charge — SMMS", ratio: "pharmacist" },
  { name: "Jennifer Vo", title: "Manager-RPh", ratio: "pharmacist" },
  { name: "Lucy Kim", title: "Scheduler / Pharmacist", ratio: "pharmacist" },
  // Leadership / admin — never count
  { name: "Brandy Depoorter", title: "Pharmacy Director", ratio: "non_counting" },
  { name: "Jeremy Garcia", title: "Operations Admin", ratio: "non_counting" },
  // Tech supervisors — never count
  { name: "Amanda Jeffords", title: "Tech Supervisor — Hospice", ratio: "non_counting" },
  { name: "Ida Bernardo", title: "Tech Supervisor — SPC Infusion", ratio: "non_counting" },
  { name: "Dustin Harwood", title: "Tech Supervisor — Homeside", ratio: "non_counting" },
  // Home Infusion (Homeside) technicians
  { name: "Edwin Fierros", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Cheyenne Cacal", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Lynarose Aquino", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Sharon Silva", title: "Tech — Utility/Project", ratio: "technician", dept: "Home Infusion" },
  { name: "Shantel Izumigawa", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Cassidy Patacsil", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Mary Rose Wells", title: "Tech — IV/TPN", ratio: "technician", dept: "Home Infusion" },
  { name: "Julie Ramirez", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Lonelee Stack", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Ivan Alcaraz-Ariza", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Amber Oliver", title: "Tech — IJ-MD", ratio: "technician", dept: "Home Infusion" },
  { name: "Crystal Ponce-Carrasco", title: "Tech — Counter/TXTC", ratio: "technician", dept: "Home Infusion" },
  { name: "Donna Johnson", title: "Tech — Counter/IV", ratio: "technician", dept: "Home Infusion" },
  { name: "Melissa Morse", title: "Pharmacy Technician", ratio: "technician", dept: "Home Infusion" },
  { name: "Gina Nelson", title: "Tech — IJ-MD/Training", ratio: "technician", dept: "Home Infusion" },
  // Hospice technicians
  { name: "Genea Hart", title: "Tech — OE/Expeditor", ratio: "technician", dept: "Hospice" },
  { name: "Gergana Aleksieva", title: "Pharmacy Technician", ratio: "technician", dept: "Hospice" },
  { name: "Kyla Calilung", title: "Pharmacy Technician", ratio: "technician", dept: "Hospice" },
  { name: "Agustina Heath", title: "Pharmacy Technician", ratio: "technician", dept: "Hospice" },
  { name: "Angelica Fridy", title: "Tech — IV Runner", ratio: "technician", dept: "Hospice" },
  { name: "Karen Ayala Gutierrez", title: "Tech — Inventory/OE", ratio: "technician", dept: "Hospice" },
  // Special-function techs — present but usually not counting
  { name: "Alyssa Young", title: "Tech — Inventory Only", ratio: "technician", dept: "Home Infusion" },
  { name: "Debra Fernandez", title: "Tech — Billing Only", ratio: "technician", dept: "Home Infusion" },
  { name: "Angie McLeod", title: "Tech — SPC/IV Runner", ratio: "technician", dept: "SPC Compounding" },
  { name: "Maria Lim", title: "Tech — Multi-Department", ratio: "technician", dept: "Hospice" },
];

// Work types — Optum's table mapped to the RxShift model
const WORK_TYPES = [
  { name: "Working (on floor)", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "Training", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "IV / TPN", counts_as: "technician", counting_default: true, is_specialized: true },
  { name: "Hospice Shift", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "Runner (Homeside)", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "SPC Compounding", counts_as: "technician", counting_default: true, is_specialized: true },
  { name: "Charts / Clinical", counts_as: "pharmacist", counting_default: true, is_specialized: false },
  { name: "CCC (Clinical Call Center)", counts_as: "pharmacist", counting_default: false, is_specialized: false },
  { name: "Utility / Project", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Inventory", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Billing", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Remote", counts_as: "none", counting_default: false, is_specialized: false },
  { name: "Meeting", counts_as: "none", counting_default: false, is_specialized: false },
  { name: "Supervisor", counts_as: "none", counting_default: false, is_specialized: false },
] as const;

// ── schedule pattern helpers ────────────────────────────────────────────────

function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const stop = new Date(`${end}T00:00:00Z`);
  while (d <= stop) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=Sun

interface Pattern {
  staff: string;
  days: number[]; // weekdays scheduled
  start: string;
  end: string;
  workType?: string; // default Working
  zone?: "main" | "spc";
  notBefore?: string; // skip dates before (maternity return etc.)
  daysOverride?: { day: number; start: string; end: string; workType?: string; zone?: "main" | "spc" }[];
}

const PATTERNS: Pattern[] = [
  // Pharmacists
  { staff: "James Edwards", days: [1, 2, 3, 4, 5], start: "08:30", end: "17:00",
    daysOverride: [{ day: 4, start: "08:30", end: "17:00", workType: "CCC (Clinical Call Center)" }] }, // Thursdays on CCC — off-floor
  { staff: "Fariba Borashan", days: [2, 3, 4, 5], start: "07:30", end: "18:00" },
  { staff: "Hiep Tran", days: [2, 3, 4, 5, 6], start: "07:30", end: "15:30",
    daysOverride: [{ day: 6, start: "08:00", end: "17:00" }] },
  { staff: "Sherley Tsang", days: [0, 1, 2, 3, 4], start: "09:30", end: "19:00" },
  { staff: "Bruce Dang", days: [0, 1, 2, 3], start: "07:30", end: "18:00" },
  { staff: "Victor Nguyen", days: [3, 4, 5, 6], start: "07:30", end: "18:00",
    daysOverride: [{ day: 3, start: "07:30", end: "18:00", workType: "SPC Compounding", zone: "spc" }] }, // Wednesdays in the SPC room
  { staff: "Ashley Dinh", days: [2, 3, 4], start: "20:00", end: "07:30" }, // graveyard, spills past midnight
  { staff: "Susan Monahan West", days: [1, 2, 3, 4, 5], start: "08:00", end: "17:00" },
  { staff: "Jennifer Vo", days: [1, 2, 3, 4, 5], start: "10:30", end: "19:00" },
  { staff: "Lucy Kim", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30" },
  { staff: "Maria Cruz", days: [3, 6], start: "10:30", end: "19:00",
    daysOverride: [{ day: 6, start: "08:00", end: "17:00" }] },
  { staff: "Juliana Murdasanu", days: [1, 2, 3, 4], start: "08:30", end: "19:00", notBefore: "2026-06-22" }, // back from leave Jun 20
  // Homeside techs — early / standard / late blocks
  { staff: "Edwin Fierros", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00" },
  { staff: "Cheyenne Cacal", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00" },
  { staff: "Lynarose Aquino", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00",
    daysOverride: [{ day: 6, start: "08:00", end: "16:30" }] },
  { staff: "Mary Rose Wells", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00", workType: "IV / TPN" },
  { staff: "Cassidy Patacsil", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30" },
  { staff: "Julie Ramirez", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30" },
  { staff: "Ivan Alcaraz-Ariza", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30" },
  { staff: "Donna Johnson", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30" },
  { staff: "Melissa Morse", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30",
    daysOverride: [{ day: 0, start: "08:00", end: "16:30" }] },
  { staff: "Shantel Izumigawa", days: [0, 1, 2, 3, 4], start: "08:00", end: "16:30" },
  { staff: "Amber Oliver", days: [1, 2, 3, 4, 5], start: "10:30", end: "19:00" },
  { staff: "Lonelee Stack", days: [1, 2, 3, 4, 5], start: "10:30", end: "19:00" },
  { staff: "Gina Nelson", days: [2, 3, 4, 5, 6], start: "10:30", end: "19:00" },
  { staff: "Crystal Ponce-Carrasco", days: [1, 2, 3, 4], start: "08:00", end: "16:30",
    daysOverride: [{ day: 5, start: "10:30", end: "19:00" }] }, // Friday late — evening ratio pressure
  { staff: "Sharon Silva", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Utility / Project" },
  // Hospice techs
  { staff: "Genea Hart", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00", workType: "Hospice Shift" },
  { staff: "Gergana Aleksieva", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00", workType: "Hospice Shift" },
  { staff: "Kyla Calilung", days: [1, 2, 3, 4, 5], start: "09:30", end: "18:00", workType: "Hospice Shift" },
  { staff: "Agustina Heath", days: [1, 2, 3, 4, 5], start: "09:30", end: "18:00", workType: "Hospice Shift" },
  { staff: "Angelica Fridy", days: [1, 2, 3, 4, 5], start: "07:30", end: "16:00", workType: "IV / TPN" },
  { staff: "Karen Ayala Gutierrez", days: [3, 4, 5], start: "08:00", end: "16:30", workType: "Hospice Shift",
    daysOverride: [
      { day: 1, start: "08:00", end: "16:30", workType: "Inventory" },
      { day: 2, start: "08:00", end: "16:30", workType: "Inventory" },
    ] }, // inventory Mon/Tue (documented non-counting), hospice rest
  // Always-non-counting functions — present, documented, not counted
  { staff: "Alyssa Young", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Inventory" },
  { staff: "Debra Fernandez", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Billing" },
  { staff: "Angie McLeod", days: [3], start: "08:00", end: "16:30", workType: "SPC Compounding", zone: "spc",
    daysOverride: [
      { day: 1, start: "08:00", end: "16:30", workType: "IV / TPN", zone: "main" },
      { day: 2, start: "08:00", end: "16:30", workType: "IV / TPN", zone: "main" },
      { day: 4, start: "08:00", end: "16:30", workType: "IV / TPN", zone: "main" },
      { day: 5, start: "08:00", end: "16:30", workType: "IV / TPN", zone: "main" },
    ] }, // SPC room on Wednesdays alongside Victor; main-floor IV otherwise
  // Supervisors / admin — scheduled, never counting
  { staff: "Amanda Jeffords", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Supervisor" },
  { staff: "Dustin Harwood", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Supervisor" },
  { staff: "Ida Bernardo", days: [1, 2, 3, 4, 5], start: "08:00", end: "16:30", workType: "Supervisor" },
];

async function main() {
  console.log("Seeding OptumRx Demo tenant…");

  // Refuse to double-seed
  const { data: existing } = await supabase
    .from("tenant")
    .select("id")
    .eq("name", TENANT_NAME)
    .maybeSingle();
  if (existing) {
    console.log("Tenant already exists — delete it first (admin console or danger zone).");
    process.exit(1);
  }

  // 1. Tenant — outbound email HARD OFF, lifecycle 'trial'
  const { data: tenant, error: tErr } = await supabase
    .from("tenant")
    .insert({
      name: TENANT_NAME,
      timezone: "America/Los_Angeles",
      schedule_cycle: "monthly" satisfies Cycle,
      ratio_slot_minutes: 30,
      has_ratio: true,
      onboarding_complete: true,
      outbound_email_enabled: false,
      status: "trial",
    })
    .select("id")
    .single();
  if (tErr) throw tErr;
  const tenantId = tenant.id;
  console.log(`tenant ${tenantId} (outbound email DISABLED)`);

  // 2. Ratio rule — NV 1:3
  const { data: rule } = await supabase
    .from("ratio_rule")
    .insert({
      tenant_id: tenantId,
      state: "NV",
      max_techs_per_pharmacist: 3,
      source_citation: "NAC 639.250; NRS 639.1371",
      notes: "Nevada non-institutional retail default: 1 pharmacist : 3 technicians.",
    })
    .select("id")
    .single();

  // 3. Locations
  const { data: smrx } = await supabase
    .from("location")
    .insert({ tenant_id: tenantId, name: "SMRX — Southwest Medical Pharmacy", address: "6720 Placid St, Las Vegas, NV" })
    .select("id")
    .single();
  const { data: smms } = await supabase
    .from("location")
    .insert({ tenant_id: tenantId, name: "SMMS — Medication Services (opens Jul 1)", address: "Las Vegas, NV" })
    .select("id")
    .single();

  // 4. Zones
  const { data: mainZone } = await supabase
    .from("ratio_zone")
    .insert({ tenant_id: tenantId, location_id: smrx!.id, name: "SMRX Main Floor", ratio_isolated: false, ratio_rule_id: rule!.id })
    .select("id")
    .single();
  const { data: spcZone } = await supabase
    .from("ratio_zone")
    .insert({ tenant_id: tenantId, location_id: smrx!.id, name: "SMRX SPC Compounding (isolated)", ratio_isolated: true, ratio_rule_id: rule!.id })
    .select("id")
    .single();
  await supabase
    .from("ratio_zone")
    .insert({ tenant_id: tenantId, location_id: smms!.id, name: "SMMS Main", ratio_isolated: false, ratio_rule_id: rule!.id });

  // 5. Departments
  const deptNames = ["Home Infusion", "Hospice", "SPC Compounding"];
  const deptIds = new Map<string, string>();
  for (const name of deptNames) {
    const { data } = await supabase
      .from("department")
      .insert({ tenant_id: tenantId, location_id: smrx!.id, name })
      .select("id")
      .single();
    deptIds.set(name, data!.id);
  }
  await supabase.from("department").insert([
    { tenant_id: tenantId, location_id: smms!.id, name: "Specialty Pharmacy" },
    { tenant_id: tenantId, location_id: smms!.id, name: "Treatment Center" },
  ]);

  // 6. Work types
  const { data: wtRows, error: wtErr } = await supabase
    .from("work_type")
    .insert(WORK_TYPES.map((w) => ({ ...w, tenant_id: tenantId })))
    .select("id, name");
  if (wtErr) throw wtErr;
  const wtIds = new Map(wtRows!.map((w) => [w.name, w.id]));

  // 7. Staff — NO EMAILS, by design
  const { data: staffRows, error: sErr } = await supabase
    .from("staff")
    .insert(
      STAFF.map((s) => ({
        tenant_id: tenantId,
        home_location_id: smrx!.id,
        full_name: s.name,
        login_email: null,
        work_email: null,
        job_title: s.title,
        ratio_type: s.ratio,
        employment_type: s.emp ?? "full_time",
      }))
    )
    .select("id, full_name");
  if (sErr) throw sErr;
  const staffIds = new Map(staffRows!.map((s) => [s.full_name, s.id]));
  console.log(`${staffRows!.length} staff (all emails NULL)`);

  // 8. Constraint rules
  const perDiems = ["Maria Cruz", "Matthew Daly", "Mai Trasmano"];
  await supabase.from("constraint_rule").insert([
    ...perDiems.map((name) => ({
      tenant_id: tenantId,
      scope_type: "staff",
      scope_id: staffIds.get(name)!,
      rule_type: "hour_cap",
      params: { hours: 960, period: "year" },
      effective_start: "2026-01-01",
      active: true,
    })),
    {
      tenant_id: tenantId,
      scope_type: "staff",
      scope_id: staffIds.get("Hiep Tran")!,
      rule_type: "hard_stop",
      params: { time: "16:00", days: ["tue", "wed", "thu", "fri"] },
      effective_start: "2026-01-01",
      active: true,
    },
    {
      tenant_id: tenantId,
      scope_type: "staff",
      scope_id: staffIds.get("Bruce Dang")!,
      rule_type: "always_off",
      params: { days: ["fri"] },
      effective_start: "2026-01-01",
      active: true,
    },
    {
      tenant_id: tenantId,
      scope_type: "role",
      scope_id: "technician",
      rule_type: "overtime",
      params: { threshold_hours: 40 },
      effective_start: "2026-01-01",
      active: true,
    },
  ]);

  // 9. Schedule period (June 2026, monthly) + shifts from patterns
  const { data: period } = await supabase
    .from("schedule_period")
    .insert({
      tenant_id: tenantId,
      location_id: smrx!.id,
      cycle: "monthly",
      start_date: PERIOD_START,
      end_date: PERIOD_END,
      status: "draft",
    })
    .select("id")
    .single();

  const dates = eachDate(PERIOD_START, PERIOD_END);
  const engineSegments: EngineSegment[] = [];
  let shiftCount = 0;

  for (const pattern of PATTERNS) {
    const staffId = staffIds.get(pattern.staff);
    const meta = STAFF.find((s) => s.name === pattern.staff)!;
    if (!staffId) continue;

    for (const date of dates) {
      if (pattern.notBefore && date < pattern.notBefore) continue;
      const day = dow(date);
      const override = pattern.daysOverride?.find((o) => o.day === day);
      const scheduled = pattern.days.includes(day) || !!override;
      if (!scheduled) continue;

      const start = override?.start ?? pattern.start;
      const end = override?.end ?? pattern.end;
      const wtName = override?.workType ?? pattern.workType ?? null;
      const zoneKey = override?.zone ?? pattern.zone ?? "main";
      const zoneId = zoneKey === "spc" ? spcZone!.id : mainZone!.id;
      const workTypeId = wtName ? (wtIds.get(wtName) ?? null) : null;

      const { data: shift, error: shErr } = await supabase
        .from("shift")
        .insert({
          tenant_id: tenantId,
          location_id: smrx!.id,
          department_id: meta.dept ? (deptIds.get(meta.dept) ?? null) : null,
          ratio_zone_id: zoneId,
          staff_id: staffId,
          date,
          schedule_period_id: period!.id,
          status: "published",
        })
        .select("id")
        .single();
      if (shErr) throw shErr;

      await supabase.from("shift_segment").insert({
        shift_id: shift!.id,
        tenant_id: tenantId,
        start_time: start,
        end_time: end,
        work_type_id: workTypeId,
        counts_toward_ratio: null,
      });
      shiftCount += 1;

      const wt = wtName
        ? WORK_TYPES.find((w) => w.name === wtName) ?? null
        : null;
      engineSegments.push({
        shift_id: shift!.id,
        zone_id: zoneId,
        date,
        start_time: start,
        end_time: end,
        staff: { id: staffId, full_name: pattern.staff, ratio_type: meta.ratio },
        work_type: wt
          ? { id: "wt", name: wt.name, counts_as: wt.counts_as, counting_default: wt.counting_default }
          : null,
        counts_override: null,
      });
    }
  }
  console.log(`${shiftCount} shifts across June 2026`);

  // 10. Publish + compliance snapshots (engine-generated, same as the app)
  await supabase
    .from("schedule_period")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", period!.id);

  for (const [zoneId, zoneName] of [
    [mainZone!.id, "SMRX Main Floor"],
    [spcZone!.id, "SMRX SPC Compounding (isolated)"],
  ] as const) {
    const zoneSegs = engineSegments.filter((s) => s.zone_id === zoneId);
    if (zoneSegs.length === 0) continue;
    const evals = evaluateZone(zoneSegs, { max_techs_per_pharmacist: 3 }, 30);
    const rows = generateComplianceRecord(evals, zoneId, zoneName);
    await supabase.from("compliance_snapshot").insert({
      tenant_id: tenantId,
      schedule_period_id: period!.id,
      ratio_zone_id: zoneId,
      rows,
    });
    const deficient = rows.filter((r) => r.ratio_status === "deficient").length;
    console.log(`${zoneName}: ${rows.length} record hours, ${deficient} deficient`);
  }

  // 11. Requests to make the queues look alive
  await supabase.from("time_off_request").insert([
    {
      tenant_id: tenantId,
      staff_id: staffIds.get("Juliana Murdasanu")!,
      start_date: "2026-05-23",
      end_date: "2026-06-20",
      type: "other",
      staff_message: "Maternity leave — returning June 22.",
      status: "approved",
      decided_at: new Date("2026-05-01").toISOString(),
    },
    {
      tenant_id: tenantId,
      staff_id: staffIds.get("Kyla Calilung")!,
      start_date: "2026-07-06",
      end_date: "2026-07-10",
      type: "pto",
      staff_message: "Family trip — happy to swap hospice coverage with Tina.",
      status: "pending",
    },
    {
      tenant_id: tenantId,
      staff_id: staffIds.get("Edwin Fierros")!,
      start_date: "2026-06-26",
      end_date: "2026-06-26",
      type: "pto",
      status: "pending",
    },
  ]);

  await supabase.from("callout").insert({
    tenant_id: tenantId,
    staff_id: staffIds.get("Gergana Aleksieva")!,
    reason: "Sick — no coverage arranged yet.",
    logged_at: new Date("2026-06-10T13:45:00Z").toISOString(),
  });

  console.log("\nDone. Open the Admin Console and switch into OptumRx Demo.");
  console.log("Safety: zero email addresses seeded; tenant outbound email disabled; no sign-ins exist for this tenant.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

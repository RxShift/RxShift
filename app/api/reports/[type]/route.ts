import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { xlsxResponse, xlsxMultiSheet } from "@/lib/reports";
import { loadPeriodBundle, loadAllLocationsBundle, validateRangeBundle } from "@/lib/schedule-data";
import { fmtDay } from "@/lib/dates";
import type { ComplianceRecordRow, Location, Staff } from "@/lib/types";

/** "HH:MM" → minutes since midnight. */
function hm(t: string): number {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
}

// Basic, structured exports — not a reporting engine. Each report is a
// tenant-scoped query (RLS client) turned into a board/audit-ready .xlsx.
// Manager roles for operational reports; owner_admin for the audit trail.

const MANAGE = ["owner_admin", "scheduler", "supervisor", "read_only"];

const EMPLOYMENT: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  per_diem: "Per-diem",
  contractor_1099: "1099 contractor",
};

function hourLabel(hour: number): string {
  const h = (n: number) => `${String(n).padStart(2, "0")}:00`;
  return `${h(hour)}–${h(hour + 1)}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const session = await getSession();
  if (!session?.appUser || !session.tenant) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const role = session.appUser.role;
  const requiredRole = type === "audit" ? ["owner_admin"] : MANAGE;
  if (!requiredRole.includes(role)) {
    return NextResponse.json({ error: "Not permitted." }, { status: 403 });
  }

  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  // ── Staff roster ────────────────────────────────────────────────────────
  if (type === "staff") {
    const [{ data: staff }, { data: locations }] = await Promise.all([
      supabase.from("staff").select("*").order("full_name"),
      supabase.from("location").select("id, name"),
    ]);
    const locName = new Map(
      ((locations ?? []) as Pick<Location, "id" | "name">[]).map((l) => [
        l.id,
        l.name,
      ])
    );
    const rows = ((staff ?? []) as Staff[]).map((s) => ({
      Name: s.full_name,
      "Counts as": s.ratio_type.replace("_", " "),
      "Excluded from ratio": s.excluded_from_ratio ? "Yes" : "",
      "Certified (CPhT)": s.certified ? "Yes" : "",
      "Job title": s.job_title ?? "",
      Employment: EMPLOYMENT[s.employment_type] ?? s.employment_type,
      "Home location": s.home_location_id
        ? (locName.get(s.home_location_id) ?? "")
        : "",
      "Login email": s.login_email ?? "",
      "Work email": s.work_email ?? "",
      Status: s.active ? "Active" : "Inactive / offboarded",
    }));
    return xlsxResponse(rows, "Staff", `rxshift-staff-roster.xlsx`);
  }

  // ── Schedule export (one period) ────────────────────────────────────────
  if (type === "schedule") {
    const periodId = sp.get("period_id") ?? "";
    if (!periodId) {
      return NextResponse.json({ error: "period_id required." }, { status: 400 });
    }
    const bundle = await loadPeriodBundle(periodId);
    if (!bundle) {
      return NextResponse.json({ error: "Period not found." }, { status: 404 });
    }
    const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
    const rows = bundle.shifts
      .slice()
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          (staffById.get(a.staff_id)?.full_name ?? "").localeCompare(
            staffById.get(b.staff_id)?.full_name ?? ""
          )
      )
      .map((s) => {
        const person = staffById.get(s.staff_id);
        return {
          Date: s.date,
          Staff: person?.full_name ?? s.staff_id,
          Role: person?.ratio_type.replace("_", " ") ?? "",
          Times: s.segments
            .map(
              (g) =>
                `${String(g.start_time).slice(0, 5)}–${String(g.end_time).slice(0, 5)}`
            )
            .join(", "),
          "Unpaid break (min)": s.break_minutes ?? 0,
          Status: s.status,
        };
      });
    return xlsxResponse(
      rows,
      "Schedule",
      `rxshift-schedule-${bundle.period.start_date}-to-${bundle.period.end_date}.xlsx`
    );
  }

  // The remaining reports take a date range
  if (!dateRe.test(from) || !dateRe.test(to) || from > to) {
    return NextResponse.json(
      { error: "Valid from/to dates required." },
      { status: 400 }
    );
  }

  // ── Compliance Record (as-worked) ─────────────────────────────────────────
  if (type === "compliance-log") {
    const locationId = sp.get("location_id");

    // The board-ready export is the as-worked Compliance Record (immutable,
    // what actually happened), not the schedule-derived forecast.
    let recQuery = supabase
      .from("compliance_record")
      .select("detail, date, hour, location_id")
      .gte("date", from)
      .lte("date", to)
      .order("date")
      .order("hour");
    if (locationId) recQuery = recQuery.eq("location_id", locationId);
    const { data: recordRows } = await recQuery;

    // CPhT annotation for technicians, per the board-ready format
    const { data: staff } = await supabase
      .from("staff")
      .select("full_name, certified");
    const certified = new Set(
      ((staff ?? []) as Pick<Staff, "full_name" | "certified">[])
        .filter((s) => s.certified)
        .map((s) => s.full_name)
    );
    const cphtName = (n: string) => (certified.has(n) ? `${n} (CPhT)` : n);

    const { data: rules } = await supabase
      .from("ratio_rule")
      .select("*")
      .not("tenant_id", "is", null)
      .limit(1);
    const rule = rules?.[0];
    const ruleLabel = rule
      ? rule.formula === "additive"
        ? `Additive: first RPh allows ${rule.additive_first_techs}, each additional +${rule.additive_additional_techs} (${rule.source_citation ?? ""})`
        : `1 RPh : ${rule.max_techs_per_pharmacist} techs max (${rule.source_citation ?? ""})`
      : "";

    const out: Record<string, unknown>[] = [];
    for (const rec of (recordRows ?? []) as { detail: ComplianceRecordRow }[]) {
      const r = rec.detail;
      out.push({
        Date: r.date,
        Hour: hourLabel(r.hour),
        Location: r.location_name,
        "Pharmacist(s)": r.pharmacists_on_duty.join(", "),
        "Technician(s) counting": (r.technicians_counting as string[])
          .map(cphtName)
          .join(", "),
        "Present, not counting": r.technicians_present_non_counting
          .map((t) => `${t.name} (${t.function})`)
          .join(", "),
        "Required ratio": ruleLabel,
        Status: r.ratio_status.toUpperCase(),
        "Deficiency notes": r.deficiency_reason ?? "",
      });
    }
    out.sort((a, b) =>
      `${a.Date} ${a.Hour}`.localeCompare(`${b.Date} ${b.Hour}`)
    );
    return xlsxResponse(
      out,
      "Compliance Record",
      `rxshift-compliance-record-${from}-to-${to}.xlsx`
    );
  }

  // ── Flexible schedule export (date range × locations) ────────────────────
  if (type === "schedule-range") {
    const tenant = session.tenant;
    const locParam = sp.get("locations") ?? "all";
    const bundle = await loadAllLocationsBundle(from, to);
    const selected =
      locParam === "all" || !locParam
        ? new Set(bundle.locations.map((l) => l.id))
        : new Set(locParam.split(",").filter(Boolean));

    const validation = validateRangeBundle(bundle, tenant);
    const flagByShift = new Map<string, string[]>();
    for (const f of validation.constraintFlags) {
      if (!f.shift_id) continue;
      const list = flagByShift.get(f.shift_id) ?? [];
      list.push(f.rule_type.replace(/_/g, " "));
      flagByShift.set(f.shift_id, list);
    }

    // Compliance: simple proxy from the as-worked record — did this shift's day +
    // location have any deficient hour? (Future days have no record → blank.)
    const { data: recs } = await supabase
      .from("compliance_record")
      .select("date, location_id, ratio_status")
      .gte("date", from)
      .lte("date", to);
    const deficientCell = new Set<string>();
    const recordedCell = new Set<string>();
    for (const r of (recs ?? []) as {
      date: string;
      location_id: string;
      ratio_status: string;
    }[]) {
      recordedCell.add(`${r.date}|${r.location_id}`);
      if (r.ratio_status === "deficient")
        deficientCell.add(`${r.date}|${r.location_id}`);
    }

    const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
    const wtById = new Map(bundle.workTypes.map((w) => [w.id, w]));
    const locById = new Map(bundle.locations.map((l) => [l.id, l]));

    const detail: Record<string, unknown>[] = [];
    const byStaff = new Map<string, { name: string; role: string; hours: number; shifts: number }>();
    const byLoc = new Map<string, { name: string; hours: number; shifts: number }>();

    for (const sh of bundle.shifts) {
      if (!selected.has(sh.location_id)) continue;
      const segs = sh.segments ?? [];
      if (segs.length === 0) continue;
      const person = staffById.get(sh.staff_id);

      let mins = 0;
      for (const g of segs) {
        const s = hm(g.start_time);
        const e = hm(g.end_time);
        mins += (e <= s ? e + 1440 : e) - s; // overnight-aware
      }
      const paidHours = Math.max(0, (mins - (sh.break_minutes ?? 0)) / 60);
      const starts = segs.map((g) => String(g.start_time).slice(0, 5));
      const ends = segs.map((g) => String(g.end_time).slice(0, 5));
      const earliest = starts.reduce((a, b) => (b < a ? b : a));
      const latest = ends.reduce((a, b) => (b > a ? b : a));
      const wts = [
        ...new Set(
          segs
            .map((g) => (g.work_type_id ? wtById.get(g.work_type_id)?.name : null))
            .filter((x): x is string => !!x)
        ),
      ].join(", ");
      const cell = `${sh.date}|${sh.location_id}`;
      const compliance = deficientCell.has(cell)
        ? "Deficient hour(s)"
        : recordedCell.has(cell)
          ? "OK"
          : "";
      const flags = [
        ...(flagByShift.get(sh.id) ?? []),
        validation.deficientCells[sh.location_id]?.includes(sh.date)
          ? "ratio gap"
          : "",
      ]
        .filter(Boolean)
        .join("; ");

      detail.push({
        Date: sh.date,
        Day: fmtDay(sh.date).dow,
        Staff: person?.full_name ?? sh.staff_id,
        Role: person?.ratio_type.replace("_", " ") ?? "",
        Location: locById.get(sh.location_id)?.name ?? "",
        Start: earliest,
        End: latest,
        "Hours": Number(paidHours.toFixed(2)),
        "Work type(s)": wts,
        "Break (min)": sh.break_minutes ?? 0,
        Compliance: compliance,
        Flags: flags,
      });

      const hs =
        byStaff.get(sh.staff_id) ??
        {
          name: person?.full_name ?? "?",
          role: person?.ratio_type.replace("_", " ") ?? "",
          hours: 0,
          shifts: 0,
        };
      hs.hours += paidHours;
      hs.shifts += 1;
      byStaff.set(sh.staff_id, hs);

      const hl =
        byLoc.get(sh.location_id) ??
        { name: locById.get(sh.location_id)?.name ?? "?", hours: 0, shifts: 0 };
      hl.hours += paidHours;
      hl.shifts += 1;
      byLoc.set(sh.location_id, hl);
    }

    detail.sort((a, b) =>
      `${a.Date}|${a.Location}|${a.Staff}`.localeCompare(
        `${b.Date}|${b.Location}|${b.Staff}`
      )
    );
    const byStaffRows = [...byStaff.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({
        Staff: v.name,
        Role: v.role,
        "Total hours": Number(v.hours.toFixed(2)),
        Shifts: v.shifts,
      }));
    const byLocRows = [...byLoc.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((v) => ({
        Location: v.name,
        "Total hours": Number(v.hours.toFixed(2)),
        Shifts: v.shifts,
      }));

    return xlsxMultiSheet(
      [
        { name: "Schedule", rows: detail },
        { name: "Hours by staff", rows: byStaffRows },
        { name: "Hours by location", rows: byLocRows },
      ],
      `rxshift-schedule-${from}-to-${to}.xlsx`
    );
  }

  // ── Audit report (owner_admin only — enforced above) ───────────────────
  if (type === "audit") {
    const [{ data: log }, { data: users }, { data: staff }] =
      await Promise.all([
        supabase
          .from("activity_log")
          .select("*")
          .gte("created_at", `${from}T00:00:00Z`)
          .lte("created_at", `${to}T23:59:59Z`)
          .order("created_at", { ascending: true }),
        supabase.from("app_user").select("supabase_user_id, staff_id"),
        supabase.from("staff").select("id, full_name"),
      ]);
    const staffName = new Map(
      ((staff ?? []) as Pick<Staff, "id" | "full_name">[]).map((s) => [
        s.id,
        s.full_name,
      ])
    );
    const actorName = new Map(
      (users ?? []).map((u) => [
        u.supabase_user_id as string,
        u.staff_id ? (staffName.get(u.staff_id) ?? "Admin user") : "Admin user",
      ])
    );
    const rows = (log ?? []).map((e) => ({
      When: String(e.created_at).replace("T", " ").slice(0, 16),
      Who: e.actor_user_id
        ? (actorName.get(e.actor_user_id) ?? "Platform admin")
        : "System",
      Action: e.action,
      Entity: e.entity_type,
      Detail: e.detail ? JSON.stringify(e.detail).slice(0, 300) : "",
    }));
    return xlsxResponse(rows, "Audit", `rxshift-audit-${from}-to-${to}.xlsx`);
  }

  return NextResponse.json({ error: "Unknown report type." }, { status: 404 });
}

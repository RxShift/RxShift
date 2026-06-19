import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { xlsxResponse } from "@/lib/reports";
import { loadPeriodBundle } from "@/lib/schedule-data";
import type { ComplianceRecordRow, Location, Staff } from "@/lib/types";

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

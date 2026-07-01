import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import ComplianceRecordView, {
  type RecordLocation,
} from "@/components/app/log/compliance-record-view";
import { nowInTimeZone } from "@/lib/dates";
import type {
  ComplianceRecord,
  ComplianceRecordNote,
  Location,
} from "@/lib/types";

// The Compliance Record (as-worked) — the IMMUTABLE, hour-by-hour record of what
// actually happened, written by the finalize-compliance job. One day at a time.
export default async function ComplianceRecordPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const tenant = session!.tenant!;
  const supabase = await createClient();

  // Distinct recorded dates (RLS scopes to the tenant + managers).
  const { data: dateRows } = await supabase
    .from("compliance_record")
    .select("date")
    .order("date", { ascending: false });
  const dates = [
    ...new Set(((dateRows ?? []) as { date: string }[]).map((r) => r.date)),
  ];

  if (dates.length === 0) {
    return (
      <>
        <PageHeader title="Compliance Record" />
        <div className="flex-1 p-8">
          <EmptyState message="The Compliance Record is the immutable, hour-by-hour record of what actually happened. It fills automatically as each hour passes and a published schedule is in place. Nothing has been finalized yet." />
        </div>
      </>
    );
  }

  const today = nowInTimeZone(tenant.timezone).date;
  const valid = params.date && dates.includes(params.date) ? params.date : null;
  const selectedDate = valid ?? dates.find((d) => d <= today) ?? dates[0];

  const [{ data: recordRows }, { data: locations }] = await Promise.all([
    supabase
      .from("compliance_record")
      .select("*")
      .eq("date", selectedDate)
      .order("hour"),
    supabase.from("location").select("*"),
  ]);
  const recs = (recordRows ?? []) as ComplianceRecord[];
  const locs = (locations ?? []) as Location[];

  // Annotations for the day's rows, with author names resolved.
  const recIds = recs.map((r) => r.id);
  const [{ data: noteRows }, { data: users }, { data: staffRows }] =
    await Promise.all([
      recIds.length
        ? supabase
            .from("compliance_record_note")
            .select("*")
            .in("compliance_record_id", recIds)
            .order("created_at")
        : Promise.resolve({ data: [] as ComplianceRecordNote[] }),
      supabase.from("app_user").select("supabase_user_id, staff_id, role, display_name"),
      supabase.from("staff").select("id, full_name"),
    ]);
  const staffNameById = new Map(
    ((staffRows ?? []) as { id: string; full_name: string }[]).map((s) => [
      s.id,
      s.full_name,
    ])
  );
  const actorName = new Map<string, string>();
  for (const u of (users ?? []) as {
    supabase_user_id: string;
    staff_id: string | null;
    role: string;
    display_name: string | null;
  }[]) {
    actorName.set(
      u.supabase_user_id,
      (u.staff_id && staffNameById.get(u.staff_id)) || u.display_name || u.role || "User"
    );
  }
  const notesByRecord = new Map<
    string,
    { id: string; note: string; author: string; created_at: string }[]
  >();
  for (const n of (noteRows ?? []) as ComplianceRecordNote[]) {
    const list = notesByRecord.get(n.compliance_record_id) ?? [];
    list.push({
      id: n.id,
      note: n.note,
      author: (n.author_user_id && actorName.get(n.author_user_id)) || "Manager",
      created_at: n.created_at,
    });
    notesByRecord.set(n.compliance_record_id, list);
  }

  // Group hours by location (record order).
  const locName = new Map(locs.map((l) => [l.id, l.name]));
  const byLocation = new Map<string, RecordLocation>();
  for (const r of recs) {
    const loc = byLocation.get(r.location_id) ?? {
      locationId: r.location_id,
      locationName: locName.get(r.location_id) ?? "Location",
      hours: [],
    };
    loc.hours.push({
      id: r.id,
      hour: r.hour,
      ratio_status: r.ratio_status,
      deficiency_reason: r.deficiency_reason,
      detail: r.detail,
      notes: notesByRecord.get(r.id) ?? [],
    });
    byLocation.set(r.location_id, loc);
  }
  const records = [...byLocation.values()].sort((a, b) =>
    a.locationName.localeCompare(b.locationName)
  );

  return (
    <>
      <PageHeader title={`Compliance Record — ${selectedDate}`} />
      <div className="flex-1 p-8">
        <ComplianceRecordView
          dates={dates}
          selectedDate={selectedDate}
          records={records}
          tenantName={tenant.name}
          timeFormat={tenant.time_format}
        />
      </div>
    </>
  );
}

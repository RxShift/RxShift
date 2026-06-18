import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import Badge from "@/components/ui/badge";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import MyStatusPicker from "@/components/app/me/my-status-picker";
import AvatarUpload from "@/components/app/avatar-upload";
import AutoRefresh from "@/components/app/auto-refresh";
import { signedAvatarUrls } from "@/lib/avatars";
import { buildBoardView } from "@/lib/board-data";
import {
  addDaysStr,
  dateInTimeZone,
  eachDate,
  fmtDay,
  nowInTimeZone,
  todayStr,
} from "@/lib/dates";
import { timeToMinutes } from "@/lib/engine/ratio";
import { resolveStatuses } from "@/lib/live-status-config";
import { NEUTRAL_SHIFT_BG, readableTextColor } from "@/lib/work-type-colors";

/** Compact 12-hour label: 08:00 → 8a, 17:30 → 5:30p (fits a calendar cell) */
function compactTime(t: string): string {
  const [h, m] = String(t).slice(0, 5).split(":").map(Number);
  const ap = h >= 12 ? "p" : "a";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, "0")}${ap}`;
}
import type {
  LiveStatus,
  LiveStatusConfig,
  Shift,
  ShiftSegment,
  Staff,
  TimeOffRequest,
} from "@/lib/types";

export const dynamic = "force-dynamic";

// "My schedule" — the staff-facing, mobile-first view (When I Work
// replacement). View shifts, see the team, request time off, set status.
export default async function MePage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  const appUser = session!.appUser!;
  const supabase = await createClient();

  if (!appUser.staff_id) {
    return (
      <>
        <PageHeader title="My Schedule" />
        <div className="flex-1 p-8">
          <EmptyState message="Your sign-in isn't linked to a staff record yet. Ask your admin to set your login email on your staff profile (Staff page), then sign in again." />
        </div>
      </>
    );
  }

  const today = todayStr();
  const horizon = addDaysStr(today, 14);

  const [
    { data: me },
    { data: myShifts },
    { data: myRequests },
    { data: myLive },
    { data: workTypes },
    { data: statusCfg },
  ] = await Promise.all([
      supabase.from("staff").select("*").eq("id", appUser.staff_id).single(),
      supabase
        .from("shift")
        .select("*, shift_segment(*)")
        .eq("staff_id", appUser.staff_id)
        .eq("status", "published")
        .gte("date", today)
        .lte("date", horizon)
        .order("date"),
      supabase
        .from("time_off_request")
        .select("*")
        .eq("staff_id", appUser.staff_id)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("live_status")
        .select("*")
        .eq("staff_id", appUser.staff_id)
        .is("effective_to", null)
        .maybeSingle(),
      supabase.from("work_type").select("id, color"),
      supabase.from("live_status_config").select("*"),
    ]);

  const resolvedStatuses = resolveStatuses(
    (statusCfg ?? []) as LiveStatusConfig[]
  );
  const statusOptions = resolvedStatuses
    .filter((s) => s.enabled)
    .map((s) => ({ value: s.value, label: s.label, counts: s.counts }));
  // If a manager disabled the status this person currently holds, still show it
  // so they can see it and switch — otherwise the picker would look blank.
  const heldStatus = (myLive as LiveStatus | null)?.status ?? "present_counting";
  if (!statusOptions.some((o) => o.value === heldStatus)) {
    const held = resolvedStatuses.find((s) => s.value === heldStatus);
    if (held)
      statusOptions.unshift({
        value: held.value,
        label: held.label,
        counts: held.counts,
      });
  }

  const wtColorById = new Map(
    ((workTypes ?? []) as { id: string; color: string | null }[]).map((w) => [
      w.id,
      w.color,
    ])
  );

  const staff = me as Staff;
  const myAvatarUrl = (await signedAvatarUrls(supabase, [staff]))[staff.id];
  const shifts = (myShifts ?? []) as (Shift & { shift_segment: ShiftSegment[] })[];
  const requests = (myRequests ?? []) as TimeOffRequest[];
  const live = myLive as LiveStatus | null;

  // Presence is schedule-derived: you're "on shift" only if a PUBLISHED shift
  // covers right now (tenant tz). Off shift → show "Off shift", don't default to
  // Working. A status only counts as current if it was set today (tenant tz).
  const { date: tzToday, minutes: tzNow } = nowInTimeZone(tenant.timezone);
  const coversNow = (s: Shift & { shift_segment: ShiftSegment[] }) =>
    s.date === tzToday &&
    (s.shift_segment ?? []).some((seg) => {
      const start = timeToMinutes(seg.start_time);
      const end0 = timeToMinutes(seg.end_time);
      const end = end0 > start ? end0 : 1440;
      return start <= tzNow && tzNow < end;
    });
  const currentShift = shifts.find(coversNow);
  const onShiftNow = !!currentShift;
  const effectiveStatus =
    live && dateInTimeZone(live.effective_from, tenant.timezone) === tzToday
      ? live.status
      : "present_counting";

  // "Can I step away without breaking ratio?" — only meaningful for a
  // pharmacist on shift (techs leaving never break ratio). Reuse the live board
  // view for this location; headroom >= 1 means at least one counting pharmacist
  // (including them) can switch to non-counting and stay compliant.
  let ratioImpact: { locationName: string; safeToLeave: boolean } | undefined;
  if (
    tenant.has_ratio &&
    onShiftNow &&
    staff.ratio_type === "pharmacist" &&
    currentShift?.location_id
  ) {
    const view = await buildBoardView(supabase, tenant);
    const card = view.locationCards.find(
      (c) => c.locationId === currentShift.location_id
    );
    if (card) {
      ratioImpact = {
        locationName: card.locationName,
        safeToLeave: card.headroom >= 1,
      };
    }
  }

  // Team schedule for my home location, this week
  const weekEnd = addDaysStr(today, 6);
  const { data: teamShifts } = staff.home_location_id
    ? await supabase
        .from("shift")
        .select("*, shift_segment(*), staff(full_name)")
        .eq("location_id", staff.home_location_id)
        .eq("status", "published")
        .gte("date", today)
        .lte("date", weekEnd)
        .order("date")
    : { data: [] };

  return (
    <>
      <PageHeader title="My Schedule" />
      {/* Keep "My Status Now" live: re-fetch periodically so a shift change a
          manager just made (e.g. extending a shift) flips on-shift here too. */}
      <AutoRefresh />
      <div className="flex-1 space-y-5 p-4 sm:p-8">
        <div className="max-w-[640px] space-y-5">
          <Card>
            <h2 className="mb-3 font-brand text-base font-bold text-navy">
              Your photo
            </h2>
            <AvatarUpload
              staffId={staff.id}
              fullName={staff.full_name}
              currentUrl={myAvatarUrl}
            />
          </Card>

          {tenant.has_ratio &&
            (onShiftNow ? (
              <MyStatusPicker
                current={effectiveStatus}
                options={statusOptions}
                ratioImpact={ratioImpact}
              />
            ) : (
              <Card>
                <h2 className="mb-1 font-brand text-base font-bold text-navy">
                  My status now
                </h2>
                <p className="font-body text-sm text-steel">
                  You&rsquo;re{" "}
                  <span className="font-bold text-navy">off shift</span> right
                  now. Your status sets the live ratio board automatically once
                  your scheduled shift begins.
                </p>
              </Card>
            ))}

          <Card>
            <h2 className="mb-3 font-brand text-base font-bold text-navy">
              My next two weeks
            </h2>
            {shifts.length === 0 && (
              <p className="mb-3 font-body text-sm text-steel">
                No published shifts in the next 14 days.
              </p>
            )}

            {/* Mobile: a simple agenda list (days off are just omitted) */}
            {shifts.length > 0 && (
              <ul className="space-y-2 sm:hidden">
                {shifts.map((s) => {
                  const day = fmtDay(s.date);
                  const segs = s.shift_segment ?? [];
                  const seg0 = segs[0];
                  const wtColor = seg0?.work_type_id
                    ? (wtColorById.get(seg0.work_type_id) ?? null)
                    : null;
                  const bar = wtColor ?? NEUTRAL_SHIFT_BG;
                  const isToday = s.date === today;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-stretch gap-3 rounded-lg border p-3 ${
                        isToday ? "border-amber ring-1 ring-amber" : "border-line"
                      }`}
                    >
                      <span
                        className="w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: bar }}
                      />
                      <div className="w-[54px] shrink-0">
                        <p className="font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel">
                          {day.dow}
                        </p>
                        <p className="font-brand text-[15px] font-bold text-navy">
                          {day.label}
                        </p>
                      </div>
                      <div className="flex-1 space-y-0.5">
                        {segs.map((seg) => (
                          <p
                            key={seg.id}
                            className="font-body text-sm font-medium text-navy"
                          >
                            {compactTime(seg.start_time)}–
                            {compactTime(seg.end_time)}
                          </p>
                        ))}
                        {isToday && (
                          <span className="font-brand text-[10px] font-bold uppercase tracking-[0.5px] text-amber">
                            Today
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Desktop: month-style calendar grid */}
            <div className="hidden sm:block">
            {(() => {
              // Calendar weeks (Mon–Sun) covering today → today+14
              const todayDow = new Date(`${today}T00:00:00Z`).getUTCDay();
              const gridStart = addDaysStr(today, todayDow === 0 ? -6 : 1 - todayDow);
              const weeks: string[][] = [];
              for (let d = gridStart; d <= horizon; d = addDaysStr(d, 7)) {
                weeks.push(eachDate(d, addDaysStr(d, 6)));
              }
              const byDate = new Map<string, typeof shifts>();
              for (const s of shifts) {
                const list = byDate.get(s.date) ?? [];
                list.push(s);
                byDate.set(s.date, list);
              }
              return (
                <div className="grid grid-cols-7 gap-1">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((h) => (
                    <div
                      key={h}
                      className="pb-1 text-center font-brand text-[9px] font-bold uppercase tracking-[0.5px] text-steel"
                    >
                      {h}
                    </div>
                  ))}
                  {weeks.flat().map((date) => {
                    const inRange = date >= today && date <= horizon;
                    const dayShifts = byDate.get(date) ?? [];
                    const isToday = date === today;
                    const dayNum = Number(date.slice(8, 10));
                    return (
                      <div
                        key={date}
                        className={`min-h-[58px] rounded-md border p-1 text-center ${
                          isToday
                            ? "border-amber ring-1 ring-amber"
                            : "border-line"
                        } ${inRange ? "bg-white" : "bg-cloud/50"}`}
                      >
                        <p
                          className={`font-brand text-[11px] font-semibold ${
                            inRange ? "text-navy" : "text-steel/60"
                          }`}
                        >
                          {dayNum}
                        </p>
                        {dayShifts.map((s) => {
                          const seg0 = (s.shift_segment ?? [])[0];
                          const wtColor = seg0?.work_type_id
                            ? (wtColorById.get(seg0.work_type_id) ?? null)
                            : null;
                          const bg = wtColor ?? NEUTRAL_SHIFT_BG;
                          return (
                            <p
                              key={s.id}
                              className="mt-0.5 rounded px-0.5 font-body text-[10px] font-medium leading-4"
                              style={{
                                backgroundColor: bg,
                                color: readableTextColor(bg),
                              }}
                            >
                              {seg0 &&
                                `${compactTime(seg0.start_time)}–${compactTime(seg0.end_time)}`}
                              {(s.shift_segment ?? []).length > 1 && " +"}
                            </p>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <p className="mt-2 font-body text-[11px] text-steel">
              Blank days are days off. Today is outlined.
            </p>
            </div>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-brand text-base font-bold text-navy">
                My requests
              </h2>
              <Link
                href="/app/requests"
                className="font-body text-xs font-medium text-navy underline-offset-2 hover:underline"
              >
                New request →
              </Link>
            </div>
            {requests.length === 0 ? (
              <p className="font-body text-sm text-steel">
                No requests yet. Time off and callouts live under Requests.
              </p>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-line p-3"
                  >
                    <span className="font-body text-[13px] text-navy">
                      {r.start_date}
                      {r.end_date !== r.start_date && ` → ${r.end_date}`} ·{" "}
                      {r.type}
                    </span>
                    <Badge
                      tone={
                        r.status === "approved"
                          ? "compliant"
                          : r.status === "denied"
                            ? "deficiency"
                            : "alert"
                      }
                    >
                      {r.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(teamShifts ?? []).length > 0 && (
            <Card>
              <h2 className="mb-3 font-brand text-base font-bold text-navy">
                Team this week
              </h2>
              <div className="space-y-1.5">
                {(teamShifts ?? []).map((s) => {
                  const day = fmtDay(s.date);
                  return (
                    <p key={s.id} className="font-body text-[13px] text-navy">
                      <span className="font-brand text-[11px] font-semibold text-steel">
                        {day.dow} {day.label}
                      </span>{" "}
                      <span className="font-medium">
                        {(s.staff as { full_name?: string })?.full_name}
                      </span>{" "}
                      <span className="text-steel">
                        {(s.shift_segment ?? [])
                          .map(
                            (seg: ShiftSegment) =>
                              `${String(seg.start_time).slice(0, 5)}–${String(seg.end_time).slice(0, 5)}`
                          )
                          .join(", ")}
                      </span>
                    </p>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

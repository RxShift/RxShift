// The colored shift block — the schedule's core visual unit.
//
// Two independent channels, never competing:
//   FILL        = the segment's work type (what the person is doing)
//   COMPLIANCE  = a deficient slot gets a high-contrast red ⚠ corner badge
//                 (white/surface outline so it reads on ANY fill color, light
//                 or dark) plus a red ring; a constraint flag gets an amber
//                 ring. The badge is fill-independent so a reddish work-type
//                 color can never hide the deficiency cue.
//
// Shared by the schedule builder grid and the all-locations overview.

import { NEUTRAL_SHIFT_BG, readableTextColor } from "@/lib/work-type-colors";
import type { ShiftSegment, WorkType } from "@/lib/types";

function fmtT(t: string): string {
  return String(t).slice(0, 5);
}

export default function ShiftBlock({
  segments,
  workTypeById,
  deficient = false,
  constrained = false,
  showWorkTypeName = true,
}: {
  segments: ShiftSegment[];
  workTypeById: Map<string, WorkType>;
  deficient?: boolean;
  constrained?: boolean;
  showWorkTypeName?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`overflow-hidden rounded-[5px] ${
          deficient
            ? "ring-2 ring-deficiency"
            : constrained
              ? "ring-2 ring-alert"
              : ""
        }`}
      >
        {segments.map((seg) => {
          const wt = seg.work_type_id
            ? workTypeById.get(seg.work_type_id)
            : undefined;
          const bg = wt?.color ?? NEUTRAL_SHIFT_BG;
          const fg = readableTextColor(bg);
          return (
            <div
              key={seg.id}
              className="px-1.5 py-1 text-left font-body text-[10.5px] font-semibold leading-tight"
              style={{ backgroundColor: bg, color: fg }}
            >
              <div className="whitespace-nowrap">
                {fmtT(seg.start_time)}–{fmtT(seg.end_time)}
              </div>
              {showWorkTypeName && wt && (
                <div className="truncate text-[9px] font-medium uppercase tracking-[0.4px] opacity-80">
                  {wt.name}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fill-independent compliance badge — outlined so it pops on any color */}
      {deficient && (
        <span
          aria-label="deficient ratio slot"
          title="In a deficient ratio slot"
          className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-deficiency text-[10px] font-bold leading-none text-white shadow-sm ring-2 ring-surface"
        >
          ⚠
        </span>
      )}
    </div>
  );
}

/** Compact swatch legend for the work types actually in use. */
export function WorkTypeLegend({
  workTypes,
  usedIds,
}: {
  workTypes: WorkType[];
  usedIds: Set<string>;
}) {
  const used = workTypes.filter((w) => usedIds.has(w.id));
  if (used.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {used.map((w) => (
        <span
          key={w.id}
          className="flex items-center gap-1.5 font-body text-[11px] text-steel"
        >
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ backgroundColor: w.color ?? NEUTRAL_SHIFT_BG }}
          />
          {w.name}
        </span>
      ))}
      {usedIds.has("__none__") && (
        <span className="flex items-center gap-1.5 font-body text-[11px] text-steel">
          <span
            className="inline-block h-3 w-3 rounded-[3px]"
            style={{ backgroundColor: NEUTRAL_SHIFT_BG }}
          />
          No work type
        </span>
      )}
    </div>
  );
}

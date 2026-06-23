"use server";

// Tier A + B AI (scoping §5): the help assistant answers from the help
// corpus; flag explanations name the exact fix; natural-language commands
// follow propose → deterministic validate → human confirm. AI never
// commits a compliance-affecting change on its own.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured, aiJson, aiText } from "@/lib/ai";
import { evaluateZone } from "@/lib/engine/ratio";
import { evaluateConstraints } from "@/lib/engine/constraints";
import {
  loadAllLocationsBundle,
  loadPeriodBundle,
  engineRuleForLocation,
  toEngineSegments,
  validateBundle,
  type PeriodBundle,
} from "@/lib/schedule-data";
import { eachDate, fmtDay, mondayOf, monthStart, periodEnd } from "@/lib/dates";
import { timeToMinutes } from "@/lib/engine/ratio";
import { ensurePeriodForDate } from "./schedule";
import type { ConstraintRule, Tenant } from "@/lib/types";
import {
  ActionError,
  logActivity,
  requireManager,
  requireMember,
  runAction,
  type ActionResult,
} from "./helpers";

// ─── Help assistant ──────────────────────────────────────────────────────────

export async function askHelpAssistant(
  question: string
): Promise<ActionResult<{ answer: string }>> {
  return runAction(async () => {
    await requireMember();
    if (!aiConfigured())
      throw new ActionError("The AI assistant isn't configured yet.");
    if (!question.trim()) throw new ActionError("Ask a question first.");

    const supabase = await createClient();
    const { data: articles } = await supabase
      .from("help_article")
      .select("title, body_markdown")
      .eq("published", true);

    const corpus = (articles ?? [])
      .map((a) => `## ${a.title}\n${a.body_markdown}`)
      .join("\n\n---\n\n");

    const answer = await aiText(
      "You are the RxShift help assistant. Answer ONLY from the help articles below. " +
        "Be concise and concrete — name the page and steps. If the articles don't cover it, " +
        "say so and suggest emailing info@rxshift.io. Never invent features. Never give " +
        "regulatory or legal advice; for state rules, point to Settings → Ratio and the " +
        "pharmacy's board of pharmacy.\n\n" +
        corpus,
      question.trim(),
      500
    );

    return { answer };
  });
}

// ─── Flag explanation ────────────────────────────────────────────────────────

export async function explainFlag(
  flagMessage: string,
  context: string
): Promise<ActionResult<{ explanation: string }>> {
  return runAction(async () => {
    await requireMember();
    if (!aiConfigured())
      throw new ActionError("The AI assistant isn't configured yet.");

    const explanation = await aiText(
      "You explain pharmacy scheduling compliance flags in plain language for a busy " +
        "pharmacy manager. In 2-4 sentences: what the flag means, why it matters, and the " +
        "exact fix (who to add/move and when). The flag text comes from a deterministic " +
        "rules engine and is correct — explain it, don't second-guess it.",
      `Flag: ${flagMessage}\nSchedule context: ${context}`,
      300
    );

    return { explanation };
  });
}

// ─── Natural-language schedule commands ─────────────────────────────────────

const operationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("reassign_shift"),
    shift_id: z.string().uuid(),
    to_staff_id: z.string().uuid(),
    // The target person's name as shown in STAFF — WE resolve it to the id, so a
    // mis-cross-referenced UUID can't reassign to the wrong person (bug fix).
    to_staff_name: z.string().optional(),
  }),
  z.object({
    op: z.literal("delete_shift"),
    shift_id: z.string().uuid(),
  }),
  z
    .object({
      op: z.literal("edit_shift"),
      shift_id: z.string().uuid(),
      new_start_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
      new_end_time: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
    })
    .refine((o) => o.new_start_time || o.new_end_time, {
      message: "edit_shift needs a new start and/or end time",
    }),
  z.object({
    op: z.literal("create_shifts"),
    staff_id: z.string().uuid(),
    staff_name: z.string().optional(),
    days_of_week: z
      .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
      .min(1),
    start_time: z.string().regex(/^\d{2}:\d{2}$/),
    end_time: z.string().regex(/^\d{2}:\d{2}$/),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  }),
  z.object({
    op: z.literal("add_constraint"),
    staff_id: z.string().uuid(),
    staff_name: z.string().optional(),
    rule_type: z.enum([
      "unavailable_window",
      "recurring_unavailable",
      "always_off",
      "hour_cap",
    ]),
    params: z.record(z.string(), z.unknown()),
    effective_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    effective_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  }),
]);

export type AiOperation = z.infer<typeof operationSchema>;

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};

/**
 * Expand a create_shifts operation into concrete dates — clamped to the
 * period, skipping days where the person already has a shift and days
 * covered by approved time off. Used by BOTH the simulation and the
 * executor so the preview always matches what gets applied.
 */
function expandCreateDates(
  op: Extract<AiOperation, { op: "create_shifts" }>,
  bundle: NonNullable<Awaited<ReturnType<typeof loadPeriodBundle>>>
): string[] {
  const from =
    op.date_from && op.date_from > bundle.period.start_date
      ? op.date_from
      : bundle.period.start_date;
  const to =
    op.date_to && op.date_to < bundle.period.end_date
      ? op.date_to
      : bundle.period.end_date;
  if (from > to) return [];

  const wanted = new Set(op.days_of_week.map((d) => DAY_INDEX[d]));
  const existing = new Set(
    bundle.shifts.filter((s) => s.staff_id === op.staff_id).map((s) => s.date)
  );
  const pto = bundle.approvedTimeOff.filter((t) => t.staff_id === op.staff_id);

  return eachDate(from, to).filter((date) => {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (!wanted.has(dow)) return false;
    if (existing.has(date)) return false;
    if (pto.some((t) => t.start_date <= date && date <= t.end_date)) return false;
    return true;
  });
}

// ─── Deterministic staff name resolution (wrong-person bug fix) ──────────────
// Small models reliably READ a name but mis-cross-reference UUIDs. So the model
// echoes the target person's name and WE resolve it to an id here — exact match
// wins, then unambiguous containment, then typo-tolerant edit distance. If it's
// ambiguous or nothing's close, we ask instead of guessing.

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bdr\.?\b/g, "") // drop the "Dr." honorific
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[n];
}

type StaffLite = { id: string; full_name: string };

function resolveStaffName(
  query: string,
  staff: StaffLite[]
): { id: string } | { ambiguous: string[] } | null {
  const q = normalizeName(query);
  if (!q) return null;
  const norm = staff.map((s) => ({ s, n: normalizeName(s.full_name) }));

  // 1) Exact normalized match.
  const exact = norm.filter((x) => x.n === q);
  if (exact.length === 1) return { id: exact[0].s.id };
  if (exact.length > 1) return { ambiguous: exact.map((x) => x.s.full_name) };

  // 2) Containment — handles "Ashley" → "Ashley Din", or a last-name reference.
  const contains = norm.filter((x) => x.n.includes(q) || q.includes(x.n));
  if (contains.length === 1) return { id: contains[0].s.id };
  if (contains.length > 1)
    return { ambiguous: contains.map((x) => x.s.full_name) };

  // 3) Typo tolerance — closest by edit distance, but only if clearly the best.
  const scored = norm
    .map((x) => ({ s: x.s, d: levenshtein(q, x.n) }))
    .sort((a, b) => a.d - b.d);
  const best = scored[0];
  const threshold = Math.max(2, Math.floor(q.length * 0.34));
  if (best && best.d <= threshold) {
    const next = scored[1];
    if (!next || next.d - best.d >= 1) return { id: best.s.id };
    return {
      ambiguous: scored.filter((x) => x.d === best.d).map((x) => x.s.full_name),
    };
  }
  return null;
}

export interface AiCommandResult {
  mode: "answer" | "proposal";
  answer?: string;
  description?: string;
  operations?: AiOperation[];
  validation?: string;
  /** Deterministic before/after lines, computed from the data (not the LLM). */
  changes?: string[];
  /** True if the change introduces a NET-NEW ratio deficiency (needs ack). */
  addsDeficiency?: boolean;
  deficiencyDelta?: number;
}

/**
 * The bundle the AI works against: the real period if we have one, otherwise a
 * synthesized window bundle for the location's cycle-aligned period containing
 * refDate — so Ask AI works on an empty week that has NO period yet. No DB write
 * here; the real period is materialized only when operations are applied.
 */
async function resolveAiBundle(
  periodId: string | null,
  locationId: string,
  refDate: string,
  tenant: Tenant
): Promise<PeriodBundle | null> {
  if (periodId) {
    const real = await loadPeriodBundle(periodId);
    if (real) return real;
  }
  if (!locationId) return null;
  const start =
    tenant.schedule_cycle === "monthly" ? monthStart(refDate) : mondayOf(refDate);
  const end = periodEnd(start, tenant.schedule_cycle);
  const range = await loadAllLocationsBundle(start, end);
  return {
    period: {
      id: "",
      tenant_id: tenant.id,
      location_id: locationId,
      cycle: tenant.schedule_cycle,
      start_date: start,
      end_date: end,
      status: "draft",
      published_at: null,
      published_by: null,
      created_at: "",
    },
    shifts: range.shifts.filter((s) => s.location_id === locationId),
    staff: range.staff,
    workTypes: range.workTypes,
    locations: range.locations,
    ratioRule: range.ratioRule,
    constraints: range.constraints,
    approvedTimeOff: range.approvedTimeOff,
    ptoDays: range.ptoDays,
  };
}

export async function aiScheduleCommand(
  periodId: string | null,
  command: string,
  locationId: string,
  refDate: string
): Promise<ActionResult<AiCommandResult>> {
  return runAction(async () => {
    const ctx = await requireManager();
    if (!aiConfigured())
      throw new ActionError("The AI assistant isn't configured yet.");

    const bundle = await resolveAiBundle(periodId, locationId, refDate, ctx.tenant);
    if (!bundle)
      throw new ActionError("Couldn't load the schedule for that week.");
    const validation = validateBundle(bundle, ctx.tenant);

    const staffList = bundle.staff
      .filter((s) => s.active)
      .map((s) => `${s.id} | ${s.full_name} | ${s.ratio_type}`)
      .join("\n");
    // Include the staff NAME and weekday on each shift row so the model can map
    // "Dr. Patel's Thursday shift" straight to a row (cross-referencing staff
    // UUIDs across two lists is exactly what small models get wrong).
    const staffNameById = new Map(bundle.staff.map((s) => [s.id, s.full_name]));
    const shiftList = bundle.shifts
      .map(
        (s) =>
          `${s.id} | ${s.date} (${fmtDay(s.date).dow}) | ${staffNameById.get(s.staff_id) ?? s.staff_id} | ${s.segments
            .map((g) => `${String(g.start_time).slice(0, 5)}-${String(g.end_time).slice(0, 5)}`)
            .join(",")}`
      )
      .join("\n");
    const flagSummary = [
      ...validation.ratioFlags.map(
        (f) => `ratio: ${f.date} ${f.slot_label} ${f.location_name}: ${f.reason}`
      ),
      ...validation.constraintFlags.map((f) => `constraint: ${f.message}`),
    ].join("\n");

    const result = await aiJson<{
      mode: "answer" | "proposal";
      answer?: string;
      description?: string;
      operations?: unknown[];
    }>(
      "You are RxShift's scheduling assistant. The user manages a pharmacy schedule. " +
        "Answer questions from the data, or propose edits as operations. Respond with JSON:\n" +
        '{"mode":"answer","answer":"..."} for questions, or\n' +
        '{"mode":"proposal","description":"plain-English summary of what will change","operations":[...]}.\n' +
        "Allowed operations:\n" +
        '- {"op":"reassign_shift","shift_id":"<uuid>","to_staff_id":"<uuid>","to_staff_name":"<name from STAFF>"}\n' +
        '- {"op":"delete_shift","shift_id":"<uuid>"}\n' +
        '- {"op":"edit_shift","shift_id":"<uuid>","new_start_time":"HH:MM or null","new_end_time":"HH:MM or null"}\n' +
        '- {"op":"create_shifts","staff_id":"<uuid>","staff_name":"<name from STAFF>","days_of_week":["mon","tue"],"start_time":"08:00","end_time":"17:00","date_from":"yyyy-mm-dd or null","date_to":"yyyy-mm-dd or null"}\n' +
        '- {"op":"add_constraint","staff_id":"<uuid>","staff_name":"<name from STAFF>","rule_type":"always_off|recurring_unavailable|unavailable_window|hour_cap","params":{...},"effective_start":"yyyy-mm-dd","effective_end":"yyyy-mm-dd or null"}\n' +
        "For ANY operation that targets a person, ALWAYS include the name field " +
        "(staff_name / to_staff_name) copied EXACTLY as it appears in the STAFF " +
        "list. The system resolves the person from that name (not the id), so " +
        "copying the exact name is what prevents scheduling the wrong person. " +
        "If the requested person is NOT in STAFF, do not guess — use mode answer " +
        "to ask who they mean.\n" +
        'Constraint params: always_off {"days":["fri"]}; recurring_unavailable {"recurrence":{"days":["mon"],"interval_weeks":2}}; ' +
        'unavailable_window {"days":["mon"],"time_range":{"start":"14:00","end":"18:00"}}; hour_cap {"hours":40,"period":"week"}.\n' +
        "create_shifts builds recurring shifts: e.g. \"Marcus works 8 to 5 Monday through Friday for the next " +
        'three weeks" → {"op":"create_shifts","staff_id":"<marcus uuid>","days_of_week":["mon","tue","wed","thu","fri"],' +
        '"start_time":"08:00","end_time":"17:00","date_from":<start>,"date_to":<start+20 days>}. Dates are clamped ' +
        "to this schedule period; days where the person already works or has approved time off are skipped " +
        "automatically — mention in the description if part of the request falls outside this period.\n" +
        "edit_shift changes ONE existing shift's hours: to extend/shorten/move, find the shift in SHIFTS by " +
        "staff+date, read its CURRENT start-end from the data, and set new_start_time and/or new_end_time " +
        '(omit/null the one that doesn\'t change). E.g. a shift shown "09:00-14:00" + "extend to 4pm" → ' +
        '{"op":"edit_shift","shift_id":"<that uuid>","new_end_time":"16:00"}. Never guess the current times — ' +
        "use exactly what SHIFTS shows. " +
        "Use ONLY ids from the data. To give someone days off for a date range, use add_constraint with " +
        "effective dates, AND reassign or delete their conflicting shifts if asked. " +
        "If the request is ambiguous (e.g. several matching shifts) or impossible, use mode answer to ask what you need.",
      `Schedule period: ${bundle.period.start_date} to ${bundle.period.end_date}\n\nSTAFF (id | name | type):\n${staffList}\n\nSHIFTS (id | date (weekday) | staff name | times):\n${shiftList}\n\nCURRENT FLAGS:\n${flagSummary || "none"}\n\nUSER REQUEST: ${command}`,
      900
    );

    if (!result) throw new ActionError("The assistant couldn't process that. Try rephrasing.");

    if (result.mode === "answer") {
      return { mode: "answer" as const, answer: result.answer ?? "No answer." };
    }

    // Validate proposed operations structurally, then against the engine
    const ops: AiOperation[] = [];
    for (const raw of result.operations ?? []) {
      const parsed = operationSchema.safeParse(raw);
      if (!parsed.success) continue;
      ops.push(parsed.data);
    }
    if (ops.length === 0)
      throw new ActionError(
        "The assistant proposed something invalid. Try rephrasing."
      );

    // Deterministic name resolution (wrong-person bug fix): the model echoed the
    // target person's name; WE resolve it to an id and overwrite the model's
    // guess. On ambiguity or no match, ask rather than schedule the wrong person.
    const staffLite: StaffLite[] = bundle.staff.map((s) => ({
      id: s.id,
      full_name: s.full_name,
    }));
    const validStaffIds = new Set(staffLite.map((s) => s.id));
    const roster = staffLite.map((s) => s.full_name).join(", ");
    for (const op of ops) {
      if (op.op === "create_shifts" || op.op === "add_constraint") {
        const r =
          op.staff_name && op.staff_name.trim()
            ? resolveStaffName(op.staff_name, staffLite)
            : validStaffIds.has(op.staff_id)
              ? { id: op.staff_id }
              : null;
        if (!r)
          return {
            mode: "answer" as const,
            answer: `I couldn't match "${op.staff_name?.trim() ?? "that person"}" to anyone here. Who did you mean? Staff: ${roster}.`,
          };
        if ("ambiguous" in r)
          return {
            mode: "answer" as const,
            answer: `"${op.staff_name?.trim()}" matches more than one person: ${r.ambiguous.join(", ")}. Which one?`,
          };
        op.staff_id = r.id;
      } else if (op.op === "reassign_shift") {
        const r =
          op.to_staff_name && op.to_staff_name.trim()
            ? resolveStaffName(op.to_staff_name, staffLite)
            : validStaffIds.has(op.to_staff_id)
              ? { id: op.to_staff_id }
              : null;
        if (!r)
          return {
            mode: "answer" as const,
            answer: `I couldn't match "${op.to_staff_name?.trim() ?? "that person"}" to anyone here. Who did you mean? Staff: ${roster}.`,
          };
        if ("ambiguous" in r)
          return {
            mode: "answer" as const,
            answer: `"${op.to_staff_name?.trim()}" matches more than one person: ${r.ambiguous.join(", ")}. Which one?`,
          };
        op.to_staff_id = r.id;
      }
    }

    // Deterministic validation: simulate the operations and diff the flags
    const segments = toEngineSegments(bundle);
    const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
    let simulated = [...segments];
    const simulatedRules: ConstraintRule[] = [...bundle.constraints];

    let createdCount = 0;
    for (const op of ops) {
      if (op.op === "delete_shift") {
        simulated = simulated.filter((s) => s.shift_id !== op.shift_id);
      } else if (op.op === "create_shifts") {
        const person = staffById.get(op.staff_id);
        if (!person) throw new ActionError("Proposed shifts target unknown staff.");
        const spanMin =
          timeToMinutes(op.end_time) - timeToMinutes(op.start_time);
        const breakMin =
          spanMin >= 360 ? (ctx.tenant.default_break_minutes ?? 30) : 0;
        for (const date of expandCreateDates(op, bundle)) {
          createdCount += 1;
          simulated.push({
            shift_id: `proposed-${op.staff_id}-${date}`,
            location_id: bundle.period.location_id,
            date,
            start_time: op.start_time,
            end_time: op.end_time,
            break_minutes: breakMin,
            staff: {
              id: person.id,
              full_name: person.full_name,
              ratio_type: person.ratio_type,
            },
            work_type: null,
            counts_override: null,
          });
        }
      } else if (op.op === "reassign_shift") {
        const to = staffById.get(op.to_staff_id);
        if (!to) throw new ActionError("Proposed reassignment targets unknown staff.");
        simulated = simulated.map((s) =>
          s.shift_id === op.shift_id
            ? {
                ...s,
                staff: { id: to.id, full_name: to.full_name, ratio_type: to.ratio_type },
              }
            : s
        );
      } else if (op.op === "edit_shift") {
        // Move the shift's hours: new start lands on its earliest segment, new
        // end on its latest (single-segment shifts: both hit the same segment).
        const segs = simulated.filter((s) => s.shift_id === op.shift_id);
        if (segs.length) {
          const minStart = segs.reduce(
            (a, s) => (s.start_time < a ? s.start_time : a),
            segs[0].start_time
          );
          const maxEnd = segs.reduce(
            (a, s) => (s.end_time > a ? s.end_time : a),
            segs[0].end_time
          );
          let startDone = false;
          let endDone = false;
          simulated = simulated.map((s) => {
            if (s.shift_id !== op.shift_id) return s;
            let start_time = s.start_time;
            let end_time = s.end_time;
            if (op.new_start_time && !startDone && s.start_time === minStart) {
              start_time = op.new_start_time;
              startDone = true;
            }
            if (op.new_end_time && !endDone && s.end_time === maxEnd) {
              end_time = op.new_end_time;
              endDone = true;
            }
            return { ...s, start_time, end_time };
          });
        }
      } else if (op.op === "add_constraint") {
        simulatedRules.push({
          id: `proposed-${simulatedRules.length}`,
          tenant_id: ctx.tenantId,
          scope_type: "staff",
          scope_id: op.staff_id,
          rule_type: op.rule_type,
          params: op.params,
          effective_start: op.effective_start,
          effective_end: op.effective_end,
          active: true,
          created_at: "",
        });
      }
    }

    const countDeficient = (segs: typeof segments) => {
      if (!ctx.tenant.has_ratio || !bundle.ratioRule) return 0;
      let n = 0;
      // Ratio is per location — group the segments by location and evaluate each.
      const byLoc = new Map<string, typeof segments>();
      for (const s of segs) {
        const list = byLoc.get(s.location_id) ?? [];
        list.push(s);
        byLoc.set(s.location_id, list);
      }
      for (const [locId, locSegs] of byLoc) {
        const location = bundle.locations.find((l) => l.id === locId);
        const evals = evaluateZone(
          locSegs,
          engineRuleForLocation(bundle.ratioRule, location, ctx.tenant),
          ctx.tenant.ratio_slot_minutes
        );
        for (const [, slots] of evals)
          n += slots.filter((s) => s.status === "deficient").length;
      }
      return n;
    };

    const deficientBefore = countDeficient(segments);
    const deficientAfter = countDeficient(simulated);
    const constraintFlagsAfter = evaluateConstraints(simulatedRules, simulated).length;
    const constraintFlagsBefore = validation.constraintFlags.length;

    // Deterministic before/after lines — read straight from the data, never from
    // the LLM's prose, so the times the manager confirms are always correct.
    const shiftById = new Map(bundle.shifts.map((s) => [s.id, s]));
    const dayLabel = (d: string) => {
      const f = fmtDay(d);
      return `${f.dow} ${f.label}`;
    };
    const span = (sh: (typeof bundle.shifts)[number]): [string, string] => {
      const segs = sh.segments ?? [];
      if (!segs.length) return ["—", "—"];
      const starts = segs.map((g) => String(g.start_time).slice(0, 5));
      const ends = segs.map((g) => String(g.end_time).slice(0, 5));
      return [
        starts.reduce((a, b) => (b < a ? b : a)),
        ends.reduce((a, b) => (b > a ? b : a)),
      ];
    };
    const changes: string[] = [];
    for (const op of ops) {
      if (op.op === "create_shifts") {
        const person = staffById.get(op.staff_id);
        const n = expandCreateDates(op, bundle).length;
        changes.push(
          `Create ${n} shift${n === 1 ? "" : "s"}: ${person?.full_name ?? "?"} ${op.days_of_week.join("/")} ${op.start_time}–${op.end_time}`
        );
      } else if (op.op === "edit_shift") {
        const sh = shiftById.get(op.shift_id);
        if (sh) {
          const [os, oe] = span(sh);
          changes.push(
            `${staffById.get(sh.staff_id)?.full_name ?? "?"} · ${dayLabel(sh.date)}: ${os}–${oe} → ${op.new_start_time ?? os}–${op.new_end_time ?? oe}`
          );
        }
      } else if (op.op === "reassign_shift") {
        const sh = shiftById.get(op.shift_id);
        if (sh) {
          const [os, oe] = span(sh);
          changes.push(
            `${dayLabel(sh.date)} ${os}–${oe}: ${staffById.get(sh.staff_id)?.full_name ?? "?"} → ${staffById.get(op.to_staff_id)?.full_name ?? "?"}`
          );
        }
      } else if (op.op === "delete_shift") {
        const sh = shiftById.get(op.shift_id);
        if (sh) {
          const [os, oe] = span(sh);
          changes.push(
            `Remove: ${staffById.get(sh.staff_id)?.full_name ?? "?"} ${dayLabel(sh.date)} ${os}–${oe}`
          );
        }
      } else if (op.op === "add_constraint") {
        changes.push(
          `Add ${op.rule_type.replace(/_/g, " ")} for ${staffById.get(op.staff_id)?.full_name ?? "?"}`
        );
      }
    }

    const validationSummary = [
      createdCount > 0 ? `✓ Creates ${createdCount} shift(s).` : "",
      deficientAfter > deficientBefore
        ? `⚠ Adds ${deficientAfter - deficientBefore} deficient ratio slot(s).`
        : deficientAfter < deficientBefore
          ? `✓ Removes ${deficientBefore - deficientAfter} deficient ratio slot(s).`
          : "✓ No change to ratio compliance.",
      constraintFlagsAfter > constraintFlagsBefore
        ? `⚠ Raises ${constraintFlagsAfter - constraintFlagsBefore} new constraint flag(s).`
        : "✓ No new constraint flags.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      mode: "proposal" as const,
      description: result.description ?? "Proposed change",
      operations: ops,
      validation: validationSummary,
      changes,
      addsDeficiency: deficientAfter > deficientBefore,
      deficiencyDelta: Math.max(0, deficientAfter - deficientBefore),
    };
  });
}

export async function applyAiOperations(
  periodId: string | null,
  operations: unknown[],
  locationId: string,
  refDate: string
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();

    const ops = operations.map((o) => operationSchema.parse(o));

    // On an empty week there's no period yet — materialize the real one now
    // (only at apply time, so questions/discarded proposals never create one).
    let realPeriodId = periodId;
    if (!realPeriodId) {
      if (!locationId) throw new ActionError("No location selected.");
      realPeriodId = await ensurePeriodForDate(
        supabase,
        ctx.tenantId,
        ctx.tenant.schedule_cycle,
        locationId,
        refDate
      );
    }

    // create_shifts needs the period context to expand dates exactly the
    // way the simulation previewed them
    const needsBundle = ops.some((o) => o.op === "create_shifts");
    const bundle = needsBundle ? await loadPeriodBundle(realPeriodId) : null;
    if (needsBundle && !bundle) throw new ActionError("Period not found.");

    for (const op of ops) {
      if (op.op === "create_shifts" && bundle) {
        const spanMin =
          timeToMinutes(op.end_time) - timeToMinutes(op.start_time);
        const breakMin =
          spanMin >= 360 ? (ctx.tenant.default_break_minutes ?? 30) : 0;
        for (const date of expandCreateDates(op, bundle)) {
          const { data: row, error } = await supabase
            .from("shift")
            .insert({
              tenant_id: ctx.tenantId,
              location_id: bundle.period.location_id,
              staff_id: op.staff_id,
              date,
              schedule_period_id: realPeriodId,
              status: bundle.period.status,
              break_minutes: breakMin,
              created_by: ctx.userId,
            })
            .select("id")
            .single();
          if (error) throw new ActionError(error.message);
          const { error: segErr } = await supabase.from("shift_segment").insert({
            shift_id: row.id,
            tenant_id: ctx.tenantId,
            start_time: op.start_time,
            end_time: op.end_time,
            work_type_id: null,
            counts_toward_ratio: null,
          });
          if (segErr) throw new ActionError(segErr.message);
        }
      } else if (op.op === "delete_shift") {
        const { error } = await supabase
          .from("shift")
          .delete()
          .eq("id", op.shift_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) throw new ActionError(error.message);
      } else if (op.op === "reassign_shift") {
        const { error } = await supabase
          .from("shift")
          .update({ staff_id: op.to_staff_id })
          .eq("id", op.shift_id)
          .eq("tenant_id", ctx.tenantId);
        if (error) throw new ActionError(error.message);
      } else if (op.op === "edit_shift") {
        // Update the shift's hours: new start on the earliest segment, new end
        // on the latest (single-segment shifts hit the same row for both).
        const { data: segs, error: segReadErr } = await supabase
          .from("shift_segment")
          .select("id, start_time, end_time")
          .eq("shift_id", op.shift_id)
          .eq("tenant_id", ctx.tenantId)
          .order("start_time");
        if (segReadErr) throw new ActionError(segReadErr.message);
        if (segs && segs.length) {
          if (op.new_start_time) {
            const { error } = await supabase
              .from("shift_segment")
              .update({ start_time: op.new_start_time })
              .eq("id", segs[0].id);
            if (error) throw new ActionError(error.message);
          }
          if (op.new_end_time) {
            const { error } = await supabase
              .from("shift_segment")
              .update({ end_time: op.new_end_time })
              .eq("id", segs[segs.length - 1].id);
            if (error) throw new ActionError(error.message);
          }
        }
      } else if (op.op === "add_constraint") {
        const { error } = await supabase.from("constraint_rule").insert({
          tenant_id: ctx.tenantId,
          scope_type: "staff",
          scope_id: op.staff_id,
          rule_type: op.rule_type,
          params: op.params,
          effective_start: op.effective_start,
          effective_end: op.effective_end,
          active: true,
        });
        if (error) throw new ActionError(error.message);
      }
    }

    await logActivity(ctx, "ai_apply", "schedule_period", realPeriodId, {
      operations: ops.length,
    });
    revalidatePath("/app/schedule");
    return undefined;
  });
}

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
  loadPeriodBundle,
  toEngineSegments,
  validateBundle,
} from "@/lib/schedule-data";
import type { ConstraintRule } from "@/lib/types";
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
  }),
  z.object({
    op: z.literal("delete_shift"),
    shift_id: z.string().uuid(),
  }),
  z.object({
    op: z.literal("add_constraint"),
    staff_id: z.string().uuid(),
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

export interface AiCommandResult {
  mode: "answer" | "proposal";
  answer?: string;
  description?: string;
  operations?: AiOperation[];
  validation?: string;
}

export async function aiScheduleCommand(
  periodId: string,
  command: string
): Promise<ActionResult<AiCommandResult>> {
  return runAction(async () => {
    const ctx = await requireManager();
    if (!aiConfigured())
      throw new ActionError("The AI assistant isn't configured yet.");

    const bundle = await loadPeriodBundle(periodId);
    if (!bundle) throw new ActionError("Period not found.");
    const validation = validateBundle(bundle, ctx.tenant);

    const staffList = bundle.staff
      .filter((s) => s.active)
      .map((s) => `${s.id} | ${s.full_name} | ${s.ratio_type}`)
      .join("\n");
    const shiftList = bundle.shifts
      .map(
        (s) =>
          `${s.id} | ${s.date} | staff=${s.staff_id} | ${s.segments
            .map((g) => `${String(g.start_time).slice(0, 5)}-${String(g.end_time).slice(0, 5)}`)
            .join(",")}`
      )
      .join("\n");
    const flagSummary = [
      ...validation.ratioFlags.map(
        (f) => `ratio: ${f.date} ${f.slot_label} ${f.zone_name}: ${f.reason}`
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
        '- {"op":"reassign_shift","shift_id":"<uuid>","to_staff_id":"<uuid>"}\n' +
        '- {"op":"delete_shift","shift_id":"<uuid>"}\n' +
        '- {"op":"add_constraint","staff_id":"<uuid>","rule_type":"always_off|recurring_unavailable|unavailable_window|hour_cap","params":{...},"effective_start":"yyyy-mm-dd","effective_end":"yyyy-mm-dd or null"}\n' +
        'Constraint params: always_off {"days":["fri"]}; recurring_unavailable {"recurrence":{"days":["mon"],"interval_weeks":2}}; ' +
        'unavailable_window {"days":["mon"],"time_range":{"start":"14:00","end":"18:00"}}; hour_cap {"hours":40,"period":"week"}.\n' +
        "Use ONLY ids from the data. To give someone days off for a date range, use add_constraint with " +
        "effective dates, AND reassign or delete their conflicting shifts if asked. Never invent shifts that " +
        "don't exist. If the request is ambiguous or impossible, use mode answer to say what you need.",
      `Schedule period: ${bundle.period.start_date} to ${bundle.period.end_date}\n\nSTAFF (id | name | type):\n${staffList}\n\nSHIFTS (id | date | staff | times):\n${shiftList}\n\nCURRENT FLAGS:\n${flagSummary || "none"}\n\nUSER REQUEST: ${command}`,
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

    // Deterministic validation: simulate the operations and diff the flags
    const segments = toEngineSegments(bundle);
    const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
    let simulated = [...segments];
    const simulatedRules: ConstraintRule[] = [...bundle.constraints];

    for (const op of ops) {
      if (op.op === "delete_shift") {
        simulated = simulated.filter((s) => s.shift_id !== op.shift_id);
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
      for (const zone of bundle.zones) {
        const evals = evaluateZone(
          segs.filter((s) => s.zone_id === zone.id),
          { max_techs_per_pharmacist: bundle.ratioRule.max_techs_per_pharmacist },
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

    const validationSummary = [
      deficientAfter > deficientBefore
        ? `⚠ Adds ${deficientAfter - deficientBefore} deficient ratio slot(s).`
        : deficientAfter < deficientBefore
          ? `✓ Removes ${deficientBefore - deficientAfter} deficient ratio slot(s).`
          : "✓ No change to ratio compliance.",
      constraintFlagsAfter > constraintFlagsBefore
        ? `⚠ Raises ${constraintFlagsAfter - constraintFlagsBefore} new constraint flag(s).`
        : "✓ No new constraint flags.",
    ].join(" ");

    return {
      mode: "proposal" as const,
      description: result.description ?? "Proposed change",
      operations: ops,
      validation: validationSummary,
    };
  });
}

export async function applyAiOperations(
  periodId: string,
  operations: unknown[]
): Promise<ActionResult> {
  return runAction(async () => {
    const ctx = await requireManager();
    const supabase = await createClient();

    const ops = operations.map((o) => operationSchema.parse(o));

    for (const op of ops) {
      if (op.op === "delete_shift") {
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

    await logActivity(ctx, "ai_apply", "schedule_period", periodId, {
      operations: ops.length,
    });
    revalidatePath("/app/schedule");
    return undefined;
  });
}

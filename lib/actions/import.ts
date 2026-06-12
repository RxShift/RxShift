"use server";

// AI column mapping for roster imports: headers + a couple of sample rows
// go to the model, a mapping comes back. Falls back to heuristics when AI
// is unavailable or unsure. Works pre-onboarding (no app_user required).

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { aiConfigured, aiJson } from "@/lib/ai";
import { guessField } from "@/lib/csv";
import { ActionError, runAction, type ActionResult } from "./helpers";

const FIELDS = [
  "full_name",
  "login_email",
  "work_email",
  "job_title",
  "ratio_type",
  "employment_type",
] as const;

const responseSchema = z.object({
  mapping: z.array(z.string()),
});

export async function aiMapCsvColumns(
  headers: string[],
  sampleRows: string[][]
): Promise<ActionResult<{ mapping: string[]; via: "ai" | "heuristic" }>> {
  return runAction(async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("Not signed in.");

    const heuristic = headers.map((h) => guessField(h));

    if (!aiConfigured() || headers.length === 0) {
      return { mapping: heuristic, via: "heuristic" as const };
    }

    const result = await aiJson<{ mapping: string[] }>(
      "You map spreadsheet columns to a pharmacy staff roster schema. " +
        `Target fields: ${FIELDS.join(", ")} — or "" to skip a column.\n` +
        "ratio_type holds whether someone counts as a pharmacist or technician " +
        "(titles like RPh/PharmD → pharmacist; CPhT/tech → technician; cashier/driver → skip or non-counting). " +
        "If one email column exists, map it to work_email. full_name must be mapped if any column holds names. " +
        'Respond with JSON: {"mapping": ["field-or-empty-string", ...]} with EXACTLY one entry per column, in order.',
      `Columns: ${JSON.stringify(headers)}\nSample rows: ${JSON.stringify(sampleRows.slice(0, 3))}`,
      400
    );

    const parsed = responseSchema.safeParse(result);
    if (
      !parsed.success ||
      parsed.data.mapping.length !== headers.length ||
      !parsed.data.mapping.every(
        (m) => m === "" || (FIELDS as readonly string[]).includes(m)
      )
    ) {
      return { mapping: heuristic, via: "heuristic" as const };
    }

    // AI must at least find the name column; otherwise trust the heuristics
    if (!parsed.data.mapping.includes("full_name")) {
      return { mapping: heuristic, via: "heuristic" as const };
    }

    return { mapping: parsed.data.mapping, via: "ai" as const };
  });
}

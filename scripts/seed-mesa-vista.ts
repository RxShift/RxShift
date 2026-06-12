// Seed (or reset) the Mesa Vista Pharmacy demo tenant. All schedule dates
// are anchored to the Monday of the current week at runtime, so the demo
// never goes stale. The same logic backs the admin console's "Restore
// demo data" button (lib/demo/mesa-vista.ts).
//
// Run:   npx tsx scripts/seed-mesa-vista.ts          (first seed)
//        npx tsx scripts/seed-mesa-vista.ts --reset  (wipe data + re-seed)

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { resetMesaVista, seedMesaVista } from "../lib/demo/mesa-vista";

const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const reset = process.argv.includes("--reset");

(reset ? resetMesaVista(supabase, console.log) : seedMesaVista(supabase, console.log))
  .then((r) => {
    console.log(
      `\nDone. ${r.shifts} shifts across ${r.weeks} weeks; ${r.deficientHours} deficient compliance hours.`
    );
    console.log(
      "Demo login: type demo@rxshift.io at /app/login — the magic link lands in the rxshift.io catch-all inbox and signs in as Frank DiMaggio."
    );
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

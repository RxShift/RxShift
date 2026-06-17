// Capture marketing screenshots of the live app with Playwright.
//
// Runs against the LOCAL dev server (localhost:3200) — which has the
// ?screenshot=true banner suppression. Logs in programmatically as Frank
// (Mesa Vista owner_admin) via an admin-generated magic link, captures four
// 1440×900 JPGs, and (best-effort, time-permitting) records a short looping
// GIF of the live board responding to a status change. Saves to
// public/images/screenshots/.
//
// The shots use RxShift's default branding (the script temporarily clears
// Mesa Vista's teal branding, then restores it).
//
// Run:  npm run dev   (in another terminal)
//       npx tsx scripts/capture-screenshots.ts

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import { PNG } from "pngjs";
import { GIFEncoder, quantize, applyPalette } from "gifenc";

// ── env + service client (same pattern as scripts/seed-mesa-vista.ts) ──
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const BASE = "http://localhost:3200";
const OUT = join(__dirname, "..", "public", "images", "screenshots");
const MESA = "Mesa Vista Pharmacy";
const FRANK = "frank@mesavistarx.com";
const VIEWPORT = { width: 1440, height: 900 };

async function springValleyPeriodId(today: string): Promise<string | null> {
  const { data: loc } = await service
    .from("location")
    .select("id")
    .eq("name", "Mesa Vista — Spring Valley")
    .maybeSingle();
  if (!loc) return null;
  const { data: period } = await service
    .from("schedule_period")
    .select("id")
    .eq("location_id", loc.id)
    .lte("start_date", today)
    .gte("end_date", today)
    .maybeSingle();
  return (period?.id as string) ?? null;
}

function ptNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${g("year")}-${g("month")}-${g("day")}`,
    minutes: (parseInt(g("hour"), 10) % 24) * 60 + parseInt(g("minute"), 10),
  };
}

function toMin(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

// A counting technician on a published Spring Valley shift right NOW (PT), for
// the live-board GIF. Returns the staff name, or null if none is on shift.
async function onShiftTechName(): Promise<string | null> {
  const { date, minutes } = ptNow();
  const { data: loc } = await service
    .from("location")
    .select("id")
    .eq("name", "Mesa Vista — Spring Valley")
    .maybeSingle();
  if (!loc) return null;
  const { data: shifts } = await service
    .from("shift")
    .select("staff:staff_id(full_name, ratio_type), shift_segment(start_time, end_time)")
    .eq("location_id", loc.id)
    .eq("date", date)
    .eq("status", "published");
  const rows = (shifts ?? []) as unknown as Array<{
    staff: { full_name: string; ratio_type: string } | null;
    shift_segment: { start_time: string; end_time: string }[];
  }>;
  for (const s of rows) {
    if (s.staff?.ratio_type !== "technician") continue;
    for (const seg of s.shift_segment ?? []) {
      const start = toMin(seg.start_time);
      const e0 = toMin(seg.end_time);
      const end = e0 > start ? e0 : 1440;
      if (start <= minutes && minutes < end) return s.staff.full_name;
    }
  }
  return null;
}

async function loginAsFrank(page: Page) {
  const { data: link, error } = await service.auth.admin.generateLink({
    type: "magiclink",
    email: FRANK,
  });
  if (error || !link?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${error?.message ?? "no token"}`);
  }
  const confirmUrl =
    `${BASE}/app/auth/confirm` +
    `?token_hash=${encodeURIComponent(link.properties.hashed_token)}` +
    `&type=${encodeURIComponent(link.properties.verification_type)}`;
  await page.goto(confirmUrl, { waitUntil: "domcontentloaded" });
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app\//, { timeout: 20000 });
}

async function shot(page: Page, path: string, file: string, fullPage = false) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, file), type: "jpeg", quality: 92, fullPage });
  console.log("captured", file);
}

// Best-effort GIF: toggle whichever counting tech is on a Spring Valley shift
// right now (Working → Lunch → Working) and capture the location-cards region.
async function captureLiveBoardGif(page: Page) {
  const techName = await onShiftTechName();
  if (!techName) {
    console.warn(
      "[gif] No counting tech on a Spring Valley shift right now — skipping the GIF. Run between ~9a and 6p Pacific. The static shots are done."
    );
    return;
  }
  await page.goto(`${BASE}/app/board?screenshot=true`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const tech = page
    .locator("div")
    .filter({ has: page.getByText(techName, { exact: true }) })
    .locator("select")
    .first();

  if ((await tech.count()) === 0) {
    console.warn(
      `[gif] Couldn't find ${techName}'s status control on the board — skipping the GIF.`
    );
    return;
  }
  console.log(`[gif] Recording the live board via ${techName}.`);

  const clip = { x: 240, y: 56, width: 1100, height: 340 };
  const frames: { data: Uint8Array; width: number; height: number }[] = [];
  const grab = async () => {
    const buf = await page.screenshot({ clip });
    const png = PNG.sync.read(buf);
    frames.push({ data: new Uint8Array(png.data), width: png.width, height: png.height });
  };

  // Working (counts)
  for (let i = 0; i < 4; i++) { await grab(); await page.waitForTimeout(150); }
  // → Lunch (count drops)
  await tech.selectOption("on_lunch");
  await page.waitForTimeout(2200);
  for (let i = 0; i < 5; i++) { await grab(); await page.waitForTimeout(150); }
  // → Working (count recovers)
  await tech.selectOption("present_counting");
  await page.waitForTimeout(2200);
  for (let i = 0; i < 5; i++) { await grab(); await page.waitForTimeout(150); }

  const { width, height } = frames[0];
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    const index = applyPalette(f.data, palette);
    gif.writeFrame(index, width, height, { palette, delay: 280 });
  }
  gif.finish();
  writeFileSync(join(OUT, "live-board.gif"), Buffer.from(gif.bytes()));
  console.log(`captured live-board.gif (${frames.length} frames, ${width}×${height})`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);

  // Save + clear Mesa Vista branding so the shots use RxShift's own brand.
  const { data: tenant } = await service
    .from("tenant")
    .select("id, branding")
    .eq("name", MESA)
    .single();
  const savedBranding = tenant?.branding ?? null;
  await service.from("tenant").update({ branding: null }).eq("name", MESA);

  const browser = await chromium.launch();
  try {
    const compliancePeriod = await springValleyPeriodId(today);
    if (!compliancePeriod) {
      console.warn("[capture] No current Spring Valley period found; /app/log will show the default (all locations).");
    }

    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await loginAsFrank(page);

    await shot(page, "/app/schedule?screenshot=true", "schedule-all-locations.jpg");
    await shot(
      page,
      `/app/log?${compliancePeriod ? `period=${compliancePeriod}&` : ""}screenshot=true`,
      "compliance-record.jpg"
    );
    await shot(page, "/app/dashboard?screenshot=true", "dashboard.jpg", true);
    await shot(page, "/app/board?screenshot=true", "live-board.jpg");

    await captureLiveBoardGif(page);
  } finally {
    await browser.close();
    // Always restore the tenant's branding.
    await service.from("tenant").update({ branding: savedBranding }).eq("name", MESA);
    console.log("Mesa Vista branding restored.");
  }
}

main()
  .then(() => {
    console.log("\nDone. Screenshots in public/images/screenshots/.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });

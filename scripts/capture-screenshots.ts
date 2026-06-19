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

// The Compliance Record (/app/log) is the as-worked record, addressed by ?date=
// (NOT ?period= — that was the old as-scheduled view, now the Coverage Forecast).
// Land the marketing shot on the most recent day that actually has a deficient
// hour (the seeded Henderson gap) + its annotation, not a quiet all-compliant day.
async function deficiencyDate(): Promise<string | null> {
  const { data } = await service
    .from("compliance_record")
    .select("date")
    .eq("ratio_status", "deficient")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.date as string) ?? null;
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

// A counting PHARMACIST on a published Spring Valley shift right NOW (PT), plus
// the location + tenant ids — for the "can I step away?" headroom GIF.
async function svHeadroomTarget(): Promise<{
  locationId: string;
  tenantId: string;
  pharmacist: { id: string; name: string };
} | null> {
  const { date, minutes } = ptNow();
  const { data: loc } = await service
    .from("location")
    .select("id, tenant_id")
    .eq("name", "Mesa Vista — Spring Valley")
    .maybeSingle();
  if (!loc) return null;
  const { data: shifts } = await service
    .from("shift")
    .select("staff:staff_id(id, full_name, ratio_type), shift_segment(start_time, end_time)")
    .eq("location_id", loc.id)
    .eq("date", date)
    .eq("status", "published");
  const rows = (shifts ?? []) as unknown as Array<{
    staff: { id: string; full_name: string; ratio_type: string } | null;
    shift_segment: { start_time: string; end_time: string }[];
  }>;
  for (const s of rows) {
    if (s.staff?.ratio_type !== "pharmacist") continue;
    for (const seg of s.shift_segment ?? []) {
      const start = toMin(seg.start_time);
      const e0 = toMin(seg.end_time);
      const end = e0 > start ? e0 : 1440;
      if (start <= minutes && minutes < end)
        return {
          locationId: loc.id,
          tenantId: loc.tenant_id,
          pharmacist: { id: s.staff.id, name: s.staff.full_name },
        };
    }
  }
  return null;
}

// Set a person's live status directly (same close-then-open flow as the app's
// setLiveStatus server action) so the GIF can drive the headroom from the script.
async function setLive(tenantId: string, staffId: string, status: string) {
  const now = new Date().toISOString();
  await service
    .from("live_status")
    .update({ effective_to: now })
    .eq("staff_id", staffId)
    .is("effective_to", null);
  await service
    .from("live_status")
    .insert({ tenant_id: tenantId, staff_id: staffId, status, effective_from: now });
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

async function shot(
  page: Page,
  path: string,
  file: string,
  opts: { fullPage?: boolean; scrollToText?: string; offsetTop?: number } = {}
) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // Optionally frame a specific row instead of the top of the page — e.g. land
  // the Compliance Record shot on the deficient hour + its annotation, which
  // otherwise sit below the fold.
  if (opts.scrollToText) {
    try {
      const target = page.getByText(opts.scrollToText, { exact: false }).first();
      await target.scrollIntoViewIfNeeded({ timeout: 3000 });
      const box = await target.boundingBox();
      if (box) {
        await page.evaluate((dy) => window.scrollBy(0, dy), box.y - (opts.offsetTop ?? 200));
        await page.waitForTimeout(300);
      }
    } catch {
      // anchor not found — fall back to the default top-of-page shot
    }
  }
  await page.screenshot({ path: join(OUT, file), type: "jpeg", quality: 92, fullPage: !!opts.fullPage });
  console.log("captured", file);
}

// Best-effort GIF — the "can I step away without breaking ratio?" story.
// On the chrome-free wall display (one Spring Valley card), drop a pharmacist to
// lunch and watch the headroom line count down ("✓ N pharmacists can step away"
// → at the limit), then recover. Skipped if no pharmacist is on shift now.
async function captureHeadroomGif(page: Page) {
  const t = await svHeadroomTarget();
  if (!t) {
    console.warn(
      "[gif] No pharmacist on a Spring Valley shift right now — skipping the headroom GIF. Run ~9a–5p Pacific. The static shots are done."
    );
    return;
  }
  const url = `${BASE}/app/display?location=${t.locationId}`;
  const clip = { x: 0, y: 0, width: VIEWPORT.width, height: 380 };
  const frames: { data: Uint8Array; width: number; height: number }[] = [];
  const grab = async () => {
    const buf = await page.screenshot({ clip });
    const png = PNG.sync.read(buf);
    frames.push({ data: new Uint8Array(png.data), width: png.width, height: png.height });
  };
  const reload = async () => {
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(900);
  };

  console.log(`[gif] Recording headroom via ${t.pharmacist.name} at Spring Valley.`);
  try {
    await reload();
    // Full headroom
    for (let i = 0; i < 5; i++) { await grab(); await page.waitForTimeout(140); }
    // Pharmacist steps away → headroom drops
    await setLive(t.tenantId, t.pharmacist.id, "on_lunch");
    await reload();
    for (let i = 0; i < 6; i++) { await grab(); await page.waitForTimeout(140); }
    // Back on the floor → headroom recovers
    await setLive(t.tenantId, t.pharmacist.id, "present_counting");
    await reload();
    for (let i = 0; i < 5; i++) { await grab(); await page.waitForTimeout(140); }
  } finally {
    // Never leave the demo with a pharmacist parked at lunch.
    await setLive(t.tenantId, t.pharmacist.id, "present_counting");
  }

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
    const recordDate = await deficiencyDate();
    if (!recordDate) {
      console.warn("[capture] No deficient compliance-record day found; /app/log will show the most recent day (likely all-compliant).");
    }

    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await loginAsFrank(page);

    await shot(page, "/app/schedule?screenshot=true", "schedule-all-locations.jpg");
    await shot(
      page,
      `/app/log?${recordDate ? `date=${recordDate}&` : ""}screenshot=true`,
      "compliance-record.jpg",
      // Frame the deficient hour + its inline annotation (the feature's point),
      // not the all-compliant rows at the top of the day.
      { scrollToText: "Over ceiling", offsetTop: 230 }
    );
    await shot(page, "/app/dashboard?screenshot=true", "dashboard.jpg", { fullPage: true });
    await shot(page, "/app/board?screenshot=true", "live-board.jpg");

    await captureHeadroomGif(page);
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

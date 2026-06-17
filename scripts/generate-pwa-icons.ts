// Generate PWA / home-screen icons from the RxShift grid mark (no SVG raster
// dependency — render the mark on a navy square with Playwright and screenshot).
// Run: npx tsx scripts/generate-pwa-icons.ts   → writes PNGs into public/.
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { chromium } from "playwright";

const OUT = join(__dirname, "..", "public");

// The grid mark from public/brand/rxshift-mark-dark.svg (4×3 rounded squares),
// centered in a square navy field with maskable safe-area padding.
function iconSvg(size: number): string {
  const cols = [10, 39, 68, 97];
  const rows = [8, 37, 66];
  const colors = ["#3B5785", "#557AB0", "#F07C30", "#3B5785"];
  let rects = "";
  for (const y of rows)
    for (let c = 0; c < 4; c++)
      rects += `<rect x="${cols[c]}" y="${y}" width="22" height="22" rx="4" fill="${colors[c]}"/>`;
  const k = (size * 0.62) / 128; // grid native box is 128×96; ~62% → maskable safe
  const gw = 128 * k;
  const gh = 96 * k;
  const tx = (size - gw) / 2;
  const ty = (size - gh) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1C2F5E"/>
    <g transform="translate(${tx} ${ty}) scale(${k})">${rects}</g>
  </svg>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const targets: [string, number][] = [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-touch-icon.png", 180],
  ];
  for (const [file, size] of targets) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<!doctype html><html><body style="margin:0">${iconSvg(size)}</body></html>`,
      { waitUntil: "load" }
    );
    writeFileSync(join(OUT, file), await page.screenshot());
    await page.close();
    console.log("wrote", file, `(${size}x${size})`);
  }
  await browser.close();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

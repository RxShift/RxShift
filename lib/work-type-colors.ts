// Work-type color palette + contrast helpers.
//
// Curated, not free-form: every swatch is mid-dark so WHITE text reads on
// it in both light and dark mode, and saturated red/amber are deliberately
// absent — those hues mean "deficient" and "constraint flag" everywhere in
// the product. Fill color = what you're doing; ring color = compliance.

export const WORK_TYPE_PALETTE: { name: string; hex: string }[] = [
  { name: "Ocean", hex: "#3B6EA5" },
  { name: "Sky", hex: "#2E8BC0" },
  { name: "Cobalt", hex: "#4B7BEC" },
  { name: "Teal", hex: "#2BA39A" },
  { name: "Pine", hex: "#2C7A7B" },
  { name: "Lagoon", hex: "#0E7C86" },
  { name: "Meadow", hex: "#3FA34D" },
  { name: "Olive", hex: "#6B8E23" },
  { name: "Indigo", hex: "#4C5FD5" },
  { name: "Slate Blue", hex: "#6A5ACD" },
  { name: "Violet", hex: "#7C5CCF" },
  { name: "Orchid", hex: "#9B4DCA" },
  { name: "Magenta", hex: "#C2459E" },
  { name: "Rose", hex: "#C94F7C" },
  { name: "Steel", hex: "#5B6B82" },
  { name: "Sienna", hex: "#8A6240" },
];

/** Neutral fill for shifts whose segment has no work type assigned. */
export const NEUTRAL_SHIFT_BG = "#5B6B82";

/**
 * White or navy text, whichever reads better on the given hex background
 * (WCAG relative luminance). The curated palette always resolves to white;
 * this guards any future custom-hex input.
 */
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#FFFFFF";
  const n = parseInt(m[1], 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const lum =
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255);
  return lum > 0.45 ? "#1C2F5E" : "#FFFFFF";
}

// The RxShift Schedule Grid Mark — 4 cols × 3 rows, column 3 always Shift Amber.
// Geometry per Brand Items/DESIGN.md: cells 22×22 rx=4, gap 7, full mark 109×80.

const COL_X = [0, 29, 58, 87];
const ROW_Y = [0, 29, 58];

const FILLS = {
  light: ["#C4D2E2", "#8FAABB", "#F07C30", "#C4D2E2"],
  dark: ["#3B5785", "#557AB0", "#F07C30", "#3B5785"],
};

export default function RxShiftMark({
  size = 109,
  variant = "light",
}: {
  /** Rendered width in px; height scales proportionally (109:80). */
  size?: number;
  variant?: "light" | "dark";
}) {
  const fills = FILLS[variant];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 109 80"
      width={size}
      height={(size * 80) / 109}
      role="img"
      aria-label="RxShift Schedule Grid Mark"
    >
      {ROW_Y.map((y) =>
        COL_X.map((x, col) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="22"
            height="22"
            rx="4"
            fill={fills[col]}
          />
        ))
      )}
    </svg>
  );
}

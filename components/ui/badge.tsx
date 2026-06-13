const TONES = {
  compliant: "bg-compliant-bg text-compliant border-l-compliant",
  alert: "bg-alert-bg text-alert border-l-alert",
  deficiency: "bg-deficiency-bg text-deficiency border-l-deficiency",
  neutral: "bg-cloud text-steel border-l-line",
} as const;

export type BadgeTone = keyof typeof TONES;

export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block rounded-[4px] border-l-[3px] px-2 py-1 font-brand text-[10px] font-bold uppercase tracking-[0.5px] ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}

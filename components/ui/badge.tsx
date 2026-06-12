const TONES = {
  compliant: "bg-[#EDF7F2] text-[#2E7D5E] border-l-[#2E7D5E]",
  alert: "bg-[#FEF7ED] text-[#D4860A] border-l-[#D4860A]",
  deficiency: "bg-[#FEF0EF] text-[#C0392B] border-l-[#C0392B]",
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

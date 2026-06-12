import { type HTMLAttributes } from "react";

export function Card({
  highlighted = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { highlighted?: boolean }) {
  return (
    <div
      className={`rounded-[10px] border border-line bg-white p-6 shadow-[0_1px_3px_rgba(28,47,94,0.08)] ${
        highlighted ? "border-l-4 border-l-amber" : ""
      } ${className}`}
      {...props}
    />
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "compliant" | "alert" | "deficiency";
}) {
  const valueColor = {
    default: "text-navy",
    compliant: "text-[#2E7D5E]",
    alert: "text-[#D4860A]",
    deficiency: "text-[#C0392B]",
  }[tone];

  return (
    <Card>
      <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
        {label}
      </p>
      <p className={`mt-2 font-brand text-[28px] font-bold ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-1 font-body text-xs text-steel">{sub}</p>}
    </Card>
  );
}

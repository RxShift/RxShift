import { type HTMLAttributes } from "react";

export function Card({
  highlighted = false,
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { highlighted?: boolean }) {
  return (
    <div
      className={`rounded-[10px] border border-line bg-surface p-6 shadow-[var(--shadow-card)] ${
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
    compliant: "text-compliant",
    alert: "text-alert",
    deficiency: "text-deficiency",
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

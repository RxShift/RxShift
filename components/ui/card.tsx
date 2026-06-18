import { type HTMLAttributes } from "react";
import Link from "next/link";

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
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "default" | "compliant" | "alert" | "deficiency";
  /** When set, the whole card becomes a link to the relevant detail. */
  href?: string;
}) {
  const valueColor = {
    default: "text-navy",
    compliant: "text-compliant",
    alert: "text-alert",
    deficiency: "text-deficiency",
  }[tone];

  const body = (
    <>
      <p className="font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
        {label}
      </p>
      <p className={`mt-2 font-brand text-[28px] font-bold ${valueColor}`}>
        {value}
      </p>
      {sub && <p className="mt-1 font-body text-xs text-steel">{sub}</p>}
      {href && (
        <p className="mt-2 font-brand text-[11px] font-bold text-amber">
          View →
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="group block">
        <Card className="h-full transition-colors group-hover:border-amber">
          {body}
        </Card>
      </Link>
    );
  }

  return <Card>{body}</Card>;
}

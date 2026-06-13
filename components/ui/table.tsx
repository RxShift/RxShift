import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";

export function Table({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[10px] border border-line bg-surface shadow-[var(--shadow-card)]">
      <table className={`w-full ${className}`} {...props} />
    </div>
  );
}

export function Th({
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`bg-cloud px-3 py-2.5 text-left font-brand text-[9.5px] font-bold uppercase tracking-[1px] text-steel ${className}`}
      {...props}
    />
  );
}

export function Td({
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`border-t border-line px-3 py-2.5 font-body text-[13px] text-navy ${className}`}
      {...props}
    />
  );
}

export function Tr({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={`transition-colors hover:bg-navy/[0.02] ${className}`}
      {...props}
    />
  );
}

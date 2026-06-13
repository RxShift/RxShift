import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type LabelHTMLAttributes,
} from "react";

const FIELD_CLASS =
  "w-full rounded-md border-[1.5px] border-line bg-surface px-3 py-2.5 font-body text-sm text-navy placeholder:text-steel-light focus:border-navy focus:outline-none focus:ring-[3px] focus:ring-navy/10 disabled:bg-cloud disabled:text-steel";

export function Label({
  className = "",
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={`mb-1.5 block font-brand text-[11px] font-bold uppercase tracking-[0.5px] text-steel ${className}`}
      {...props}
    />
  );
}

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Select({
  className = "",
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${FIELD_CLASS} ${className}`} {...props} />;
}

export function HelpText({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 font-body text-xs text-steel">{children}</p>;
}

export function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 font-body text-xs text-deficiency">{children}</p>;
}

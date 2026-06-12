import { type ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-amber text-white hover:bg-amber-dark border border-transparent",
  secondary:
    "bg-white text-navy border-[1.5px] border-line hover:border-steel/40",
  ghost: "bg-transparent text-steel hover:text-navy border border-transparent",
  destructive:
    "bg-[#C0392B] text-white hover:bg-[#A93226] border border-transparent",
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 font-brand text-sm font-bold transition-colors disabled:pointer-events-none disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

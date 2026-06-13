"use client";

import { useEffect } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1C2F5E]/60 p-4"
      onClick={onClose}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl bg-surface p-8 shadow-[var(--shadow-dialog)] ${
          wide ? "max-w-[720px]" : "max-w-[480px]"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="mb-2 font-brand text-lg font-bold text-navy">{title}</h2>
        <div className="font-body text-sm text-steel">{children}</div>
        {footer && (
          <div className="mt-5 flex justify-end gap-3 border-t border-line pt-5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

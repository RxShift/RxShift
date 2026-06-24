"use client";

// Right-anchored slide-over panel. Same role as Modal (Escape to close, click the
// backdrop to dismiss, accessible dialog) but it docks to the right edge and fills the
// viewport height — for editing a record without losing your place behind it (e.g. the
// staff record opened from the schedule builder). Reused by the staff list too.

import { useEffect } from "react";

export default function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "default" | "wide";
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
      className="fixed inset-0 z-[100] flex justify-end bg-[#1C2F5E]/60"
      onClick={onClose}
    >
      <div
        className={`flex h-full w-full flex-col bg-surface shadow-[var(--shadow-dialog)] ${
          width === "wide" ? "max-w-[680px]" : "max-w-[560px]"
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-none items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="font-brand text-lg font-bold text-navy">{title}</h2>
            {subtitle && (
              <div className="mt-0.5 font-body text-xs text-steel">{subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 rounded-md px-2 py-1 font-body text-lg leading-none text-steel transition-colors hover:bg-cloud hover:text-navy"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 font-body text-sm text-steel">
          {children}
        </div>
        {footer && (
          <div className="flex flex-none justify-end gap-3 border-t border-line px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

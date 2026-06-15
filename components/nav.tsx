"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import RxShiftMark from "./rxshift-mark";

function Wordmark() {
  return (
    <span className="font-brand text-[20px] tracking-[-0.3px] text-white">
      <span className="font-bold">Rx</span>
      <span className="font-bold text-amber"> · </span>
      <span className="font-medium">Shift</span>
    </span>
  );
}

function ComingSoonBadge() {
  return (
    <span className="rounded-[4px] bg-amber/[0.12] px-1.5 py-0.5 font-brand text-[9px] font-bold uppercase text-amber">
      Coming Soon
    </span>
  );
}

const STATES = [
  { label: "Nevada", href: "/nevada", soon: false },
  { label: "California", href: "/states/california", soon: false },
  { label: "Tennessee", href: "/states/tennessee", soon: true },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [statesOpen, setStatesOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close the desktop dropdown when clicking anywhere else
  useEffect(() => {
    if (!statesOpen) return;
    function onClick(e: MouseEvent) {
      if (!dropdownRef.current?.contains(e.target as Node)) setStatesOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [statesOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy">
      <nav className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <RxShiftMark size={38} variant="dark" />
          <Wordmark />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-1 sm:flex">
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              aria-expanded={statesOpen}
              onClick={() => setStatesOpen(!statesOpen)}
              className="flex items-center gap-1 rounded-md px-3 py-2 font-body text-sm font-medium text-white/70 hover:text-white"
            >
              States
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            {statesOpen && (
              <div className="absolute left-0 top-full mt-1 w-56 rounded-lg border border-line bg-white py-1 shadow-[0_8px_24px_rgba(28,47,94,0.14)]">
                {STATES.map((s) => (
                  <Link
                    key={s.href}
                    href={s.href}
                    onClick={() => setStatesOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 font-body text-sm font-medium text-navy hover:bg-cloud"
                  >
                    {s.label}
                    {s.soon && <ComingSoonBadge />}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <Link
            href="/pricing"
            className="rounded-md px-3 py-2 font-body text-sm font-medium text-white/70 hover:text-white"
          >
            Pricing
          </Link>
          <Link
            href="/#demo"
            className="ml-3 rounded-md bg-amber px-5 py-2.5 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            Schedule a Walkthrough
          </Link>
          <a
            href="https://app.rxshift.io"
            className="ml-4 font-body text-sm font-medium text-white/70 hover:text-white"
          >
            Log in
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="flex h-11 w-11 items-center justify-center sm:hidden"
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            {open ? (
              <path d="M4 4l14 14M18 4L4 18" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 6h16M3 11h16M3 16h16" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-white px-6 py-4 sm:hidden">
          <p className="pt-1 font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
            States
          </p>
          {STATES.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between py-2.5 pl-3 font-body text-sm font-medium text-navy"
            >
              {s.label}
              {s.soon && <ComingSoonBadge />}
            </Link>
          ))}
          <Link
            href="/pricing"
            onClick={() => setOpen(false)}
            className="mt-1 block border-t border-line py-3 font-body text-sm font-medium text-navy"
          >
            Pricing
          </Link>
          <a
            href="https://app.rxshift.io"
            className="block py-3 font-body text-sm font-medium text-steel"
          >
            Log in
          </a>
          <Link
            href="/#demo"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-md bg-amber px-5 py-3 text-center font-brand text-sm font-bold text-white"
          >
            Schedule a Walkthrough
          </Link>
        </div>
      )}
    </header>
  );
}

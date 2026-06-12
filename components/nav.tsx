"use client";

import { useState } from "react";
import Link from "next/link";
import RxShiftMark from "./rxshift-mark";

function Wordmark() {
  return (
    <span className="font-brand text-[20px] tracking-[-0.3px] text-navy">
      <span className="font-bold">Rx</span>
      <span className="font-bold text-amber"> · </span>
      <span className="font-medium">Shift</span>
    </span>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <nav className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <RxShiftMark size={38} />
          <Wordmark />
        </Link>

        {/* Desktop */}
        <div className="hidden items-center sm:flex">
          <a
            href="/app/login"
            className="mr-4 font-body text-sm font-medium text-steel hover:text-navy"
          >
            Log in
          </a>
          <Link
            href="/#demo"
            className="rounded-md bg-amber px-5 py-2.5 font-brand text-sm font-bold text-white transition-colors hover:bg-amber-dark"
          >
            Schedule a Demo
          </Link>
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
              <path d="M4 4l14 14M18 4L4 18" stroke="#1C2F5E" strokeWidth="2" strokeLinecap="round" />
            ) : (
              <path d="M3 6h16M3 11h16M3 16h16" stroke="#1C2F5E" strokeWidth="2" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-white px-6 py-4 sm:hidden">
          <a
            href="/app/login"
            className="block py-3 font-body text-sm font-medium text-steel"
          >
            Log in
          </a>
          <Link
            href="/#demo"
            onClick={() => setOpen(false)}
            className="mt-2 block rounded-md bg-amber px-5 py-3 text-center font-brand text-sm font-bold text-white"
          >
            Schedule a Demo
          </Link>
        </div>
      )}
    </header>
  );
}

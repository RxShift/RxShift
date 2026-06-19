"use client";

import { usePathname } from "next/navigation";

// Desktop-oriented surfaces (schedule builder, settings, staff, reports,
// Compliance Record, platform admin). On a phone we don't invest in making these
// usable — we just render a gentle heads-up above the page (md:hidden).
const DESKTOP_ONLY = [
  "/app/schedule",
  "/app/settings",
  "/app/staff",
  "/app/reports",
  "/app/log",
  "/app/admin",
];

export default function DesktopOnlyNotice() {
  const pathname = usePathname();
  const match = DESKTOP_ONLY.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (!match) return null;
  return (
    <div className="border-b border-alert/30 bg-alert-bg px-4 py-2.5 md:hidden">
      <p className="font-body text-[13px] text-alert">
        This page is built for a larger screen — open RxShift on a computer for
        the full experience.
      </p>
    </div>
  );
}

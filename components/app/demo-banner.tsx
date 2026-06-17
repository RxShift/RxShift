"use client";

import { useSearchParams } from "next/navigation";

// The demo / trial sub-banner. A client component so `?screenshot=true` can hide
// it for clean marketing captures (Next.js layouts can't read searchParams).
export default function DemoBanner({
  isDemo,
  demoRedirectEmail,
  status,
  isOwner,
  isEmulating,
}: {
  isDemo: boolean;
  demoRedirectEmail: string | null;
  status: string;
  isOwner: boolean;
  isEmulating: boolean;
}) {
  const sp = useSearchParams();
  if (sp.get("screenshot") === "true") return null;

  if (isDemo) {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-alert/30 bg-alert-bg px-4 py-1.5">
        <p className="font-brand text-[12px] font-bold text-alert">
          Demo pharmacy — fictional data.
          {!isEmulating &&
            (demoRedirectEmail
              ? ` Emails redirect to ${demoRedirectEmail}.`
              : " No emails are sent.")}
        </p>
      </div>
    );
  }

  if (status !== "live") {
    return (
      <div className="flex items-center justify-center gap-2 border-b border-alert/30 bg-alert-bg px-4 py-1.5">
        <p className="font-brand text-[12px] font-bold text-alert">
          Trial mode — RxShift is not emailing your staff.
          {isOwner && " Go live in Settings when you're ready."}
        </p>
      </div>
    );
  }

  return null;
}

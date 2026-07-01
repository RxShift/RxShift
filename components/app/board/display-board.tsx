"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import FullscreenButton from "@/components/app/board/fullscreen-button";
import type { TimeFormat } from "@/lib/types";

// Read-only wall-display chrome: a slim top bar (tenant + location switcher +
// "updated" stamp + fullscreen) over the board cards. NO status controls — this
// is a heads-up display nobody touches. Refreshes every 30s.
export default function DisplayBoard({
  tenantName,
  locations,
  selectedLocationId,
  timeFormat = "12h",
  children,
}: {
  tenantName: string;
  locations: { id: string; name: string }[];
  selectedLocationId: string | null;
  timeFormat?: TimeFormat;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [updated, setUpdated] = useState("");

  useEffect(() => {
    const stamp = () =>
      setUpdated(
        new Intl.DateTimeFormat(undefined, {
          hour: "numeric",
          minute: "2-digit",
          hour12: timeFormat === "12h",
        }).format(new Date())
      );
    stamp();
    const refresh = setInterval(() => router.refresh(), 30_000);
    const clock = setInterval(stamp, 30_000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, [router, timeFormat]);

  return (
    <div className="min-h-screen bg-page">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="font-brand text-lg font-bold text-navy">
            {tenantName}
          </span>
          <span className="font-brand text-[10px] font-bold uppercase tracking-[1.5px] text-amber">
            Live status
          </span>
        </div>

        {locations.length > 1 && (
          <nav className="flex flex-wrap items-center gap-1.5">
            <SwitchLink href="/app/display" active={!selectedLocationId}>
              All locations
            </SwitchLink>
            {locations.map((l) => (
              <SwitchLink
                key={l.id}
                href={`/app/display?location=${l.id}`}
                active={selectedLocationId === l.id}
              >
                {l.name}
              </SwitchLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <span className="font-body text-xs text-steel">
            Updated {updated}
          </span>
          <FullscreenButton className="rounded-md border border-line px-3 py-1.5 font-brand text-xs font-semibold text-navy transition-colors hover:bg-cloud" />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

function SwitchLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 font-brand text-xs font-semibold transition-colors ${
        active
          ? "bg-navy text-white"
          : "border border-line text-steel hover:bg-cloud"
      }`}
    >
      {children}
    </Link>
  );
}

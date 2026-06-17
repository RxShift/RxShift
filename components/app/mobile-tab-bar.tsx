"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { AppRole } from "@/lib/types";
import { MANAGE, sections } from "@/components/app/sidebar";

// Phone-only bottom navigation (md:hidden). The desktop sidebar is hidden on
// mobile; this bar surfaces the few destinations a person actually uses on a
// phone, with a "More" sheet for the full nav (same items as the sidebar).
export default function MobileTabBar({
  role,
  hasRatio,
  isPlatformAdmin,
  isEmulating,
  tenantName,
}: {
  role: AppRole;
  hasRatio: boolean;
  isPlatformAdmin: boolean;
  isEmulating: boolean;
  tenantName: string;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const isManager = MANAGE.includes(role);

  const tabs: { label: string; href: string }[] = [];
  if (isManager) {
    tabs.push({ label: "Dashboard", href: "/app/dashboard" });
    if (hasRatio) tabs.push({ label: "Board", href: "/app/board" });
  }
  tabs.push({ label: "My Schedule", href: "/app/me" });
  tabs.push({ label: "Requests", href: "/app/requests" });

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  const navSections = sections(
    hasRatio,
    isPlatformAdmin && !isEmulating,
    tenantName
  )
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => !i.roles || i.roles.includes(role)),
    }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface md:hidden">
        {tabs.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-1 flex-col items-center justify-center px-1 py-2.5 text-center font-brand text-[10px] font-bold leading-tight ${
              active(t.href) ? "text-amber" : "text-steel"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center px-1 py-2.5 text-center font-brand text-[10px] font-bold leading-tight text-steel"
        >
          More
        </button>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" aria-hidden />
            {navSections.map((s, i) => (
              <div key={i} className="mb-4">
                {s.label && (
                  <p className="px-1 pb-1 font-brand text-[10px] font-bold uppercase tracking-[1px] text-steel">
                    {s.label}
                  </p>
                )}
                {s.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`block rounded-md px-3 py-2.5 font-brand text-sm font-medium ${
                      active(item.href)
                        ? "bg-amber/15 text-amber"
                        : "text-navy hover:bg-cloud"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

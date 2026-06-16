"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Organization", href: "/app/settings" },
  { label: "Locations & Departments", href: "/app/settings/locations" },
  { label: "Ratio", href: "/app/settings/ratio" },
  { label: "Work Types", href: "/app/settings/work-types" },
  { label: "Statuses", href: "/app/settings/statuses" },
  { label: "Constraint Rules", href: "/app/settings/constraints" },
  { label: "Import Staff", href: "/app/settings/import" },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line bg-surface px-8">
      {TABS.map((tab) => {
        const active =
          tab.href === "/app/settings"
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-3 py-3 font-brand text-sm font-medium transition-colors ${
              active
                ? "border-amber text-navy"
                : "border-transparent text-steel hover:text-navy"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

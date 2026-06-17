"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import RxShiftMark from "@/components/rxshift-mark";
import ThemeToggle from "@/components/ui/theme-toggle";
import FeedbackButton from "@/components/app/feedback-button";
import type { AppRole } from "@/lib/types";

interface NavItem {
  label: string;
  href: string;
  roles?: AppRole[]; // undefined = everyone
}

interface NavSection {
  label: string | null;
  items: NavItem[];
}

const MANAGE: AppRole[] = ["owner_admin", "scheduler", "supervisor", "read_only"];
// Can edit pharmacy configuration (mirrors canManage — excludes read_only)
const CONFIG: AppRole[] = ["owner_admin", "scheduler", "supervisor"];

function sections(
  hasRatio: boolean,
  showPlatform: boolean,
  tenantName: string
): NavSection[] {
  return [
    ...(showPlatform
      ? [
          {
            label: "Platform",
            items: [
              { label: "Admin Console", href: "/app/admin" },
              { label: "Leads", href: "/app/admin/leads" },
              { label: "Emails", href: "/app/admin/emails" },
              { label: "Feedback", href: "/app/admin/feedback" },
            ],
          },
        ]
      : []),
    {
      // The tenant's name heads its own nav — everything below it belongs
      // to THIS pharmacy, which matters most when an admin is switched in
      label: tenantName,
      items: [
        { label: "Dashboard", href: "/app/dashboard", roles: MANAGE },
        { label: "Schedule", href: "/app/schedule", roles: MANAGE },
        ...(hasRatio
          ? [{ label: "Live Board", href: "/app/board", roles: MANAGE }]
          : []),
        { label: "My Schedule", href: "/app/me" },
        { label: "Requests", href: "/app/requests" },
      ],
    },
    {
      label: "Compliance",
      items: [
        { label: "Compliance Record", href: "/app/log", roles: MANAGE },
        { label: "Override Log", href: "/app/log/overrides", roles: MANAGE },
        { label: "Reports", href: "/app/reports", roles: MANAGE },
      ],
    },
    {
      label: "Configuration",
      items: [
        { label: "Staff", href: "/app/staff", roles: MANAGE },
        { label: "Settings", href: "/app/settings", roles: CONFIG },
      ],
    },
    {
      label: "Resources",
      items: [
        { label: "Security Posture", href: "/app/security-posture", roles: ["owner_admin"] },
        { label: "Help", href: "/app/help" },
      ],
    },
  ];
}

// Collapse / expand are pure DOM + localStorage (no React state) so they match
// the no-flash script in app/layout.tsx and the ThemeToggle pattern exactly.
function collapseSidebar() {
  try {
    document.documentElement.classList.add("sidebar-collapsed");
    localStorage.setItem("rx-sidebar-collapsed", "1");
  } catch {}
}
function expandSidebar() {
  try {
    document.documentElement.classList.remove("sidebar-collapsed");
    localStorage.setItem("rx-sidebar-collapsed", "0");
  } catch {}
}

export default function Sidebar({
  tenantName,
  role,
  hasRatio,
  userEmail,
  isPlatformAdmin = false,
  isEmulating = false,
  tenantLogoUrl = null,
}: {
  tenantName: string;
  role: AppRole;
  hasRatio: boolean;
  userEmail: string;
  isPlatformAdmin?: boolean;
  /** While emulating a tenant (a demo), hide the Platform section from the prospect. */
  isEmulating?: boolean;
  tenantLogoUrl?: string | null;
}) {
  const pathname = usePathname();
  // Track the specific URL that failed, not a sticky boolean — so when the owner
  // corrects a bad logo URL, the new one shows without a hard reload.
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);
  const showTenantLogo =
    Boolean(tenantLogoUrl) && failedLogoUrl !== tenantLogoUrl;

  return (
    <>
    <aside className="app-sidebar fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-[#1C2F5E]">
      {/* RxShift mark always stays — the tenant logo (if set) sits beside it */}
      <div className="flex h-[60px] items-center gap-2.5 bg-[#162650] px-5">
        <RxShiftMark size={30} variant="dark" />
        {showTenantLogo ? (
          <>
            {/* Divider so the partner logo reads as a deliberate lockup
                (Rx·Shift │ Pharmacy), not two marks colliding. */}
            <span className="h-7 w-px shrink-0 bg-white/15" aria-hidden />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tenantLogoUrl!}
              alt={tenantName}
              className="max-h-6 max-w-[108px] object-contain"
              referrerPolicy="no-referrer"
              onError={() => setFailedLogoUrl(tenantLogoUrl!)}
            />
          </>
        ) : (
          <span className="font-brand text-[17px] tracking-[-0.3px] text-white">
            <span className="font-bold">Rx</span>
            <span className="font-bold text-amber"> · </span>
            <span className="font-medium">Shift</span>
          </span>
        )}
        {/* Collapse the nav to reclaim screen real estate (schedule + board). */}
        <button
          type="button"
          onClick={collapseSidebar}
          aria-label="Hide navigation"
          title="Hide menu"
          className="ml-auto shrink-0 rounded p-1 leading-none text-white/45 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden className="font-brand text-base font-bold">
            «
          </span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {sections(hasRatio, isPlatformAdmin && !isEmulating, tenantName).map((section, i) => {
          const visible = section.items.filter(
            (item) => !item.roles || item.roles.includes(role)
          );
          if (visible.length === 0) return null;
          return (
            <div key={i}>
              {section.label && (
                <p className="px-5 pb-2 pt-5 font-brand text-[9.5px] font-bold uppercase tracking-[1.5px] text-white/35">
                  {section.label}
                </p>
              )}
              {visible.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/app/log" && pathname.startsWith(item.href + "/")) ||
                  (item.href === "/app/log" && pathname === "/app/log");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block border-l-[3px] px-5 py-2.5 font-brand text-sm font-medium transition-colors ${
                      active
                        ? "border-amber bg-amber/15 text-amber"
                        : "border-transparent text-white/65 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="truncate font-brand text-xs font-medium text-white/80">
          {tenantName}
        </p>
        {showTenantLogo && (
          <p className="font-body text-[10px] text-white/35">
            powered by RxShift
          </p>
        )}
        <p className="mt-0.5 truncate font-body text-[11px] text-white/40">
          {userEmail}
        </p>
        <form action="/app/auth/signout" method="post">
          <button
            type="submit"
            className="mt-2 font-body text-[11px] text-white/40 hover:text-white/70"
          >
            Sign out
          </button>
        </form>
        <FeedbackButton />
        <ThemeToggle />
      </div>
    </aside>
    {/* Reopen tab — pinned to the left edge, shown only while collapsed (CSS in
        globals.css). Lives outside <aside> so it stays visible when the sidebar
        slides off-screen. */}
    <button
      type="button"
      onClick={expandSidebar}
      aria-label="Show navigation"
      title="Show menu"
      className="app-sidebar-reopen fixed left-0 top-1/2 z-50 -translate-y-1/2 items-center rounded-r-lg bg-[#1C2F5E] px-1.5 py-3 text-white/80 shadow-md transition-colors hover:bg-[#162650] hover:text-white"
    >
      <span aria-hidden className="font-brand text-sm font-bold">
        »
      </span>
    </button>
    </>
  );
}

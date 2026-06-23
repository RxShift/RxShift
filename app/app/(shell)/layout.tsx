import { redirect } from "next/navigation";
import Sidebar from "@/components/app/sidebar";
import SidebarReopenButton from "@/components/app/sidebar-reopen-button";
import MobileTabBar from "@/components/app/mobile-tab-bar";
import DesktopOnlyNotice from "@/components/app/desktop-only-notice";
import PlatformBanner from "@/components/app/platform-banner";
import DemoBanner from "@/components/app/demo-banner";
import { getSession } from "@/lib/auth";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/app/login");
  // Authenticated but no tenant yet → onboarding wizard
  if (!session.appUser || !session.tenant) redirect("/app/onboarding");
  if (!session.tenant.onboarding_complete) redirect("/app/onboarding");

  const showBanner =
    session.platform.activeTenantId !== null ||
    session.platform.emulatingAppUserId !== null;
  // While emulating a user (running a demo), hide platform chrome + internal
  // details from the prospect, but keep the "viewing as" safety banner.
  const isEmulating = session.platform.emulatingAppUserId !== null;

  // Light per-tenant branding: a single validated accent color overrides only
  // --color-amber for this subtree (buttons/highlights), in both light and dark
  // mode. Rendered server-side so there's no flash, and scoped to the app shell
  // so marketing/auth screens are untouched. The color is regex-validated
  // before it reaches CSS — never interpolate the logo URL into styles.
  const branding = session.tenant.branding;
  const accent =
    branding?.primary_color && /^#[0-9A-Fa-f]{6}$/.test(branding.primary_color)
      ? branding.primary_color
      : null;
  const logoUrl = branding?.logo_url || null;

  return (
    <div className={`flex min-h-screen${accent ? " rx-tenant" : ""}`}>
      {accent && (
        <style>{`.rx-tenant{--color-amber:${accent};}`}</style>
      )}
      <Sidebar
        tenantName={session.tenant.name}
        role={session.appUser.role}
        hasRatio={session.tenant.has_ratio}
        userEmail={session.email}
        isPlatformAdmin={session.platform.isPlatformAdmin}
        isEmulating={isEmulating}
        tenantLogoUrl={logoUrl}
      />
      {/* Fixed, always-reachable reopen tab (shown only while collapsed). */}
      <SidebarReopenButton />
      {/* Mobile: no sidebar margin + bottom padding for the tab bar. Desktop
          (md+): the fixed sidebar's ml-60 (and the collapse override). */}
      <div className="app-content ml-0 flex min-h-screen min-w-0 flex-1 flex-col pb-16 md:ml-60 md:pb-0">
        {showBanner && (
          <PlatformBanner
            tenantName={session.tenant.name}
            emulatingLabel={session.platform.emulatingLabel}
          />
        )}
        <DemoBanner
          isDemo={session.tenant.is_demo}
          demoRedirectEmail={session.tenant.demo_redirect_email}
          status={session.tenant.status}
          isOwner={session.appUser.role === "owner_admin"}
          isEmulating={isEmulating}
        />
        <DesktopOnlyNotice />
        {children}
      </div>
      <MobileTabBar
        role={session.appUser.role}
        hasRatio={session.tenant.has_ratio}
        isPlatformAdmin={session.platform.isPlatformAdmin}
        isEmulating={isEmulating}
        tenantName={session.tenant.name}
      />
    </div>
  );
}

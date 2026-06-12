import { redirect } from "next/navigation";
import Sidebar from "@/components/app/sidebar";
import PlatformBanner from "@/components/app/platform-banner";
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

  return (
    <div className="flex min-h-screen">
      <Sidebar
        tenantName={session.tenant.name}
        role={session.appUser.role}
        hasRatio={session.tenant.has_ratio}
        userEmail={session.email}
        isPlatformAdmin={session.platform.isPlatformAdmin}
      />
      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        {showBanner && (
          <PlatformBanner
            tenantName={session.tenant.name}
            emulatingLabel={session.platform.emulatingLabel}
          />
        )}
        {session.tenant.status !== "live" && (
          <div className="flex items-center justify-center gap-2 border-b border-[#D4860A]/30 bg-[#FEF7ED] px-4 py-1.5">
            <p className="font-brand text-[12px] font-bold text-[#D4860A]">
              Trial mode — RxShift is not emailing your staff.
              {session.appUser.role === "owner_admin" &&
                " Go live in Settings when you're ready."}
            </p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

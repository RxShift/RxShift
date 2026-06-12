import { redirect } from "next/navigation";
import Sidebar from "@/components/app/sidebar";
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

  return (
    <div className="flex min-h-screen">
      <Sidebar
        tenantName={session.tenant.name}
        role={session.appUser.role}
        hasRatio={session.tenant.has_ratio}
        userEmail={session.email}
      />
      <div className="ml-60 flex min-h-screen flex-1 flex-col">{children}</div>
    </div>
  );
}

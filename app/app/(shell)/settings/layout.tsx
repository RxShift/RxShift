import { redirect } from "next/navigation";
import PageHeader from "@/components/ui/page-header";
import SettingsTabs from "@/components/app/settings-tabs";
import { getSession, isAdmin } from "@/lib/auth";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session || !isAdmin(session.appUser)) redirect("/app/dashboard");

  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs />
      <div className="flex-1 p-8">{children}</div>
    </>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

// Minimal, chrome-free shell for the demo prompter — platform admins ONLY. Unlike
// the kiosk layout it does NOT require a tenant context (a presenter tool doesn't
// belong to a pharmacy), so it works whether or not the admin has a tenant active.
export default async function PrompterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/app/login");
  if (!session.platform.isPlatformAdmin) redirect("/app/dashboard");
  return <div className="min-h-screen bg-[#0C1628]">{children}</div>;
}
